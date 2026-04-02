import { useState, useCallback } from 'react';
import { useProjectStore } from '../stores/project-store';
import { generateBRollPrompt } from '../services/llm-service';
import type { BRollClip } from '../types/project';
import type { Shot } from '../types/scene';
import { generationQueue } from '../services/generation-queue';

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

const BROLL_PROMPT_PLATFORM = 'veo3' as const;
const DEFAULT_BROLL_NEGATIVE = 'dialogue, speech, talking, text, subtitles, captions, voice-over, narration, words, letters, watermark, blurry, low quality';

export function BRollStudio() {
  const settings = useProjectStore((s) => s.project.settings);
  const globalStyle = useProjectStore((s) => s.project.globalStyle);
  const characters = useProjectStore((s) => s.project.characterBible.characters);
  const bRollClips = useProjectStore((s) => s.project.bRollClips || []);
  const addBRollClip = useProjectStore((s) => s.addBRollClip);
  const updateBRollClip = useProjectStore((s) => s.updateBRollClip);
  const removeBRollClip = useProjectStore((s) => s.removeBRollClip);
  const setActiveScreen = useProjectStore((s) => s.setActiveScreen);

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
          targetPlatform: BROLL_PROMPT_PLATFORM,
        },
        { provider: settings.llmProvider, apiKey }
      );

      const clip: BRollClip = {
        id: crypto.randomUUID(),
        description: desc.trim(),
        category: category || 'custom',
        generatedPrompt: result.prompt,
        negativePrompt: result.negativePrompt,
        suggestedDurationSeconds: result.suggestedDuration,
        platform: BROLL_PROMPT_PLATFORM,
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

  const handleTestInVeo3 = useCallback((clip: BRollClip) => {
    const geminiApiKey = settings.apiKeys.gemini;
    if (!geminiApiKey) {
      setError('Veo3 testing requires a Gemini API key. Add it in Settings under "Veo 3 (Google Gemini)".');
      return;
    }

    generationQueue.setApiConfig(BROLL_PROMPT_PLATFORM, { apiKey: geminiApiKey });

    const { prompt, negativePrompt } = splitBRollPromptParts(clip);
    if (!prompt) {
      setError('This clip has an empty prompt. Regenerate it first.');
      return;
    }

    const duration = clip.suggestedDurationSeconds ?? 8;
    const shot = buildBRollShot({
      clip,
      prompt,
      negativePrompt,
      durationSeconds: duration,
    });

    const jobId = generationQueue.enqueue(
      shot,
      BROLL_PROMPT_PLATFORM,
      globalStyle,
      characters
    );

    updateBRollClip(clip.id, {
      generatedPrompt: prompt,
      negativePrompt,
      suggestedDurationSeconds: duration,
      platform: BROLL_PROMPT_PLATFORM,
      status: 'generating',
      generationJobId: jobId,
    });
    setExpandedClipId(clip.id);
    setError(null);
  }, [settings.apiKeys, globalStyle, characters, updateBRollClip]);

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
            Step 1: Create a B-roll prompt. Step 2: Test it as a video in Veo3.
          </p>
          <div style={{
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg-primary)',
            fontSize: 11,
            color: 'var(--text-secondary)',
            marginBottom: 16,
          }}>
            Prompt profile: <strong>Veo3</strong> (camera direction first, then action, setting, and lighting)
          </div>
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
                  color: selectedStyle === s ? 'var(--text-on-accent)' : 'var(--text-primary)',
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
              background: 'var(--error-subtle-bg)',
              border: '1px solid var(--transition)',
              borderRadius: 6,
              color: 'var(--transition)',
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
              background: generating || !description.trim() ? 'var(--bg-disabled)' : 'var(--accent)',
              color: 'var(--text-on-accent)',
              cursor: generating || !description.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? 'Step 1/2: Creating Prompt...' : 'Step 1: Create B-Roll Prompt'}
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
              Describe a scene or pick a preset to create a prompt, then test that prompt directly in Veo3.
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
              {[...bRollClips].reverse().map((clip) => {
                const promptParts = splitBRollPromptParts(clip);
                const statusBadge = getClipStatusBadge(clip.status);

                return (
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
                            background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                            color: 'var(--accent)',
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 600,
                          }}>
                            {clip.category}
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            background: statusBadge.background,
                            color: statusBadge.color,
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
                        <label style={{ ...labelStyle, marginBottom: 6 }}>Generated Prompt (Veo3 profile)</label>
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
                          {promptParts.prompt}
                        </div>

                        <label style={{ ...labelStyle, marginBottom: 6 }}>Negative Prompt</label>
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
                          {promptParts.negativePrompt}
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          <button
                            onClick={() => handleTestInVeo3(clip)}
                            disabled={clip.status === 'generating'}
                            style={{
                              ...actionBtn,
                              borderColor: 'var(--accent)',
                              background: 'var(--accent)',
                              color: 'var(--text-on-accent)',
                              cursor: clip.status === 'generating' ? 'not-allowed' : 'pointer',
                              opacity: clip.status === 'generating' ? 0.7 : 1,
                            }}
                          >
                            {getVeo3ActionLabel(clip.status)}
                          </button>
                          <button
                            onClick={() => navigator.clipboard.writeText(promptParts.prompt)}
                            style={actionBtn}
                          >
                            Copy Prompt
                          </button>
                          <button
                            onClick={() => navigator.clipboard.writeText(`${promptParts.prompt}\n\nNegative: ${promptParts.negativePrompt}`)}
                            style={actionBtn}
                          >
                            Copy Prompt + Negative
                          </button>
                          <button
                            onClick={() => setActiveScreen('generation-queue')}
                            style={actionBtn}
                          >
                            Open Queue
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Remove this B-roll clip?')) {
                                removeBRollClip(clip.id);
                                setExpandedClipId(null);
                              }
                            }}
                            style={{ ...actionBtn, borderColor: 'var(--transition)', color: 'var(--transition)' }}
                          >
                            Remove
                          </button>
                        </div>

                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                          Created {new Date(clip.createdAt).toLocaleString()} | Target model: Veo3 | Duration: {clip.suggestedDurationSeconds ?? 8}s
                        </div>
                        {clip.generationJobId && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            Queue job: {clip.generationJobId}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function splitBRollPromptParts(clip: BRollClip): { prompt: string; negativePrompt: string } {
  const explicitNegative = clip.negativePrompt?.trim();
  if (explicitNegative) {
    return {
      prompt: clip.generatedPrompt.trim(),
      negativePrompt: explicitNegative,
    };
  }

  const marker = /\n+\s*Negative:\s*/i;
  const match = marker.exec(clip.generatedPrompt);
  if (!match) {
    return {
      prompt: clip.generatedPrompt.trim(),
      negativePrompt: DEFAULT_BROLL_NEGATIVE,
    };
  }

  const prompt = clip.generatedPrompt.slice(0, match.index).trim();
  const negativePrompt = clip.generatedPrompt
    .slice(match.index)
    .replace(marker, '')
    .trim();

  return {
    prompt,
    negativePrompt: negativePrompt || DEFAULT_BROLL_NEGATIVE,
  };
}

function getVeo3ActionLabel(status: BRollClip['status']): string {
  if (status === 'generating') return 'Generating in Veo3...';
  if (status === 'completed') return 'Generate Again in Veo3';
  if (status === 'failed') return 'Retry in Veo3';
  return 'Step 2: Test in Veo3';
}

function getClipStatusBadge(status: BRollClip['status']): { background: string; color: string } {
  if (status === 'ready') return { background: 'color-mix(in srgb, var(--status-ready) 15%, transparent)', color: 'var(--status-ready)' };
  if (status === 'generating') return { background: 'color-mix(in srgb, var(--warning) 15%, transparent)', color: 'var(--warning)' };
  if (status === 'completed') return { background: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' };
  if (status === 'failed') return { background: 'color-mix(in srgb, var(--transition) 15%, transparent)', color: 'var(--transition)' };
  return { background: 'color-mix(in srgb, var(--text-secondary) 20%, transparent)', color: 'var(--text-secondary)' };
}

function buildBRollShot(params: {
  clip: BRollClip;
  prompt: string;
  negativePrompt: string;
  durationSeconds: number;
}): Shot {
  return {
    id: `broll-shot-${params.clip.id}`,
    sceneId: 'broll',
    sequenceOrder: 0,
    durationSeconds: Math.max(4, Math.min(8, Math.round(params.durationSeconds))),
    prompt: {
      camera: {
        shotType: 'WIDE SHOT',
        movement: 'SMOOTH TRACKING',
        lens: '35mm',
        angle: 'EYE LEVEL',
      },
      subject: {
        description: params.clip.description,
        characters: [],
        action: params.prompt,
      },
      setting: {
        location: params.clip.category,
        timeOfDay: '',
        weather: '',
        productionDesign: '',
      },
      lighting: {
        style: 'cinematic',
        colorTemperature: '',
        sources: '',
      },
      style: {
        filmStock: '',
        colorGrade: '',
        era: '',
        reference: '',
      },
      audio: {
        dialogue: [],
        sfx: [],
        ambient: '',
        music: '',
      },
      negativePrompt: params.negativePrompt,
    },
    psychology: {
      targetEmotion: 'neutral',
      arousalLevel: 5,
      valence: 0,
      transportationCues: [],
      identificationMode: 'absorption',
      schemaRelationship: 'conforming',
      storyArcPosition: 'rising',
      suspenseCalibration: {
        informationAsymmetry: 'none',
        outcomeProbability: 0.5,
      },
    },
    renderedPrompts: {
      veo3: params.prompt,
      generic: params.prompt,
    },
    generations: [],
    boardStatus: 'ready',
    boardOrder: 0,
    targetPlatform: BROLL_PROMPT_PLATFORM,
  };
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
