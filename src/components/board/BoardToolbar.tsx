import type { PlatformId } from '../../types/scene';
import { PLATFORM_OPTIONS } from './board-config';

interface BoardToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  groupByScene: boolean;
  onToggleGroupByScene: () => void;
  readyCount: number;
  selectedCount: number;
  bulkPlatform: PlatformId;
  onBulkPlatformChange: (platform: PlatformId) => void;
  onApplyBulkPlatform: () => void;
  onSelectAllReady: () => void;
  onClearSelection: () => void;
  onGenerateAll: () => void;
  statusMessage: string | null;
  statusTone: 'success' | 'error' | null;
}

export function BoardToolbar({
  searchQuery,
  onSearchQueryChange,
  groupByScene,
  onToggleGroupByScene,
  readyCount,
  selectedCount,
  bulkPlatform,
  onBulkPlatformChange,
  onApplyBulkPlatform,
  onSelectAllReady,
  onClearSelection,
  onGenerateAll,
  statusMessage,
  statusTone,
}: BoardToolbarProps) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--bg-secondary)',
        padding: 12,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search camera/action/emotion..."
          style={{
            minWidth: 220,
            flex: 1,
            padding: '7px 10px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-primary)',
            fontSize: 12,
          }}
        />

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
        >
          <input type="checkbox" checked={groupByScene} onChange={onToggleGroupByScene} />
          Group by scene
        </label>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            value={bulkPlatform}
            onChange={(e) => onBulkPlatformChange(e.target.value as PlatformId)}
            style={selectStyle}
          >
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <button onClick={onApplyBulkPlatform} style={secondaryButton}>
            Apply Platform
          </button>
        </div>

        <button onClick={onSelectAllReady} style={secondaryButton}>
          Select Ready ({readyCount})
        </button>
        <button onClick={onClearSelection} style={secondaryButton}>
          Clear Selection
        </button>
        <button onClick={onGenerateAll} style={primaryButton}>
          Generate {selectedCount > 0 ? `Selected (${selectedCount})` : 'All Ready'}
        </button>
      </div>

      {statusMessage && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: statusTone === 'error' ? '#f87171' : '#4ade80',
          }}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '7px 10px',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: 12,
};

const secondaryButton: React.CSSProperties = {
  padding: '7px 10px',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: 12,
};

const primaryButton: React.CSSProperties = {
  padding: '7px 12px',
  background: '#4ade80',
  border: '1px solid #4ade80',
  borderRadius: 6,
  color: '#0f172a',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
};