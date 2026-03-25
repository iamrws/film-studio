import { useState, useCallback } from 'react';
import { useProjectStore } from '../stores/project-store';
import { generateBRollPrompt } from '../services/llm-service';
import type { BRollClip } from '../types/project';

const BROLL_PRESETS = [
  { label: 'Beach Waves', category: 'beaches', description: 'Gentle ocean waves rolling onto a sandy beach at golden hour, foam dissolving into wet sand' },
  { label: 'City Skyline', category: 'cities', description: 'Sweeping aerial view of a modern city skyline at twilight, lights flickering on across skyscrapers' },
  { label: 'Skyscrapers', category: 'skyscrapers', description: 'Looking straight up at glass skyscrapers converging toward the sky, clouds reflecting off facades' },
  { label: 'Music Festival', category: 'festivals', description: 'Wide aerial shot of a massive outdoor music festival, colorful stage lights pulsing over a sea of people' },
  { label: 'Mountain Peaks', category: 'mountains', description: 'Dramatic mountain range at sunrise with mist rolling through valleys, snow-capped peaks catching first light' },
  { label: 'Cycling', category: 'bikes', description: 'Close tracking shot of bicycle wheels spinning on a sun-dappled forest trail, leaves scattered on the path' },
  { label: 'Forest Hike', category: 'hikes', description: 'Steadicam following a trail through ancient forest, shafts of light cutting through the canopy' },
  { label: 'Books & Reading', category: 'books', description: 'Macro shot of pages turning in an old leather-bound book, warm lamplight casting soft shadows' },
  { label: 'Pets', category: 'pets', description: 'A golden retriever bounding through a meadow of wildflowers in slow motion, ears flapping' },
  { label: 'Rainy Window', category: 'weather', description: 'Rain droplets streaming down a window pane with blurred city lights bokeh in the background' },
  { label: 'Coffee Shop', category: 'lifestyle', description: 'Steam rising from a freshly poured latte in a cozy cafe, soft morning light through frosted glass' },
  { label: 'Ocean Aerial', category: 'beaches', description: 'Drone shot directly above turquoise ocean water, waves creating white fractal patterns on the shore' },
  { label: 'Night Traffic', category: 'cities', description: 'Timelapse of car headlights and taillights streaking through a downtown intersection at night' },
  { label: 'Sunset Clouds', category: 'nature', description: 'Timelapse of dramatic cloud formations painted in orange, pink, and purple during sunset' },
  { label: 'Autumn Leaves', category: 'nature', description: 'Slow-motion close-up of golden autumn leaves falling from a tree, backlit by warm afternoon sun' },
  { label: 'Street Food', category: 'lifestyle', description: 'Close-up of sizzling street food on a hot grill at a night market, steam and sparks rising' },
] as const;

const STYLE_OPTIONS = [
  'Cinematic', 'Documentary', 'Dreamy', 'Moody', 'Vibrant',
  'Vintage Film', 'Drone Footage', 'Slow Motion', 'Timelapse', 'Minimalist',
] as const;

