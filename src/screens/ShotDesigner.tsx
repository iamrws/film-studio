import { useState, useCallback } from 'react';
import { useProjectStore } from '../stores/project-store';
import { useGenerationStore } from '../stores/generation-store';
import { decomposeSceneIntoShots } from '../services/llm-service';
import { renderAllPrompts, renderNegativePrompt } from '../services/prompt-renderer';
import { generationQueue } from '../services/generation-queue';
import { analyzePromptForPlatform } from '../services/prompt-intelligence';
import type { Shot, PlatformId, PromptPlatformId } from '../types/scene';

// Maps platform ID to the API key field name in settings
const PLATFORM_KEY_FIELD: Partial<Record<PlatformId, string>> = {
  veo3: 'gemini',
  sora2: 'openai',
  kling3: 'kling',
  seedance2: 'seedance',
  runwayGen4: 'runway',
};

// All Artlist platforms for prompt preview
const PROMPT_PLATFORMS: { id: PromptPlatformId; name: string; hasApi: boolean; hasNegativePrompt: boolean }[] = [
  { id: 'veo3', name: 'Veo 3.1', hasApi: true, hasNegativePrompt: false },
  { id: 'sora2', name: 'Sora 2', hasApi: true, hasNegativePrompt: false },
  { id: 'kling3', name: 'Kling 3', hasApi: true, hasNegativePrompt: true },
  { id: 'hailuo', name: 'Hailuo', hasApi: false, hasNegativePrompt: true },
  { id: 'seedance2', name: 'Seedance', hasApi: true, hasNegativePrompt: false },
  { id: 'wan', name: 'Wan', hasApi: false, hasNegativePrompt: true },
  { id: 'ltx', name: 'LTX', hasApi: false, hasNegativePrompt: false },
  { id: 'grok', name: 'Grok', hasApi: false, hasNegativePrompt: false },
];

function mapPlatformToPromptPlatform(platform: PlatformId): PromptPlatformId {
  return platform === 'wan22' ? 'wan' : platform;
}

