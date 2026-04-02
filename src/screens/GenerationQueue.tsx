import { useEffect, useState } from 'react';
import { useGenerationStore } from '../stores/generation-store';
import { useProjectStore } from '../stores/project-store';
import { fetchVideoAsBlob, downloadVideoFile } from '../services/video-download';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

const STATUS_COLORS: Record<string, string> = {
  queued: 'var(--text-muted)',
  submitting: 'var(--emotion-neutral)',
  submitted: 'var(--status-active)',
  polling: 'var(--status-active)',
  downloading: 'var(--film-secondary-400)',
  completed: 'var(--emotion-very-positive)',
  failed: 'var(--transition)',
};

export function GenerationQueue() {
  const jobs = useGenerationStore((s) => s.jobs);
  const deadLetters = useGenerationStore((s) => s.deadLetters);
  const stats = useGenerationStore((s) => s.stats);
  const refreshJobs = useGenerationStore((s) => s.refreshJobs);
  const cancelJob = useGenerationStore((s) => s.cancelJob);
  const clearFinished = useGenerationStore((s) => s.clearFinished);
  const clearDeadLetters = useGenerationStore((s) => s.clearDeadLetters);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const result = refreshJobs() as unknown;
    const done = () => setLoading(false);
    if (result instanceof Promise) {
      result.then(done, done);
    } else {
      done();
    }
  }, [refreshJobs]);

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Generation Queue</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refreshJobs} style={toolbarBtn}>
            Refresh
          </button>
          <button onClick={clearFinished} style={toolbarBtn}>
            Clear Finished
          </button>
          <button onClick={clearDeadLetters} style={toolbarBtn}>
            Clear Dead Letter
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Queued" value={stats.queued} color="var(--text-muted)" />
        <StatCard label="Active" value={stats.active} color="var(--status-active)" />
        <StatCard label="Completed" value={stats.completed} color="var(--emotion-very-positive)" />
        <StatCard label="Failed" value={stats.failed} color="var(--transition)" />
        <StatCard label="Dead Letter" value={stats.deadLettered} color="var(--status-dead-letter)" />
        <StatCard label="Cost" value={`$${stats.totalCostUsd.toFixed(2)}`} color="var(--emotion-neutral)" />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <LoadingSkeleton height={44} />
            <LoadingSkeleton height={44} />
            <LoadingSkeleton height={44} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty-state" style={{ padding: 48 }}>
            <h3>No Generation Jobs</h3>
            <p style={{ marginTop: 8 }}>
              Generate shots from the Shot Designer, then submit them here for video generation.
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={thStyle}>Shot</th>
                <th style={thStyle}>Platform</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Cost</th>
                <th style={thStyle}>Submitted</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500 }}>
                      {job.shot.prompt.camera.shotType}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {job.shot.prompt.subject.action.slice(0, 60)}
                      {job.shot.prompt.subject.action.length > 60 ? '...' : ''}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span className="badge">{job.platform}</span>
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        color: STATUS_COLORS[job.status] || 'var(--text-muted)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        fontSize: 11,
                      }}
                    >
                      {job.status}
                    </span>
                    {job.error && (
                      <div style={{ fontSize: 11, color: 'var(--transition)', marginTop: 2, maxWidth: 400, wordBreak: 'break-word' }}>
                        {job.error}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {job.generation
                      ? `$${job.generation.costEstimate.toFixed(2)}`
                      : '--'}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 11 }}>
                      {new Date(job.createdAt).toLocaleTimeString()}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {job.status === 'queued' && (
                      <button
                        onClick={() => cancelJob(job.id)}
                        style={{ ...toolbarBtn, fontSize: 11, padding: '4px 8px' }}
                      >
                        Cancel
                      </button>
                    )}
                    {job.status === 'completed' && job.generation?.outputPath && (
                      <VideoActions outputPath={job.generation.outputPath} shotId={job.shot.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deadLetters.length > 0 && (
        <details style={{ marginTop: 16, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
            Dead Letter Queue ({deadLetters.length})
          </summary>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {deadLetters.slice(0, 20).map((entry) => (
              <div
                key={entry.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: 8,
                  fontSize: 12,
                  background: 'var(--bg-primary)',
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {entry.job.platform} | {entry.job.shot.prompt.camera.shotType}
                </div>
                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                  Retry count: {entry.retryCount}
                </div>
                <div style={{ color: 'var(--transition)', marginTop: 2, wordBreak: 'break-word' }}>
                  {entry.reason}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function VideoActions({ outputPath, shotId }: { outputPath: string; shotId: string }) {
  const apiKey = useProjectStore((s) => s.project.settings.apiKeys['gemini']);
  const requiresGeminiAuth = outputPath.includes('generativelanguage.googleapis.com');
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleView = async () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
      return;
    }
    if (requiresGeminiAuth && !apiKey) {
      setError('No Gemini API key');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = await fetchVideoAsBlob(outputPath, requiresGeminiAuth ? apiKey : undefined);
      setBlobUrl(url);
      window.open(url, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (requiresGeminiAuth && !apiKey) return;
    setLoading(true);
    try {
      const url = blobUrl || await fetchVideoAsBlob(outputPath, requiresGeminiAuth ? apiKey : undefined);
      setBlobUrl(url);
      downloadVideoFile(url, `shot_${shotId}.mp4`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={handleView}
          disabled={loading}
          style={{ ...toolbarBtn, fontSize: 11, padding: '4px 8px', background: 'var(--accent)', color: 'var(--text-on-accent)' }}
        >
          {loading ? 'Loading...' : 'View'}
        </button>
        <button
          onClick={handleDownload}
          disabled={loading}
          style={{ ...toolbarBtn, fontSize: 11, padding: '4px 8px' }}
        >
          Save
        </button>
      </div>
      {error && <div style={{ fontSize: 10, color: 'var(--transition)' }}>{error}</div>}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '12px 16px',
        minWidth: 80,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11,
  color: 'var(--text-muted)',
  fontWeight: 500,
  textTransform: 'uppercase',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
};

const toolbarBtn: React.CSSProperties = {
  padding: '6px 12px',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
};
