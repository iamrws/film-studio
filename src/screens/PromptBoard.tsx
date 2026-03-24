import { useEffect, useMemo, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { generationQueue } from '../services/generation-queue';
import { useProjectStore } from '../stores/project-store';
import type { PlatformId, ShotBoardStatus } from '../types/scene';
import { BoardToolbar } from '../components/board/BoardToolbar';
import { BoardColumn } from '../components/board/BoardColumn';
import {
  BOARD_COLUMNS,
  PLATFORM_API_KEY_FIELD,
  SUPPORTED_GENERATION_PLATFORMS,
  type BoardShotItem,
} from '../components/board/board-config';

const SUPPORTED_PLATFORM_SET = new Set<PlatformId>(SUPPORTED_GENERATION_PLATFORMS);

export function PromptBoard() {
  const scenes = useProjectStore((s) => s.project.scenes);
  const settings = useProjectStore((s) => s.project.settings);
  const characters = useProjectStore((s) => s.project.characterBible.characters);
  const globalStyle = useProjectStore((s) => s.project.globalStyle);

  const updateShotBoardStatus = useProjectStore((s) => s.updateShotBoardStatus);
  const reorderShots = useProjectStore((s) => s.reorderShots);
  const batchMoveShots = useProjectStore((s) => s.batchMoveShots);
  const updateShotTargetPlatform = useProjectStore((s) => s.updateShotTargetPlatform);
  const updateShotAction = useProjectStore((s) => s.updateShotAction);
  const setActiveScreen = useProjectStore((s) => s.setActiveScreen);

  const [searchQuery, setSearchQuery] = useState('');
  const [groupByScene, setGroupByScene] = useState(false);
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);
  const [bulkPlatform, setBulkPlatform] = useState<PlatformId>(settings.defaultPlatform);
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [actionDraftByShotId, setActionDraftByShotId] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'success' | 'error' | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const allShotItems = useMemo<BoardShotItem[]>(
    () =>
      scenes.flatMap((scene, sceneIndex) =>
        scene.shots.map((shot) => ({
          shot,
          sceneId: scene.id,
          sceneLabel: `Scene ${sceneIndex + 1}: ${scene.heading.prefix}. ${scene.heading.location}`,
        }))
      ),
    [scenes]
  );

  const allShotMap = useMemo(() => {
    const map = new Map<string, BoardShotItem>();
    allShotItems.forEach((item) => map.set(item.shot.id, item));
    return map;
  }, [allShotItems]);

  const countsByStatus = useMemo(() => {
    const counts: Record<ShotBoardStatus, number> = {
      backlog: 0,
      ready: 0,
      generating: 0,
      review: 0,
      done: 0,
    };
    for (const item of allShotItems) {
      counts[item.shot.boardStatus] += 1;
    }
    return counts;
  }, [allShotItems]);

  const allReadyShotIds = useMemo(
    () =>
      allShotItems
        .filter((item) => item.shot.boardStatus === 'ready')
        .sort((a, b) => a.shot.boardOrder - b.shot.boardOrder || a.shot.sequenceOrder - b.shot.sequenceOrder)
        .map((item) => item.shot.id),
    [allShotItems]
  );

  const columns = useMemo<Record<ShotBoardStatus, BoardShotItem[]>>(() => {
    const next: Record<ShotBoardStatus, BoardShotItem[]> = {
      backlog: [],
      ready: [],
      generating: [],
      review: [],
      done: [],
    };

    const query = searchQuery.trim().toLowerCase();

    for (const item of allShotItems) {
      if (query) {
        const haystack = [
          item.sceneLabel,
          item.shot.prompt.camera.shotType,
          item.shot.prompt.camera.movement,
          item.shot.prompt.subject.action,
          item.shot.psychology.targetEmotion,
          item.shot.targetPlatform,
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(query)) continue;
      }

      next[item.shot.boardStatus].push(item);
    }

    for (const column of BOARD_COLUMNS) {
      next[column.id].sort(
        (a, b) => a.shot.boardOrder - b.shot.boardOrder || a.shot.sequenceOrder - b.shot.sequenceOrder
      );
    }

    return next;
  }, [allShotItems, searchQuery]);

  useEffect(() => {
    const readySet = new Set(allReadyShotIds);
    setSelectedShotIds((prev) => prev.filter((id) => readySet.has(id)));
  }, [allReadyShotIds]);

  useEffect(() => {
    if (!SUPPORTED_PLATFORM_SET.has(bulkPlatform)) {
      setBulkPlatform('veo3');
    }
  }, [bulkPlatform]);

  const selectedShotSet = useMemo(() => new Set(selectedShotIds), [selectedShotIds]);

  const flashStatus = (message: string, tone: 'success' | 'error') => {
    setStatusMessage(message);
    setStatusTone(tone);
    window.setTimeout(() => {
      setStatusMessage(null);
      setStatusTone(null);
    }, 3500);
  };

  const handleToggleSelect = (shotId: string) => {
    setSelectedShotIds((prev) =>
      prev.includes(shotId) ? prev.filter((id) => id !== shotId) : [...prev, shotId]
    );
  };

  const handleBeginEdit = (shotId: string) => {
    const shot = allShotMap.get(shotId)?.shot;
    if (!shot) return;

    setEditingShotId(shotId);
    setActionDraftByShotId((prev) => ({
      ...prev,
      [shotId]: prev[shotId] ?? shot.prompt.subject.action,
    }));
  };

  const handleSaveAction = (shotId: string) => {
    const draft = (actionDraftByShotId[shotId] ?? '').trim();
    if (!draft) {
      flashStatus('Action summary cannot be empty.', 'error');
      return;
    }

    updateShotAction(shotId, draft);
    setEditingShotId(null);
    flashStatus('Prompt action updated.', 'success');
  };

  const handleApplyBulkPlatform = () => {
    const targetIds = selectedShotIds.length > 0 ? selectedShotIds : allReadyShotIds;
    if (targetIds.length === 0) {
      flashStatus('No Ready shots available for bulk platform update.', 'error');
      return;
    }

    targetIds.forEach((id) => updateShotTargetPlatform(id, bulkPlatform));
    flashStatus(`Applied ${bulkPlatform} to ${targetIds.length} shot(s).`, 'success');
  };

  const submitShots = (shotIds: string[]) => {
    if (shotIds.length === 0) {
      flashStatus('No shots selected for generation.', 'error');
      return;
    }

    const readyShots = shotIds
      .map((id) => allShotMap.get(id)?.shot)
      .filter((shot): shot is NonNullable<typeof shot> => Boolean(shot))
      .filter((shot) => shot.boardStatus === 'ready');

    if (readyShots.length === 0) {
      flashStatus('Selected shots must be in Ready before generation.', 'error');
      return;
    }

    const unsupported = readyShots.filter((shot) => !SUPPORTED_PLATFORM_SET.has(shot.targetPlatform));
    if (unsupported.length > 0) {
      flashStatus('One or more shots use an unsupported platform. Pick Veo/Sora/Kling/Seedance/Runway.', 'error');
      return;
    }

    const byPlatform = new Map<PlatformId, typeof readyShots>();
    for (const shot of readyShots) {
      const current = byPlatform.get(shot.targetPlatform) ?? [];
      current.push(shot);
      byPlatform.set(shot.targetPlatform, current);
    }

    const missingKeys: string[] = [];
    for (const [platform] of byPlatform) {
      const keyField = PLATFORM_API_KEY_FIELD[platform];
      if (!settings.apiKeys[keyField]) {
        missingKeys.push(`${platform} (${keyField} key)`);
      }
    }

    if (missingKeys.length > 0) {
      flashStatus(`Missing API keys: ${missingKeys.join(', ')}.`, 'error');
      return;
    }

    for (const [platform, shots] of byPlatform) {
      const keyField = PLATFORM_API_KEY_FIELD[platform];
      const apiKey = settings.apiKeys[keyField];
      generationQueue.setApiConfig(platform, { apiKey });
      generationQueue.enqueueBatch(shots, platform, globalStyle, characters);
    }

    batchMoveShots(readyShots.map((shot) => shot.id), 'generating');
    setSelectedShotIds((prev) => prev.filter((id) => !readyShots.some((shot) => shot.id === id)));
    flashStatus(`${readyShots.length} shot(s) submitted for generation.`, 'success');
  };

  const handleGenerateAll = () => {
    const targetIds = selectedShotIds.length > 0 ? selectedShotIds : allReadyShotIds;
    submitShots(targetIds);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (searchQuery.trim()) {
      flashStatus('Clear search before reordering to avoid partial-order conflicts.', 'error');
      return;
    }

    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeShot = allShotMap.get(activeId)?.shot;
    if (!activeShot) return;

    const sourceStatus = activeShot.boardStatus;
    const overColumnStatus = getStatusFromColumnId(overId);
    const targetStatus = overColumnStatus ?? allShotMap.get(overId)?.shot.boardStatus;
    if (!targetStatus) return;

    if (sourceStatus === targetStatus) {
      const currentOrder = columns[targetStatus].map((item) => item.shot.id);
      const oldIndex = currentOrder.indexOf(activeId);
      const fallbackIndex = Math.max(currentOrder.length - 1, 0);
      const newIndexRaw = overColumnStatus ? fallbackIndex : currentOrder.indexOf(overId);
      const newIndex = newIndexRaw < 0 ? fallbackIndex : newIndexRaw;

      if (oldIndex === -1 || oldIndex === newIndex) return;
      reorderShots(targetStatus, arrayMove(currentOrder, oldIndex, newIndex));
      return;
    }

    const sourceIds = columns[sourceStatus].map((item) => item.shot.id).filter((id) => id !== activeId);
    const targetIds = columns[targetStatus].map((item) => item.shot.id);
    const insertionIndexRaw = overColumnStatus ? targetIds.length : targetIds.indexOf(overId);
    const insertionIndex = insertionIndexRaw < 0 ? targetIds.length : insertionIndexRaw;
    const nextTargetIds = [...targetIds];
    nextTargetIds.splice(insertionIndex, 0, activeId);

    updateShotBoardStatus(activeId, targetStatus);
    reorderShots(sourceStatus, sourceIds);
    reorderShots(targetStatus, nextTargetIds);

    if (targetStatus !== 'ready') {
      setSelectedShotIds((prev) => prev.filter((id) => id !== activeId));
    }
  };

  const totalShots = allShotItems.length;

  return (
    <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Prompt Board</h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {totalShots} shots | Ready {countsByStatus.ready} | Generating {countsByStatus.generating} | Review {countsByStatus.review}
          </div>
        </div>
        <button
          onClick={() => setActiveScreen('queue')}
          style={{
            padding: '7px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Open Queue
        </button>
      </div>

      <BoardToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        groupByScene={groupByScene}
        onToggleGroupByScene={() => setGroupByScene((prev) => !prev)}
        readyCount={countsByStatus.ready}
        selectedCount={selectedShotIds.length}
        bulkPlatform={bulkPlatform}
        onBulkPlatformChange={setBulkPlatform}
        onApplyBulkPlatform={handleApplyBulkPlatform}
        onSelectAllReady={() => setSelectedShotIds(allReadyShotIds)}
        onClearSelection={() => setSelectedShotIds([])}
        onGenerateAll={handleGenerateAll}
        statusMessage={statusMessage}
        statusTone={statusTone}
      />

      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div style={{ display: 'flex', gap: 10, height: '100%' }}>
            {BOARD_COLUMNS.map((column) => (
              <BoardColumn
                key={column.id}
                status={column.id}
                title={column.title}
                description={column.description}
                shots={columns[column.id]}
                groupByScene={groupByScene}
                selectedShotIds={selectedShotSet}
                editingShotId={editingShotId}
                actionDraftByShotId={actionDraftByShotId}
                onToggleSelect={handleToggleSelect}
                onBeginEdit={handleBeginEdit}
                onActionDraftChange={(shotId, value) =>
                  setActionDraftByShotId((prev) => ({ ...prev, [shotId]: value }))
                }
                onSaveAction={handleSaveAction}
                onCancelEdit={() => setEditingShotId(null)}
                onPlatformChange={updateShotTargetPlatform}
                onGenerateOne={(shotId) => submitShots([shotId])}
                onApprove={(shotId) => {
                  updateShotBoardStatus(shotId, 'done');
                  flashStatus('Shot approved and moved to Done.', 'success');
                }}
                onMoveToReady={(shotId) => updateShotBoardStatus(shotId, 'ready')}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  );
}

function getStatusFromColumnId(id: string): ShotBoardStatus | null {
  if (!id.startsWith('column-')) return null;
  const value = id.slice('column-'.length) as ShotBoardStatus;
  return BOARD_COLUMNS.some((column) => column.id === value) ? value : null;
}
