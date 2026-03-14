/**
 * Storyboard Screen
 *
 * Visual timeline of all shots across all scenes. Displays shots as cards
 * in sequence order, grouped by scene, with drag-reorder support planned.
 * Each card shows the shot type, duration, psychology annotation, and
 * a preview of the rendered prompt.
 */

import { useState } from 'react';
import { useProjectStore } from '../stores/project-store';
import type { Shot, Scene } from '../types/scene';

export function Storyboard() {
  const scenes = useProjectStore((s) => s.project.scenes);
  const globalStyle = useProjectStore((s) => s.project.globalStyle);
  const setSelectedScene = useProjectStore((s) => s.setSelectedScene);
  const setActiveScreen = useProjectStore((s) => s.setActiveScreen);
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const [hoveredShot, setHoveredShot] = useState<string | null>(null);

  const totalShots = scenes.reduce((sum, s) => sum + s.shots.length, 0);
  const totalDuration = scenes.reduce(
    (sum, s) => sum + s.shots.reduce((ss, sh) => ss + sh.durationSeconds, 0),
    0
  );

  const handleNavigateToShot = (sceneIndex: number) => {
    setSelectedScene(sceneIndex);
    setActiveScreen('shots');
  };

  if (scenes.length === 0) {
    return (
      <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ marginBottom: 20 }}>Storyboard</h2>
        <div className="empty-state" style={{ padding: 48, flex: 1 }}>
          <h3>No Scenes Available</h3>
          <p style={{ marginTop: 8 }}>
            Parse a screenplay and generate shots first to see the storyboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Storyboard</h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {scenes.length} scenes | {totalShots} shots | {formatDuration(totalDuration)} total
            {globalStyle.aspectRatio && ` | ${globalStyle.aspectRatio}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setViewMode('timeline')}
            style={{
              ...viewBtn,
              background: viewMode === 'timeline' ? 'var(--accent)' : 'var(--bg-tertiary)',
            }}
          >
            Timeline
          </button>
          <button
            onClick={() => setViewMode('grid')}
            style={{
              ...viewBtn,
              background: viewMode === 'grid' ? 'var(--accent)' : 'var(--bg-tertiary)',
            }}
          >
            Grid
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: viewMode === 'timeline' ? 'auto' : 'hidden' }}>
        {viewMode === 'timeline' ? (
          <TimelineView
            scenes={scenes}
            hoveredShot={hoveredShot}
            setHoveredShot={setHoveredShot}
            onNavigate={handleNavigateToShot}
          />
        ) : (
          <GridView
            scenes={scenes}
            hoveredShot={hoveredShot}
            setHoveredShot={setHoveredShot}
            onNavigate={handleNavigateToShot}
          />
        )}
      </div>
    </div>
  );
}

// ─── Timeline View ───────────────────────────────────────

function TimelineView({
  scenes,
  hoveredShot,
  setHoveredShot,
  onNavigate,
}: {
  scenes: Scene[];
  hoveredShot: string | null;
  setHoveredShot: (id: string | null) => void;
  onNavigate: (sceneIndex: number) => void;
}) {
  return (
    <div>
      {scenes.map((scene, sceneIdx) => (
        <div key={scene.id} style={{ marginBottom: 24 }}>
          {/* Scene header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 8,
              cursor: 'pointer',
            }}
            onClick={() => onNavigate(sceneIdx)}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {sceneIdx + 1}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {scene.heading.prefix}. {scene.heading.location}
                {scene.heading.time ? ` - ${scene.heading.time}` : ''}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {scene.shots.length} shot{scene.shots.length !== 1 ? 's' : ''} |{' '}
                {formatDuration(scene.shots.reduce((s, sh) => s + sh.durationSeconds, 0))}
              </div>
            </div>
          </div>

          {/* Shot cards in a horizontal strip */}
          {scene.shots.length === 0 ? (
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                border: '1px dashed var(--border)',
                borderRadius: 6,
                fontSize: 12,
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              No shots designed yet
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {scene.shots.map((shot, shotIdx) => (
                <ShotCard
                  key={shot.id}
                  shot={shot}
                  shotIndex={shotIdx}
                  isHovered={hoveredShot === shot.id}
                  onHover={() => setHoveredShot(shot.id)}
                  onLeave={() => setHoveredShot(null)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Grid View ───────────────────────────────────────────

function GridView({
  scenes,
  hoveredShot,
  setHoveredShot,
  onNavigate,
}: {
  scenes: Scene[];
  hoveredShot: string | null;
  setHoveredShot: (id: string | null) => void;
  onNavigate: (sceneIndex: number) => void;
}) {
  return (
    <div>
      {scenes.map((scene, sceneIdx) => (
        <div key={scene.id} style={{ marginBottom: 24 }}>
          <div
            style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, cursor: 'pointer' }}
            onClick={() => onNavigate(sceneIdx)}
          >
            Scene {sceneIdx + 1}: {scene.heading.prefix}. {scene.heading.location}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 8,
            }}
          >
            {scene.shots.map((shot, shotIdx) => (
              <ShotCard
                key={shot.id}
                shot={shot}
                shotIndex={shotIdx}
                isHovered={hoveredShot === shot.id}
                onHover={() => setHoveredShot(shot.id)}
                onLeave={() => setHoveredShot(null)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Shot Card ───────────────────────────────────────────

function ShotCard({
  shot,
  shotIndex,
  isHovered,
  onHover,
  onLeave,
}: {
  shot: Shot;
  shotIndex: number;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const emotionColor = getEmotionColor(shot.psychology.valence);
  const hasGenerations = shot.generations.length > 0;
  const isComplete = shot.generations.some((g) => g.status === 'completed');

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        minWidth: 180,
        background: isHovered ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
        border: `1px solid ${isHovered ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 8,
        padding: 10,
        transition: 'all 0.15s ease',
        position: 'relative',
      }}
    >
      {/* Status indicator */}
      <div
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: isComplete ? '#4ade80' : hasGenerations ? '#60a5fa' : '#555',
        }}
        title={isComplete ? 'Generated' : hasGenerations ? 'In progress' : 'Not submitted'}
      />

      {/* Shot header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
          Shot {shotIndex + 1}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {shot.durationSeconds}s
        </div>
      </div>

      {/* Camera info */}
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
        {shot.prompt.camera.shotType} | {shot.prompt.camera.movement}
      </div>

      {/* Action */}
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          marginBottom: 6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {shot.prompt.subject.action}
      </div>

      {/* Psychology bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 9,
            padding: '1px 5px',
            borderRadius: 3,
            background: emotionColor,
            color: '#000',
            fontWeight: 600,
          }}
        >
          {shot.psychology.targetEmotion}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
          A:{shot.psychology.arousalLevel} V:{shot.psychology.valence > 0 ? '+' : ''}{shot.psychology.valence}
        </span>
      </div>

      {/* Dialogue indicator */}
      {shot.prompt.audio.dialogue.length > 0 && (
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
          {shot.prompt.audio.dialogue.map((d) => d.characterName).join(', ')}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────

function getEmotionColor(valence: number): string {
  if (valence >= 3) return '#4ade80';
  if (valence >= 1) return '#86efac';
  if (valence >= -1) return '#fbbf24';
  if (valence >= -3) return '#fb923c';
  return '#f87171';
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const viewBtn: React.CSSProperties = {
  padding: '6px 12px',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};