export function ShotDesigner() {
  const scenes = useProjectStore((s) => s.project.scenes);
  const characters = useProjectStore((s) => s.project.characterBible.characters);
  const globalStyle = useProjectStore((s) => s.project.globalStyle);
  const conceptContext = useProjectStore((s) => s.project.conceptContext);
  const settings = useProjectStore((s) => s.project.settings);
  const selectedSceneIndex = useProjectStore((s) => s.selectedSceneIndex);
  const setSelectedScene = useProjectStore((s) => s.setSelectedScene);
  const setShotsForScene = useProjectStore((s) => s.setShotsForScene);
  const updateShotBoardStatus = useProjectStore((s) => s.updateShotBoardStatus);
  const batchMoveShots = useProjectStore((s) => s.batchMoveShots);
  const setActiveScreen = useProjectStore((s) => s.setActiveScreen);

  const generationStats = useGenerationStore((s) => s.stats);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedShot, setExpandedShot] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState<PromptPlatformId>('veo3');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const selectedScene = selectedSceneIndex !== null ? scenes[selectedSceneIndex] : null;
  const platform = settings.defaultPlatform;
  const keyField = PLATFORM_KEY_FIELD[platform] || platform;

  const handleGenerateShots = useCallback(async () => {
    if (selectedSceneIndex === null || !selectedScene) return;

    const apiKey = settings.apiKeys[settings.llmProvider];
    if (!apiKey) {
      setError(`No API key configured for ${settings.llmProvider}. Go to Settings to add one.`);
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const rawShots = await decomposeSceneIntoShots(
        {
          scene: selectedScene,
          characters,
          globalStyle,
          conceptContext: conceptContext
            ? { concept: conceptContext.concept, tone: conceptContext.tone || undefined, additionalNotes: conceptContext.additionalNotes || undefined }
            : undefined,
        },
        {
          provider: settings.llmProvider,
          apiKey,
        }
      );

      const shots: Shot[] = rawShots.map((raw) => {
        const shot: Shot = {
          id: crypto.randomUUID(),
          sceneId: selectedScene.id,
          sequenceOrder: raw.sequenceOrder,
          durationSeconds: raw.durationSeconds,
          prompt: raw.prompt,
          psychology: raw.psychology,
          renderedPrompts: { generic: '' },
          generations: [],
          boardStatus: 'backlog',
          boardOrder: raw.sequenceOrder,
          targetPlatform: settings.defaultPlatform,
        };
        shot.renderedPrompts = renderAllPrompts(shot, globalStyle, characters);
        return shot;
      });

      setShotsForScene(selectedSceneIndex, shots);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }, [selectedSceneIndex, selectedScene, characters, globalStyle, settings, setShotsForScene]);

  const getApiKeyForPlatform = useCallback((): string | null => {
    const apiKey = settings.apiKeys[keyField];
    if (!apiKey) {
      setError(`No API key for ${platform}. Go to Settings and add your "${keyField}" API key.`);
      return null;
    }
    return apiKey;
  }, [settings, platform, keyField]);

  const handleSubmitShot = useCallback(
    (shot: Shot) => {
      const apiKey = getApiKeyForPlatform();
      if (!apiKey) return;

      const promptPlatform = mapPlatformToPromptPlatform(platform);
      const promptText = shot.renderedPrompts[promptPlatform] || shot.renderedPrompts.generic;
      const quality = analyzePromptForPlatform(shot, promptPlatform, promptText);
      if (quality.score < 50) {
        setError(
          `Shot blocked: prompt quality is ${quality.score}/100 for ${promptPlatform}. ` +
          `Resolve prompt issues before submitting.`
        );
        return;
      }

      setError(null);
      generationQueue.setApiConfig(platform, { apiKey });
      generationQueue.enqueue(shot, platform, globalStyle, characters);
      updateShotBoardStatus(shot.id, 'generating');
      setSubmitStatus(
        `Shot submitted to ${platform}. Prompt quality: ${quality.score}/100. ` +
        `Check the Generation Queue for status.`
      );
      setTimeout(() => setSubmitStatus(null), 5000);
    },
    [platform, globalStyle, characters, getApiKeyForPlatform, updateShotBoardStatus]
  );

  const handleSubmitAll = useCallback(() => {
    if (!selectedScene || selectedScene.shots.length === 0) return;

    const apiKey = getApiKeyForPlatform();
    if (!apiKey) return;

    const promptPlatform = mapPlatformToPromptPlatform(platform);
    const lowQualityShots = selectedScene.shots
      .map((shot) => {
        const promptText = shot.renderedPrompts[promptPlatform] || shot.renderedPrompts.generic;
        const quality = analyzePromptForPlatform(shot, promptPlatform, promptText);
        return { shot, quality };
      })
      .filter(({ quality }) => quality.score < 50);

    if (lowQualityShots.length > 0) {
      setError(
        `Batch blocked: ${lowQualityShots.length} shot(s) are below quality threshold ` +
        `for ${promptPlatform}. Open the shots and resolve warnings first.`
      );
      return;
    }

    setError(null);
    generationQueue.setApiConfig(platform, { apiKey });
    generationQueue.enqueueBatch(selectedScene.shots, platform, globalStyle, characters);
    batchMoveShots(selectedScene.shots.map((shot) => shot.id), 'generating');
    setSubmitStatus(
      `${selectedScene.shots.length} shots submitted to ${platform}. Opening Generation Queue...`
    );
    setTimeout(() => {
      setSubmitStatus(null);
      setActiveScreen('queue');
    }, 1500);
  }, [selectedScene, platform, globalStyle, characters, getApiKeyForPlatform, setActiveScreen, batchMoveShots]);

  const handleCopyPrompt = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback('Copied!');
    setTimeout(() => setCopyFeedback(null), 1500);
  }, []);

  return (
    <div className="shot-designer">
      <div className="shot-scene-panel">
        <h3 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-secondary)' }}>Scenes</h3>
        {scenes.length === 0 ? (
          <div className="empty-state" style={{ padding: 16 }}>
            <p>Parse a screenplay first</p>
          </div>
        ) : (
          scenes.map((scene, i) => (
            <div
              key={scene.id}
              className={`scene-tree-item ${selectedSceneIndex === i ? 'selected' : ''}`}
              role="button"
              tabIndex={0}
              aria-pressed={selectedSceneIndex === i}
              onClick={() => setSelectedScene(i)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedScene(i); } }}
            >
              <div className="scene-number">Scene {i + 1}</div>
              <div className="scene-heading" style={{ fontSize: 11 }}>
                {scene.heading.prefix}. {scene.heading.location}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {scene.shots.length} shot{scene.shots.length !== 1 ? 's' : ''}
              </div>
            </div>
          ))
        )}

        {/* Queue status indicator */}
        {generationStats.total > 0 && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: 'var(--bg-tertiary)',
              borderRadius: 6,
              fontSize: 11,
              cursor: 'pointer',
            }}
            role="button"
            tabIndex={0}
            aria-label="Open Generation Queue"
            onClick={() => setActiveScreen('queue')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveScreen('queue'); } }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Generation Queue</div>
            <div>{generationStats.active} active | {generationStats.completed} done | {generationStats.failed} failed</div>
          </div>
        )}
      </div>

      <div className="shot-editor-panel">
        {!selectedScene ? (
          <div className="empty-state">
            <h3>Select a Scene</h3>
            <p>Choose a scene from the left panel to design shots.</p>
            <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              The Shot Designer will use the Psychology Engine to generate<br />
              camera, lighting, and audio prompts based on the emotional<br />
              function of each beat in the scene.
            </p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ marginBottom: 8 }}>
                  Scene {selectedSceneIndex! + 1}: {selectedScene.heading.prefix}.{' '}
                  {selectedScene.heading.location}
                  {selectedScene.heading.time ? ` - ${selectedScene.heading.time}` : ''}
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selectedScene.charactersPresent.map((char) => (
                    <span key={char} className="badge badge-info">{char}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleGenerateShots}
                  disabled={generating}
                  style={{
                    padding: '8px 16px',
                    background: generating ? 'var(--bg-disabled)' : 'var(--accent)',
                    color: 'var(--text-on-accent)',
                    border: 'none',
                    borderRadius: 6,
                    cursor: generating ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                  }}
                >
                  {generating ? 'Generating...' : 'Generate Shots with AI'}
                </button>
                {selectedScene.shots.length > 0 && (
                  <button
                    onClick={handleSubmitAll}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--emotion-very-positive)',
                      color: 'var(--on-bright)',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Submit All to {platform}
                  </button>
                )}
              </div>
            </div>

            {/* Status messages */}
            {error && (
              <div
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

            {submitStatus && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--success-subtle-bg)',
                  border: '1px solid var(--emotion-very-positive)',
                  borderRadius: 6,
                  color: 'var(--emotion-very-positive)',
                  fontSize: 12,
                  marginBottom: 16,
                }}
              >
                {submitStatus}
              </div>
            )}

            {selectedScene.shots.length === 0 && !generating ? (
              <div className="empty-state" style={{ padding: 32 }}>
                <p>No shots designed yet for this scene.</p>
                <p style={{ marginTop: 8, fontSize: 12 }}>
                  Click "Generate Shots with AI" to decompose this scene<br />
                  into individual camera shots with psychology-informed prompts.
                </p>
              </div>
            ) : (
              <div>
                {selectedScene.shots.map((shot, i) => (
                  <div
                    key={shot.id}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: `1px solid ${expandedShot === shot.id ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 12,
                      cursor: 'pointer',
                    }}
                    onClick={() => setExpandedShot(expandedShot === shot.id ? null : shot.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          Shot {i + 1} — {shot.durationSeconds}s
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                          {shot.prompt.camera.shotType} | {shot.prompt.camera.movement} | {shot.prompt.camera.angle}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: getEmotionColor(shot.psychology.valence),
                            color: 'var(--on-bright)',
                            fontWeight: 600,
                          }}
                        >
                          {shot.psychology.targetEmotion}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          A:{shot.psychology.arousalLevel}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubmitShot(shot);
                          }}
                          style={{
                            padding: '4px 10px',
                            background: 'var(--accent)',
                            color: 'var(--text-on-accent)',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: 11,
                          }}
                        >
                          Submit
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                      {shot.prompt.subject.action}
                    </div>

                    {expandedShot === shot.id && (
                      <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                          <div>
                            <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>Camera</div>
                            <div>Type: {shot.prompt.camera.shotType}</div>
                            <div>Movement: {shot.prompt.camera.movement}</div>
                            <div>Angle: {shot.prompt.camera.angle}</div>
                            <div>Lens: {shot.prompt.camera.lens}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>Lighting</div>
                            <div>Style: {shot.prompt.lighting.style}</div>
                            <div>Temp: {shot.prompt.lighting.colorTemperature}</div>
                            {shot.prompt.lighting.sources && <div>Sources: {shot.prompt.lighting.sources}</div>}
                          </div>
                          <div>
                            <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>Psychology</div>
                            <div>Emotion: {shot.psychology.targetEmotion}</div>
                            <div>Mode: {shot.psychology.identificationMode}</div>
                            <div>Arc: {shot.psychology.storyArcPosition}</div>
                            <div>Schema: {shot.psychology.schemaRelationship}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>Audio</div>
                            {shot.prompt.audio.dialogue.map((d, di) => (
                              <div key={di}>{d.characterName}: &quot;{d.text}&quot;</div>
                            ))}
                            {shot.prompt.audio.sfx.length > 0 && <div>SFX: {shot.prompt.audio.sfx.join(', ')}</div>}
                            {shot.prompt.audio.ambient && <div>Ambient: {shot.prompt.audio.ambient}</div>}
                          </div>
                        </div>

                        {/* Multi-Platform Prompt Preview */}
                        <div style={{ marginTop: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>
                              Prompt Preview
                            </div>
                            {copyFeedback && (
                              <span style={{ fontSize: 11, color: 'var(--emotion-very-positive)', fontWeight: 600 }}>{copyFeedback}</span>
                            )}
                          </div>

                          {/* Platform tabs */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                            {PROMPT_PLATFORMS.map((pp) => (
                              <button
                                key={pp.id}
                                onClick={(e) => { e.stopPropagation(); setPreviewPlatform(pp.id); }}
                                style={{
                                  padding: '3px 10px',
                                  fontSize: 11,
                                  border: previewPlatform === pp.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                                  background: previewPlatform === pp.id ? 'var(--accent)' : 'var(--bg-tertiary)',
                                  color: previewPlatform === pp.id ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                }}
                              >
                                {pp.name}
                              </button>
                            ))}
                          </div>

                          {/* Prompt display */}
                          <pre
                            style={{
                              fontSize: 11,
                              color: 'var(--text-secondary)',
                              whiteSpace: 'pre-wrap',
                              background: 'var(--bg-primary)',
                              padding: 10,
                              borderRadius: 6,
                              maxHeight: 200,
                              overflowY: 'auto',
                            }}
                          >
                            {shot.renderedPrompts[previewPlatform] || shot.renderedPrompts.generic}
                          </pre>

                          {(() => {
                            const previewText =
                              shot.renderedPrompts[previewPlatform] || shot.renderedPrompts.generic;
                            const quality = analyzePromptForPlatform(shot, previewPlatform, previewText);
                            const qualityColor =
                              quality.score >= 85
                                ? 'var(--emotion-very-positive)'
                                : quality.score >= 70
                                  ? 'var(--emotion-neutral)'
                                  : 'var(--transition)';

                            return (
                              <div
                                style={{
                                  marginTop: 8,
                                  padding: 10,
                                  borderRadius: 6,
                                  border: `1px solid ${qualityColor}`,
                                  background: 'var(--bg-primary)',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 8,
                                  }}
                                >
                                  <span style={{ fontSize: 11, fontWeight: 700, color: qualityColor }}>
                                    Prompt Quality: {quality.score}/100
                                  </span>
                                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                    {quality.formula}
                                  </span>
                                </div>
                                {quality.issues.length > 0 && (
                                  <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                                    {quality.issues.slice(0, 3).map((issue) => issue.message).join(' | ')}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Action buttons */}
                          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyPrompt(shot.renderedPrompts[previewPlatform] || shot.renderedPrompts.generic);
                              }}
                              style={{
                                padding: '4px 12px',
                                fontSize: 11,
                                background: 'var(--bg-tertiary)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border)',
                                borderRadius: 4,
                                cursor: 'pointer',
                              }}
                            >
                              Copy Prompt
                            </button>

                            {/* Negative prompt copy for platforms that support it */}
                            {PROMPT_PLATFORMS.find((pp) => pp.id === previewPlatform)?.hasNegativePrompt && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyPrompt(renderNegativePrompt(shot, globalStyle));
                                }}
                                style={{
                                  padding: '4px 12px',
                                  fontSize: 11,
                                  background: 'var(--bg-tertiary)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                }}
                              >
                                Copy Negative Prompt
                              </button>
                            )}

                            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                              {PROMPT_PLATFORMS.find((pp) => pp.id === previewPlatform)?.hasApi
                                ? 'Can submit via app'
                                : 'Copy for Artlist.io'}
                            </span>
                          </div>
                        </div>

                        {shot.psychology.transportationCues.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              Transportation cues: {shot.psychology.transportationCues.join(' | ')}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getEmotionColor(valence: number): string {
  if (valence >= 3) return 'var(--emotion-very-positive)';
  if (valence >= 1) return 'var(--emotion-positive)';
  if (valence >= -1) return 'var(--emotion-neutral)';
  if (valence >= -3) return 'var(--emotion-negative)';
  return 'var(--transition)';
}
