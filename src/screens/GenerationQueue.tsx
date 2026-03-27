import { useEffect, useState } from 'react';
import { useGenerationStore } from '../stores/generation-store';
import { useProjectStore } from '../stores/project-store';
import { fetchVideoAsBlob, downloadVideoFile } from '../services/video-download';

const STATUS_COLORS: Record<string, string> = {
  queued: '#888',
  submitting: '#fbbf24',
  submitted: '#60a5fa',
  polling: '#60a5fa',
  downloading: '#a78bfa',
  completed: '#4ade80',
  failed: '#f87171',
};

export function GenerationQueue() {
  const jobs = useGenerationStore((s) => s.jobs);
  const deadLetters = useGenerationStore((s) => s.deadLetters);
  const stats = useGenerationStore((s) => s.stats);
  const refreshJobs = useGenerationStore((s) => s.refreshJobs);
  const cancelJob = useGenerationStore((s) => s.cancelJob);
  const clearFinished = useGenerationStore((s) => s.clearFinished);
  const clearDeadLetters = useGenerationStore((s) => s.clearDeadLetters);

  useEffect(() => {
    refreshJobs();
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
        <StatCard label="Queued" value={stats.queued} color="#888" />
        <StatCard label="Active" value={stats.active} color="#60a5fa" />
        <StatCard label="Completed" value={stats.completed} color="#4ade80" />
        <StatCard label="Failed" value={stats.failed} color="#f87171" />
        <StatCard label="Dead Letter" value={stats.deadLettered} color="#fb7185" />
        <StatCard label="Cost" value={`$${stats.totalCostUsd.toFixed(2)}`} color="#fbbf24" />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {jobs.length === 0 ? (
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
                        color: STATUS_COLORS[job.status] || '#888',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        fontSize: 11,
                      }}
                    >
                      {job.status}
                    </span>
                    {job.error && (
                      <div style={{ fontSize: 11, color: '#f87171', marginTop: 2, maxWidth: 400, wordBreak: 'break-word' }}>
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
                <div style={{ color: '#f87171', marginTop: 2, wordBreak: 'break-word' }}>
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
          style={{ ...toolbarBtn, fontSize: 11, padding: '4px 8px', background: 'var(--accent)', color: '#fff' }}
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
      {error && <div style={{ fontSize: 10, color: '#f87171' }}>{error}</div>}
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