export function BRollStudio() {
  const settings = useProjectStore((s) => s.project.settings);
  const bRollClips = useProjectStore((s) => s.project.bRollClips || []);
  const addBRollClip = useProjectStore((s) => s.addBRollClip);
  const removeBRollClip = useProjectStore((s) => s.removeBRollClip);

  const [description, setDescription] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedClipId, setExpandedClipId] = useState<string | null>(null);

  const handleGenerate = useCallback(async (desc: string, category?: string) => {
    if (!desc.trim()) return;

    const apiKey = settings.apiKeys[settings.llmProvider];
    if (!apiKey) {
      setError(`No API key set for ${settings.llmProvider}. Go to Settings to add one.`);
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const result = await generateBRollPrompt(
        {
          description: desc.trim(),
          category,
          style: selectedStyle || undefined,
        },
        { provider: settings.llmProvider, apiKey }
      );

      const clip: BRollClip = {
        id: crypto.randomUUID(),
        description: desc.trim(),
        category: category || 'custom',
        generatedPrompt: result.prompt + '\n\nNegative: ' + result.negativePrompt,
        platform: settings.defaultPlatform,
        status: 'ready',
        createdAt: new Date().toISOString(),
      };

      addBRollClip(clip);
      setDescription('');
      setExpandedClipId(clip.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }, [settings, selectedStyle, addBRollClip]);

  const handlePresetClick = useCallback((preset: typeof BROLL_PRESETS[number]) => {
    handleGenerate(preset.description, preset.category);
  }, [handleGenerate]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left Panel — Input */}
      <div style={{
        width: 420,
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 0' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>B-Roll Studio</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Generate cinematic B-roll footage prompts. Zero dialogue — pure visuals.
          </p>
        </div>

        {/* Custom Description */}
        <div style={{ padding: '0 20px', marginBottom: 16 }}>
          <label style={labelStyle}>Describe your scene</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A drone slowly orbiting a lighthouse on a rocky cliff during a storm, waves crashing below, dark moody sky..."
            rows={4}
            style={{
              ...inputStyle,
              width: '100%',
              resize: 'vertical',
              fontSize: 13,
              lineHeight: '1.5',
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
            {description.length > 0 ? `${description.split(/\s+/).filter(Boolean).length} words` : 'Be as descriptive as you want'}
          </div>
        </div>

        {/* Style Selector */}
        <div style={{ padding: '0 20px', marginBottom: 16 }}>
          <label style={labelStyle}>Visual style (optional)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STYLE_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedStyle(selectedStyle === s ? '' : s)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  borderRadius: 4,
                  border: `1px solid ${selectedStyle === s ? 'var(--accent)' : 'var(--border)'}`,
                  background: selectedStyle === s ? 'var(--accent)' : 'var(--bg-primary)',
                  color: selectedStyle === s ? '#fff' : 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <div style={{ padding: '0 20px', marginBottom: 20 }}>
          {error && (
            <div style={{
              padding: '8px 12px',
              background: '#f8717120',
              border: '1px solid #f87171',
              borderRadius: 6,
              color: '#f87171',
              fontSize: 12,
              marginBottom: 12,
            }}>
              {error}
            </div>
          )}
          <button
            onClick={() => handleGenerate(description)}
            disabled={generating || !description.trim()}
            style={{
              width: '100%',
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 8,
              border: 'none',
              background: generating || !description.trim() ? '#555' : 'var(--accent)',
              color: '#fff',
              cursor: generating || !description.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? 'Crafting B-Roll prompt...' : 'Generate B-Roll Prompt'}
          </button>
        </div>

        {/* Presets */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          borderTop: '1px solid var(--border)',
          padding: '16px 20px',
        }}>
          <label style={{ ...labelStyle, marginBottom: 12 }}>Quick presets</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {BROLL_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset)}
                disabled={generating}
                style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: generating ? 'not-allowed' : 'pointer',
                  opacity: generating ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!generating) {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'var(--bg-primary)';
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {preset.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: '1.3' }}>
                  {preset.description.slice(0, 60)}...
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Generated Clips */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {bRollClips.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>F</div>
            <h3 style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 8 }}>No B-Roll clips yet</h3>
            <p style={{ fontSize: 13, maxWidth: 360 }}>
              Describe a scene or pick a preset to generate cinematic B-roll prompts ready for video generation.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>
                Generated B-Roll Clips ({bRollClips.length})
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...bRollClips].reverse().map((clip) => (
                <div
                  key={clip.id}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: `1px solid ${expandedClipId === clip.id ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 8,
                    overflow: 'hidden',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {/* Clip Header */}
                  <div
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                    onClick={() => setExpandedClipId(expandedClipId === clip.id ? null : clip.id)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '2px 8px',
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: 'var(--accent)',
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 600,
                        }}>
                          {clip.category}
                        </span>
                        <span style={{
                          padding: '2px 8px',
                          background: clip.status === 'ready' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                          color: clip.status === 'ready' ? 'var(--success)' : 'var(--warning)',
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 600,
                        }}>
                          {clip.status}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        marginTop: 6,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: expandedClipId === clip.id ? 'normal' : 'nowrap',
                      }}>
                        {clip.description}
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 16, marginLeft: 12 }}>
                      {expandedClipId === clip.id ? '\u25B2' : '\u25BC'}
                    </span>
                  </div>

                  {/* Expanded Content */}
                  {expandedClipId === clip.id && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: 16 }}>
                      <label style={{ ...labelStyle, marginBottom: 6 }}>Generated Prompt</label>
                      <div style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: 12,
                        fontSize: 12,
                        lineHeight: '1.6',
                        color: 'var(--text-primary)',
                        whiteSpace: 'pre-wrap',
                        marginBottom: 12,
                      }}>
                        {clip.generatedPrompt}
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => navigator.clipboard.writeText(clip.generatedPrompt)}
                          style={actionBtn}
                        >
                          Copy Prompt
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Remove this B-roll clip?')) {
                              removeBRollClip(clip.id);
                              setExpandedClipId(null);
                            }
                          }}
                          style={{ ...actionBtn, borderColor: '#f87171', color: '#f87171' }}
                        >
                          Remove
                        </button>
                      </div>

                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                        Created {new Date(clip.createdAt).toLocaleString()} | Platform: {clip.platform}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
  color: 'var(--text-secondary)',
};

const inputStyle: React.CSSProperties = {
  padding: '10px 14px',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
};

const actionBtn: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
};
