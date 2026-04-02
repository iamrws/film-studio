/**
 * Emotional Arc Visualizer
 *
 * Displays the emotional trajectory across scenes using a canvas-based
 * line graph. Shows valence and arousal curves, story shape overlay,
 * and excitation transfer validation between scenes.
 *
 * Based on Reagan et al. (2016) — 6 validated story shapes.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useProjectStore } from '../stores/project-store';
import { analyzeEmotionalArc, type EmotionalArcAnalysis } from '../services/llm-service';

const STORY_SHAPE_LABELS: Record<string, { label: string; description: string; cssVar: string; fallback: string }> = {
  rags_to_riches: { label: 'Rags to Riches', description: 'Steady emotional rise', cssVar: '--shape-rags-to-riches', fallback: '#4ade80' },
  tragedy: { label: 'Tragedy', description: 'Steady emotional fall', cssVar: '--shape-tragedy', fallback: '#f87171' },
  man_in_a_hole: { label: 'Man in a Hole', description: 'Fall then rise (most common)', cssVar: '--shape-man-in-a-hole', fallback: '#60a5fa' },
  icarus: { label: 'Icarus', description: 'Rise then fall', cssVar: '--shape-icarus', fallback: '#fbbf24' },
  cinderella: { label: 'Cinderella', description: 'Rise, fall, rise (most commercially successful)', cssVar: '--shape-cinderella', fallback: '#a78bfa' },
  oedipus: { label: 'Oedipus', description: 'Fall, rise, fall (darkest arc)', cssVar: '--shape-oedipus', fallback: '#fb923c' },
};

export function EmotionalArc() {
  const scenes = useProjectStore((s) => s.project.scenes);
  const settings = useProjectStore((s) => s.project.settings);
  const [analysis, setAnalysis] = useState<EmotionalArcAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleAnalyze = useCallback(async () => {
    if (scenes.length === 0) return;

    const apiKey = settings.apiKeys[settings.llmProvider];
    if (!apiKey) {
      setError(`No API key for ${settings.llmProvider}. Go to Settings.`);
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeEmotionalArc(scenes, {
        provider: settings.llmProvider,
        apiKey,
      });
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }, [scenes, settings]);

  // Draw the arc graph
  useEffect(() => {
    if (!analysis || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resolve CSS custom properties via a probe element so the canvas
    // respects the active light/dark theme.
    const probe = document.createElement('div');
    probe.style.display = 'none';
    document.body.appendChild(probe);
    const resolveCssColor = (varName: string, alpha?: number): string => {
      probe.style.color = `var(${varName})`;
      const resolved = getComputedStyle(probe).color;
      if (alpha != null) {
        const match = resolved.match(/\d+/g);
        if (match) return `rgba(${match[0]}, ${match[1]}, ${match[2]}, ${alpha})`;
      }
      return resolved;
    };
    const bgColor = resolveCssColor('--bg-primary');
    const gridColor = resolveCssColor('--border');
    const zeroLineColor = resolveCssColor('--text-muted');
    const labelColor = resolveCssColor('--text-muted');
    const legendTextColor = resolveCssColor('--text-secondary');
    const valenceColor = resolveCssColor('--accent');
    const arousalColor = resolveCssColor('--transition');
    probe.remove();

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    // Clear
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    const padding = { top: 30, right: 20, bottom: 40, left: 50 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;
    const data = analysis.sceneAnalysis;
    if (data.length === 0) return;

    // Grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    for (let v = -5; v <= 5; v += 2.5) {
      const y = padding.top + plotH * (1 - (v + 5) / 10);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillStyle = labelColor;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(v.toString(), padding.left - 6, y + 3);
    }

    // Zero line
    const zeroY = padding.top + plotH * 0.5;
    ctx.strokeStyle = zeroLineColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(w - padding.right, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // X labels
    ctx.fillStyle = labelColor;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    data.forEach((d, i) => {
      const x = padding.left + (i / Math.max(data.length - 1, 1)) * plotW;
      ctx.fillText(`S${d.sceneIndex + 1}`, x, h - padding.bottom + 16);
    });

    // Valence line
    ctx.strokeStyle = valenceColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = padding.left + (i / Math.max(data.length - 1, 1)) * plotW;
      const y = padding.top + plotH * (1 - (d.valence + 5) / 10);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Valence dots
    data.forEach((d, i) => {
      const x = padding.left + (i / Math.max(data.length - 1, 1)) * plotW;
      const y = padding.top + plotH * (1 - (d.valence + 5) / 10);
      ctx.fillStyle = getValenceColor(d.valence);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Arousal line (scaled to same range: 1-10 → -5 to 5)
    ctx.strokeStyle = resolveCssColor('--transition', 0.5);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = padding.left + (i / Math.max(data.length - 1, 1)) * plotW;
      const normalizedArousal = (d.arousal - 1) / 9 * 10 - 5; // Map 1-10 to -5..5
      const y = padding.top + plotH * (1 - (normalizedArousal + 5) / 10);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    ctx.fillStyle = valenceColor;
    ctx.fillRect(w - 140, 10, 12, 12);
    ctx.fillStyle = legendTextColor;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Valence', w - 124, 20);

    ctx.fillStyle = arousalColor;
    ctx.fillRect(w - 140, 28, 12, 12);
    ctx.fillStyle = legendTextColor;
    ctx.fillText('Arousal', w - 124, 38);

    // Axis labels
    ctx.fillStyle = labelColor;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Scenes', w / 2, h - 4);
    ctx.save();
    ctx.translate(12, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Emotional Value', 0, 0);
    ctx.restore();
  }, [analysis]);

  const shapeInfo = analysis?.storyShape
    ? STORY_SHAPE_LABELS[analysis.storyShape]
    : null;

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Emotional Arc</h2>
        <button
          onClick={handleAnalyze}
          disabled={analyzing || scenes.length === 0}
          style={{
            padding: '8px 16px',
            background: analyzing ? 'var(--bg-disabled)' : 'var(--accent)',
            color: 'var(--text-on-accent)',
            border: 'none',
            borderRadius: 6,
            cursor: analyzing || scenes.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: 13,
          }}
        >
          {analyzing ? 'Analyzing...' : 'Analyze Emotional Arc'}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            background: 'var(--error-subtle-bg)',
            border: '1px solid var(--transition)',
            borderRadius: 6,
            color: 'var(--transition)',
            fontSize: 12,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {scenes.length === 0 ? (
        <div className="empty-state" style={{ padding: 48, flex: 1 }}>
          <h3>No Scenes Parsed</h3>
          <p style={{ marginTop: 8 }}>Parse a screenplay first to analyze its emotional arc.</p>
        </div>
      ) : !analysis ? (
        <div className="empty-state" style={{ padding: 48, flex: 1 }}>
          <h3>Ready to Analyze</h3>
          <p style={{ marginTop: 8 }}>
            {scenes.length} scenes loaded. Click "Analyze Emotional Arc" to map the<br />
            story shape and emotional trajectory using the Psychology Engine.
          </p>
          <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {Object.entries(STORY_SHAPE_LABELS).map(([key, info]) => (
              <div
                key={key}
                style={{
                  padding: '6px 12px',
                  background: `color-mix(in srgb, var(${info.cssVar}, ${info.fallback}) 15%, transparent)`,
                  border: `1px solid color-mix(in srgb, var(${info.cssVar}, ${info.fallback}) 40%, transparent)`,
                  borderRadius: 6,
                  fontSize: 11,
                }}
              >
                <span style={{ color: `var(${info.cssVar}, ${info.fallback})`, fontWeight: 600 }}>{info.label}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{info.description}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Story shape badge */}
          {shapeInfo && (
            <div
              style={{
                display: 'flex',
                gap: 16,
                marginBottom: 20,
                padding: 16,
                background: `color-mix(in srgb, var(${shapeInfo.cssVar}, ${shapeInfo.fallback}) 10%, transparent)`,
                border: `1px solid color-mix(in srgb, var(${shapeInfo.cssVar}, ${shapeInfo.fallback}) 40%, transparent)`,
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: `var(${shapeInfo.cssVar}, ${shapeInfo.fallback})` }}>
                  {shapeInfo.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {shapeInfo.description}
                </div>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: `var(${shapeInfo.cssVar}, ${shapeInfo.fallback})` }}>
                  {Math.round(analysis.confidence * 100)}%
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>confidence</div>
              </div>
            </div>
          )}

          {/* Rationale */}
          {analysis.rationale && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {analysis.rationale}
            </div>
          )}

          {/* Canvas graph */}
          <div
            style={{
              flex: 1,
              minHeight: 250,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 8,
              marginBottom: 16,
            }}
          >
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`Emotional arc graph showing valence and arousal across ${analysis?.sceneAnalysis.length ?? 0} scenes. Story shape: ${shapeInfo?.label ?? 'unknown'}.`}
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          {/* Per-scene breakdown */}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={thS}>Scene</th>
                  <th style={thS}>Valence</th>
                  <th style={thS}>Arousal</th>
                  <th style={thS}>Emotion</th>
                  <th style={thS}>Excitation Transfer</th>
                </tr>
              </thead>
              <tbody>
                {analysis.sceneAnalysis.map((sa, i) => {
                  const prev = i > 0 ? analysis.sceneAnalysis[i - 1] : null;
                  const arousalDelta = prev ? sa.arousal - prev.arousal : 0;
                  const transferRisk =
                    prev && Math.abs(arousalDelta) >= 5;

                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdS}>Scene {sa.sceneIndex + 1}</td>
                      <td style={tdS}>
                        <span
                          aria-hidden="true"
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: getValenceColor(sa.valence),
                            marginRight: 6,
                          }}
                        />
                        {sa.valence > 0 ? '+' : ''}{sa.valence}
                      </td>
                      <td style={tdS}>{sa.arousal}/10</td>
                      <td style={tdS}>{sa.dominantEmotion}</td>
                      <td style={tdS}>
                        {transferRisk ? (
                          <span style={{ color: 'var(--emotion-neutral)', fontWeight: 600, fontSize: 11 }}>
                            Excitation transfer active (delta: {arousalDelta > 0 ? '+' : ''}{arousalDelta})
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function getValenceColor(valence: number): string {
  if (valence >= 3) return 'var(--emotion-very-positive)';
  if (valence >= 1) return 'var(--emotion-positive)';
  if (valence >= -1) return 'var(--emotion-neutral)';
  if (valence >= -3) return 'var(--emotion-negative)';
  return 'var(--transition)';
}

const thS: React.CSSProperties = {
  padding: '6px 10px',
  textAlign: 'left',
  color: 'var(--text-muted)',
  fontWeight: 500,
  fontSize: 11,
  textTransform: 'uppercase',
};

const tdS: React.CSSProperties = {
  padding: '8px 10px',
};
