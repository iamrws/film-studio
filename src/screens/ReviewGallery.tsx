import { useMemo, useState, useEffect } from 'react';
import { useGenerationStore } from '../stores/generation-store';
import { useProjectStore } from '../stores/project-store';
import { fetchVideoAsBlob, downloadVideoFile } from '../services/video-download';
import type { QueuedJob } from '../services/generation-queue';

export function ReviewGallery() {
  const jobs = useGenerationStore((s) => s.jobs);

  const completedJobs = useMemo(
    () => jobs.filter((j) => j.status === 'completed' && j.generation?.outputPath),
    [jobs]
  );

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <h2 style={{ marginBottom: 20 }}>Review Gallery</h2>

      {completedJobs.length === 0 ? (
        <div className="empty-state" style={{ padding: 48 }}>
          <h3>No Completed Generations</h3>
          <p style={{ marginTop: 8 }}>
            Completed video generations will appear here for review, rating, and approval.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {completedJobs.map((job) => (
            <ReviewCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ job }: { job: QueuedJob }) {
  const veoApiKey = useProjectStore((s) => s.project.settings.apiKeys['gemini']);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const outputPath = job.generation?.outputPath;
  const requiresGeminiAuth = Boolean(
    outputPath && outputPath.includes('generativelanguage.googleapis.com')
  );

  // Auto-fetch video on mount
  useEffect(() => {
    if (!outputPath) return;
    if (requiresGeminiAuth && !veoApiKey) return;
    let cancelled = false;
    fetchVideoAsBlob(outputPath, requiresGeminiAuth ? veoApiKey : undefined)
      .then((url) => {
        if (!cancelled) setBlobUrl(url);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, [outputPath, requiresGeminiAuth, veoApiKey]);

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Video preview */}
      <div
        style={{
          aspectRatio: '16/9',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {blobUrl ? (
          <video
            src={blobUrl}
            controls
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : outputPath && (!requiresGeminiAuth || Boolean(veoApiKey)) && !error ? (
          <div style={{ color: '#888', fontSize: 12 }}>Loading video...</div>
        ) : error ? (
          <div style={{ color: '#f87171', fontSize: 12, padding: 16, textAlign: 'center' }}>
            {error}
          </div>
        ) : (
          <div style={{ color: '#666', fontSize: 12 }}>No video available</div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {job.shot.prompt.camera.shotType} — {job.shot.durationSeconds}s
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          {job.shot.prompt.subject.action.slice(0, 100)}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 8,
            alignItems: 'center',
          }}
        >
          <span className="badge">{job.platform}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            ${job.generation?.costEstimate.toFixed(2)}
          </span>
          <span style={{ flex: 1 }} />

          {/* Rating stars */}
          <div style={{ display: 'flex', gap: 2 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                style={{
                  cursor: 'pointer',
                  fontSize: 16,
                  color: (job.generation?.rating || 0) >= star ? '#fbbf24' : '#444',
                }}
              >
                ★
              </span>
            ))}
          </div>
        </div>

        {/* Prompt preview */}
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
            View prompt
          </summary>
          <pre
            style={{
              fontSize: 10,
              color: 'var(--text-secondary)',
              marginTop: 4,
              whiteSpace: 'pre-wrap',
              maxHeight: 120,
              overflowY: 'auto',
            }}
          >
            {job.generation?.promptUsed}
          </pre>
        </details>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button style={actionBtn('#4ade80')}>Approve</button>
          <button style={actionBtn('#f87171')}>Reject</button>
          <button style={actionBtn('#60a5fa')}>Regenerate</button>
          {blobUrl && (
            <button
              style={actionBtn('#fbbf24')}
              onClick={() => downloadVideoFile(blobUrl, `shot_${job.shot.id}.mp4`)}
            >
              Download
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function actionBtn(color: string): React.CSSProperties {
  return {
    flex: 1,
    padding: '6px 0',
    background: 'transparent',
    color,
    border: `1px solid ${color}40`,
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
  };
}
