import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PlatformId, Shot } from '../../types/scene';
import { PLATFORM_OPTIONS } from './board-config';

interface BoardCardProps {
  shot: Shot;
  sceneLabel: string;
  isSelected: boolean;
  canSelect: boolean;
  isEditing: boolean;
  actionDraft: string;
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

export function BoardCard({
  shot,
  sceneLabel,
  isSelected,
  canSelect,
  isEditing,
  actionDraft,
  onToggleSelect,
  onBeginEdit,
  onActionDraftChange,
  onSaveAction,
  onCancelEdit,
  onPlatformChange,
  onGenerateOne,
  onApprove,
  onMoveToReady,
}: BoardCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: shot.id,
    data: { status: shot.boardStatus },
  });

  const cardStyle: React.CSSProperties = {
    border: `1px solid ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
    padding: 10,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1,
    boxShadow: isDragging ? '0 8px 20px rgba(0, 0, 0, 0.28)' : 'none',
  };

  return (
    <div ref={setNodeRef} style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sceneLabel}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {canSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(shot.id)}
              onClick={(e) => e.stopPropagation()}
              title="Select for batch actions"
              aria-label="Select shot for batch actions"
            />
          )}
          <button
            {...attributes}
            {...listeners}
            title="Drag to reorder"
            aria-label="Drag to reorder"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              width: 24,
              height: 24,
              cursor: 'grab',
            }}
          >
            ::
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 10, marginTop: 8 }}>
        <div
          role="img"
          aria-label="Shot preview placeholder"
          style={{
            height: 56,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'linear-gradient(145deg, var(--color-neutral-800) 0%, var(--color-neutral-900) 100%)',
            color: 'var(--text-muted)',
            fontSize: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            lineHeight: 1.2,
            padding: 4,
          }}
        >
          Preview
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              {shot.prompt.camera.shotType} / {shot.prompt.camera.movement}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{shot.durationSeconds}s</div>
          </div>

          <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--on-bright)',
                background: getEmotionColor(shot.psychology.valence),
                borderRadius: 999,
                padding: '2px 7px',
              }}
            >
              {shot.psychology.targetEmotion}
            </span>
            <span
              style={{
                fontSize: 10,
                color: 'var(--film-accent-300)',
                background: 'var(--film-accent-600)',
                borderRadius: 999,
                padding: '2px 7px',
                textTransform: 'uppercase',
                letterSpacing: 0.2,
              }}
            >
              {shot.targetPlatform}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>A:{shot.psychology.arousalLevel}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        {isEditing ? (
          <div>
            <textarea
              value={actionDraft}
              onChange={(e) => onActionDraftChange(shot.id, e.target.value)}
              rows={4}
              style={{
                width: '100%',
                resize: 'vertical',
                padding: 8,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: 12,
              }}
            />
            <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
              <button onClick={() => onSaveAction(shot.id)} style={saveBtn}>
                Save
              </button>
              <button onClick={onCancelEdit} style={secondaryBtn}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {shot.prompt.subject.action}
            </div>
            <button onClick={() => onBeginEdit(shot.id)} style={{ ...secondaryBtn, marginTop: 6 }}>
              Quick Edit
            </button>
          </>
        )}
      </div>

      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, alignItems: 'center' }}>
        <select
          value={shot.targetPlatform}
          onChange={(e) => onPlatformChange(shot.id, e.target.value as PlatformId)}
          aria-label="Target platform for this shot"
          style={{
            padding: '6px 8px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: 11,
          }}
        >
          {PLATFORM_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 6 }}>
          {shot.boardStatus === 'ready' && (
            <button onClick={() => onGenerateOne(shot.id)} style={generateBtn}>
              Generate
            </button>
          )}
          {shot.boardStatus === 'review' && (
            <button onClick={() => onApprove(shot.id)} style={saveBtn}>
              Approve
            </button>
          )}
          {(shot.boardStatus === 'review' || shot.boardStatus === 'done' || shot.boardStatus === 'backlog') && (
            <button onClick={() => onMoveToReady(shot.id)} style={secondaryBtn}>
              Move Ready
            </button>
          )}
          {shot.boardStatus === 'generating' && (
            <span style={{ fontSize: 11, color: 'var(--scene-heading)', fontWeight: 600 }}>In Queue</span>
          )}
        </div>
      </div>
    </div>
  );
}

function getEmotionColor(valence: number): string {
  if (valence >= 3) return 'var(--emotion-very-positive)';
  if (valence >= 1) return 'var(--emotion-positive)';
  if (valence >= -1) return 'var(--emotion-neutral)';
  if (valence >= -3) return 'var(--emotion-negative)';
  return 'var(--emotion-very-negative)';
}

const baseActionBtn: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 11,
  borderRadius: 'var(--radius-sm)',
  fontWeight: 700,
  cursor: 'pointer',
};

const saveBtn: React.CSSProperties = {
  ...baseActionBtn,
  border: '1px solid var(--success)',
  background: 'var(--success)',
  color: 'var(--on-bright)',
};

const generateBtn: React.CSSProperties = {
  ...baseActionBtn,
  border: '1px solid var(--emotion-very-positive)',
  background: 'var(--emotion-very-positive)',
  color: 'var(--on-bright)',
};

const secondaryBtn: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 11,
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
};
