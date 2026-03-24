import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import type { PlatformId, ShotBoardStatus } from '../../types/scene';
import type { BoardShotItem } from './board-config';
import { BoardCard } from './BoardCard';

interface BoardColumnProps {
  status: ShotBoardStatus;
  title: string;
  description: string;
  shots: BoardShotItem[];
  groupByScene: boolean;
  selectedShotIds: Set<string>;
  editingShotId: string | null;
  actionDraftByShotId: Record<string, string>;
  onToggleSelect: (shotId: string) => void;
  onBeginEdit: (shotId: string) => void;
  onActionDraftChange: (shotId: string, value: string) => void;
  onSaveAction: (shotId: string) => void;
  onCancelEdit: () => void;
  onPlatformChange: (shotId: string, platform: PlatformId) => void;
  onGenerateOne: (shotId: string) => void;
  onApprove: (shotId: string) => void;
  onMoveToReady: (shotId: string) => void;
}

export function BoardColumn({
  status,
  title,
  description,
  shots,
  groupByScene,
  selectedShotIds,
  editingShotId,
  actionDraftByShotId,
  onToggleSelect,
  onBeginEdit,
  onActionDraftChange,
  onSaveAction,
  onCancelEdit,
  onPlatformChange,
  onGenerateOne,
  onApprove,
  onMoveToReady,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status}` });

  return (
    <section
      ref={setNodeRef}
      style={{
        minWidth: 310,
        maxWidth: 310,
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${isOver ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12,
        background: 'var(--bg-primary)',
      }}
    >
      <header
        style={{
          padding: 12,
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 14 }}>{title}</h3>
          <span
            style={{
              minWidth: 22,
              height: 22,
              borderRadius: 999,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: 'var(--text-secondary)',
            }}
          >
            {shots.length}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>
      </header>

      <div style={{ padding: 10, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shots.length === 0 ? (
          <div
            style={{
              border: '1px dashed var(--border)',
              borderRadius: 8,
              padding: 16,
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--text-muted)',
            }}
          >
            Drop cards here
          </div>
        ) : (
          <SortableContext items={shots.map((item) => item.shot.id)} strategy={verticalListSortingStrategy}>
            {shots.map((item, index) => {
              const previous = shots[index - 1];
              const showSceneHeader = groupByScene && (!previous || previous.sceneId !== item.sceneId);

              return (
                <div key={`${item.shot.id}-wrap`}>
                  {showSceneHeader && (
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: 0.3,
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        marginBottom: 6,
                      }}
                    >
                      {item.sceneLabel}
                    </div>
                  )}
                  <BoardCard
                    shot={item.shot}
                    sceneLabel={item.sceneLabel}
                    isSelected={selectedShotIds.has(item.shot.id)}
                    canSelect={status === 'ready'}
                    isEditing={editingShotId === item.shot.id}
                    actionDraft={actionDraftByShotId[item.shot.id] ?? item.shot.prompt.subject.action}
                    onToggleSelect={onToggleSelect}
                    onBeginEdit={onBeginEdit}
                    onActionDraftChange={onActionDraftChange}
                    onSaveAction={onSaveAction}
                    onCancelEdit={onCancelEdit}
                    onPlatformChange={onPlatformChange}
                    onGenerateOne={onGenerateOne}
                    onApprove={onApprove}
                    onMoveToReady={onMoveToReady}
                  />
                </div>
              );
            })}
          </SortableContext>
        )}
      </div>
    </section>
  );
}
