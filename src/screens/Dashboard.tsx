import { useState, useCallback, useRef } from 'react';
import { useProjectStore } from '../stores/project-store';
import {
  generateScreenplay,
  extractCharactersFromScreenplay,
  decomposeSceneIntoShots,
  inferGlobalStyle,
} from '../services/llm-service';
import { renderAllPrompts } from '../services/prompt-renderer';
import { generationQueue } from '../services/generation-queue';
import type { Shot } from '../types/scene';
import type { Character } from '../types/character';

const GENRE_OPTIONS = [
  'Drama', 'Thriller', 'Horror', 'Comedy', 'Sci-Fi',
  'Romance', 'Action', 'Mystery', 'Fantasy', 'Period',
] as const;

const TONE_OPTIONS = [
  'Dark & gritty', 'Lighthearted', 'Surreal', 'Intimate & quiet',
  'Epic & sweeping', 'Satirical', 'Dreamlike', 'Raw & unflinching',
] as const;

const LENGTH_OPTIONS = [
  { id: 'short' as const, label: 'Short Film', desc: '5-10 min' },
  { id: 'medium' as const, label: 'Medium', desc: '15-30 min' },
  { id: 'feature' as const, label: 'Feature Length', desc: '30-60 min' },
];

export function Dashboard() {
  const project = useProjectStore((s) => s.project);
  const settings = useProjectStore((s) => s.project.settings);
  const updateScreenplayText = useProjectStore((s) => s.updateScreenplayText);
  const parseCurrentScreenplay = useProjectStore((s) => s.parseCurrentScreenplay);
  const updateProjectTitle = useProjectStore((s) => s.updateProjectTitle);
  const setActiveScreen = useProjectStore((s) => s.setActiveScreen);
  const setConceptContext = useProjectStore((s) => s.setConceptContext);
  const updateGlobalStyle = useProjectStore((s) => s.updateGlobalStyle);

  const [concept, setConcept] = useState('');
  const [genre, setGenre] = useState('');
  const [tone, setTone] = useState('');
  const [targetLength, setTargetLength] = useState<'short' | 'medium' | 'feature'>('medium');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [degenRunning, setDegenRunning] = useState(false);
  const [degenStep, setDegenStep] = useState('');
  const [degenProgress, setDegenProgress] = useState<string[]>([]);
  const degenAbort = useRef(false);

  const hasScreenplay = project.screenplay.rawText.length > 0;
  const parsed = project.screenplay.parsed;

  const handleGenerate = useCallback(async () => {
    if (!concept.trim()) return;

    const apiKey = settings.apiKeys[settings.llmProvider];
    if (!apiKey) {
      setError(`No API key set for ${settings.llmProvider}. Go to Settings to add one.`);
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const screenplay = await generateScreenplay(
        {
          concept: concept.trim(),
          genre: genre || undefined,
          tone: tone || undefined,
          targetLength,
          additionalNotes: additionalNotes.trim() || undefined,
        },
        { provider: settings.llmProvider, apiKey }
      );

      updateScreenplayText(screenplay);
      // Zustand updates are synchronous — parse immediately, no timeout needed
      parseCurrentScreenplay();
      const title = concept.trim().slice(0, 60);
      updateProjectTitle(title);
      setActiveScreen('editor');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }, [concept, genre, tone, targetLength, additionalNotes, settings, updateScreenplayText, parseCurrentScreenplay, updateProjectTitle, setActiveScreen]);

  const addLog = useCallback((msg: string) => {
    setDegenProgress((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const handleDegenMode = useCallback(async () => {
    if (!concept.trim()) return;

    const apiKey = settings.apiKeys[settings.llmProvider];
    if (!apiKey) {
      setError(`No API key set for ${settings.llmProvider}. Go to Settings to add one.`);
      return;
    }

    degenAbort.current = false;
    setDegenRunning(true);
    setDegenProgress([]);
    setError(null);

    const llmConfig = { provider: settings.llmProvider, apiKey } as const;
    const conceptCtx = {
      concept: concept.trim(),
      genre: genre || '',
      tone: tone || '',
      targetLength,
      additionalNotes: additionalNotes.trim(),
    };

    try {
      // Step 0: Save concept context so it persists across the project
      setConceptContext(conceptCtx);

      // Step 1: Infer global visual style from concept
      setDegenStep('Inferring visual style...');
      addLog('Analyzing concept for visual style...');
      const inferredStyle = await inferGlobalStyle(
        conceptCtx.concept,
        conceptCtx.genre || undefined,
        conceptCtx.tone || undefined,
        llmConfig
      );
      if (Object.keys(inferredStyle).length > 0) {
        updateGlobalStyle(inferredStyle);
        addLog(`Visual style set: ${inferredStyle.filmStyle || 'inferred'}, ${inferredStyle.colorPalette || 'auto'}`);
      }
      if (degenAbort.current) throw new Error('Aborted');

      // Step 2: Generate Screenplay
      setDegenStep('Writing screenplay...');
      addLog('Generating screenplay from concept...');
      const screenplay = await generateScreenplay(
        {
          concept: conceptCtx.concept,
          genre: conceptCtx.genre || undefined,
          tone: conceptCtx.tone || undefined,
          targetLength,
          additionalNotes: conceptCtx.additionalNotes || undefined,
        },
        { ...llmConfig, maxTokens: 16384 }
      );
      if (degenAbort.current) throw new Error('Aborted');

      updateScreenplayText(screenplay);
      parseCurrentScreenplay();
      const title = conceptCtx.concept.slice(0, 60);
      updateProjectTitle(title);
      addLog('Screenplay generated and parsed.');

      // Re-read store after parse
      let currentProject = useProjectStore.getState().project;
      const sceneCount = currentProject.scenes.length;
      addLog(`Found ${sceneCount} scenes.`);

      if (sceneCount === 0) {
        addLog('No scenes detected — stopping.');
        setDegenStep('Done (no scenes found)');
        setDegenRunning(false);
        return;
      }

      // Step 3: Extract Characters (with concept context)
      setDegenStep('Extracting characters...');
      addLog('Extracting character profiles from screenplay...');
      const detectedNames = currentProject.screenplay.parsed?.characters || [];
      const extractedChars = await extractCharactersFromScreenplay(
        currentProject.screenplay.rawText,
        detectedNames,
        llmConfig,
        { concept: conceptCtx.concept, genre: conceptCtx.genre || undefined, tone: conceptCtx.tone || undefined }
      );
      if (degenAbort.current) throw new Error('Aborted');

      const fullCharacters: Character[] = extractedChars.map((c) => ({
        id: crypto.randomUUID(),
        referenceImages: [],
        ...c,
      }));
      useProjectStore.getState().updateCharacters(fullCharacters);
      addLog(`Extracted ${fullCharacters.length} characters with consistency anchors.`);

      // Step 4: Decompose all scenes into shots (with concept context)
      setDegenStep('Decomposing scenes into shots...');
      currentProject = useProjectStore.getState().project;

      for (let i = 0; i < currentProject.scenes.length; i++) {
        if (degenAbort.current) throw new Error('Aborted');
        const scene = currentProject.scenes[i];
        setDegenStep(`Decomposing scene ${i + 1}/${sceneCount}: ${scene.heading.location || 'Unknown'}...`);
        addLog(`Decomposing scene ${i + 1}: ${scene.heading.prefix}. ${scene.heading.location}`);

        try {
          const rawShots = await decomposeSceneIntoShots(
            {
              scene,
              characters: fullCharacters,
              globalStyle: currentProject.globalStyle,
              genre: conceptCtx.genre || undefined,
              conceptContext: {
                concept: conceptCtx.concept,
                tone: conceptCtx.tone || undefined,
                additionalNotes: conceptCtx.additionalNotes || undefined,
              },
            },
            llmConfig
          );

          const shots: Shot[] = rawShots.map((raw) => {
            const shot: Shot = {
              id: crypto.randomUUID(),
              sceneId: scene.id,
              sequenceOrder: raw.sequenceOrder,
              durationSeconds: raw.durationSeconds,
              prompt: raw.prompt,
              psychology: raw.psychology,
              renderedPrompts: { generic: '' },
              generations: [],
              boardStatus: 'ready',
              boardOrder: raw.sequenceOrder,
              targetPlatform: currentProject.settings.defaultPlatform,
            };
            shot.renderedPrompts = renderAllPrompts(shot, currentProject.globalStyle, fullCharacters);
            return shot;
          });

          useProjectStore.getState().setShotsForScene(i, shots);
          addLog(`  -> ${shots.length} shots generated for scene ${i + 1}`);
        } catch (sceneErr) {
          addLog(`  -> FAILED on scene ${i + 1}: ${sceneErr instanceof Error ? sceneErr.message : String(sceneErr)}`);
        }
      }

      // Step 5: Submit all shots to generation queue
      currentProject = useProjectStore.getState().project;
      const allShots = currentProject.scenes.flatMap((s) => s.shots);
      const totalShots = allShots.length;

      if (totalShots > 0) {
        setDegenStep(`Submitting ${totalShots} shots to ${currentProject.settings.defaultPlatform}...`);
        addLog(`Submitting ${totalShots} shots to ${currentProject.settings.defaultPlatform}...`);

        const platform = currentProject.settings.defaultPlatform;
        const platformKeyField: Record<string, string> = {
          veo3: 'gemini', sora2: 'openai', kling3: 'kling',
          seedance2: 'seedance', runwayGen4: 'runway',
        };
        const platformKey = settings.apiKeys[platformKeyField[platform] || platform];
        if (platformKey) {
          generationQueue.setApiConfig(platform, { apiKey: platformKey });
          generationQueue.enqueueBatch(allShots, platform, currentProject.globalStyle, fullCharacters);
          useProjectStore.getState().batchMoveShots(
            allShots.map((s) => s.id),
            'generating'
          );
          addLog(`All ${totalShots} shots queued for generation.`);
        } else {
          addLog(`No API key for ${platform} — shots are ready but not submitted.`);
        }
      }

      setDegenStep('DEGEN MODE COMPLETE');
      addLog('Pipeline complete. Navigating to Generation Queue...');
      setActiveScreen(totalShots > 0 ? 'queue' : 'shots');

    } catch (err) {
      if ((err as Error).message === 'Aborted') {
        addLog('Aborted by user.');
        setDegenStep('Aborted');
      } else {
        setError(err instanceof Error ? err.message : String(err));
        addLog(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
        setDegenStep('Failed');
      }
    } finally {
      setDegenRunning(false);
    }
  }, [concept, genre, tone, targetLength, additionalNotes, settings, updateScreenplayText, parseCurrentScreenplay, updateProjectTitle, addLog, setConceptContext, updateGlobalStyle, setActiveScreen]);

  // If there's already a screenplay, show project overview
  if (hasScreenplay) {
    return (
      <div className="dashboard">
        <h2>Film Studio</h2>
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="label">Scenes</div>
            <div className="value">{parsed?.sceneCount ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="label">Characters</div>
            <div className="value">{parsed?.characters.length ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="label">Locations</div>
            <div className="value">{parsed?.locations.length ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="label">Shots Designed</div>
            <div className="value">
              {project.scenes.reduce((sum, s) => sum + s.shots.length, 0)}
            </div>
          </div>
          <div className="stat-card">
            <div className="label">Clips Generated</div>
            <div className="value">
              {project.scenes.reduce(
                (sum, s) =>
                  sum + s.shots.reduce(
                    (ss, sh) => ss + sh.generations.filter((g) => g.status === 'completed').length,
                    0
                  ),
                0
              )}
            </div>
          </div>
          <div className="stat-card">
            <div className="label">Story Shape</div>
            <div className="value" style={{ fontSize: 16 }}>
              {project.emotionalArc.storyShape?.replace(/_/g, ' ') ?? 'Not analyzed'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            style={primaryBtn}
            onClick={() => setActiveScreen('editor')}
          >
            Edit Screenplay
          </button>
          <button
            style={secondaryBtn}
            onClick={() => setActiveScreen('shots')}
          >
            Shot Designer
          </button>
          {parsed && parsed.characters.length > 0 && (
            <button
              style={secondaryBtn}
              onClick={() => setActiveScreen('characters')}
            >
              Characters ({parsed.characters.length})
            </button>
          )}
        </div>

        <div style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
          <button
            style={{ ...secondaryBtn, fontSize: 12 }}
            onClick={() => {
              if (confirm('Start a new project? This will clear the current screenplay.')) {
                useProjectStore.getState().resetProject();
              }
            }}
          >
            Start New Project
          </button>
        </div>
      </div>
    );
  }

  // No screenplay yet — show the concept input
  return (
    <div style={{ padding: 32, maxWidth: 720, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Film Studio</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Describe your movie. The AI writes the screenplay.
        </p>
      </div>

      {/* Concept */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>What's your movie about?</label>
        <textarea
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="A retired astronaut living alone on a farm receives a radio signal from a spacecraft she thought was lost 30 years ago. As she investigates, she realizes the signal is coming from her younger self, trapped in a time loop orbiting Jupiter..."
          rows={5}
          style={{
            ...inputStyle,
            width: '100%',
            resize: 'vertical',
            fontSize: 14,
            lineHeight: '1.6',
          }}
          autoFocus
        />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
          {concept.length > 0 ? `${concept.split(/\s+/).filter(Boolean).length} words` : 'Be as detailed or brief as you want'}
        </div>
      </div>

      {/* Genre + Tone row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={labelStyle}>Genre</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {GENRE_OPTIONS.map((g) => (
              <button
                key={g}
                onClick={() => setGenre(genre === g ? '' : g)}
                style={{
                  padding: '5px 10px',
                  fontSize: 12,
                  borderRadius: 4,
                  border: `1px solid ${genre === g ? 'var(--accent)' : 'var(--border)'}`,
                  background: genre === g ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: genre === g ? '#fff' : 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Tone</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TONE_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setTone(tone === t ? '' : t)}
                style={{
                  padding: '5px 10px',
                  fontSize: 12,
                  borderRadius: 4,
                  border: `1px solid ${tone === t ? 'var(--accent)' : 'var(--border)'}`,
                  background: tone === t ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: tone === t ? '#fff' : 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Length */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Length</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {LENGTH_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setTargetLength(opt.id)}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 6,
                border: `1px solid ${targetLength === opt.id ? 'var(--accent)' : 'var(--border)'}`,
                background: targetLength === opt.id ? 'var(--accent)' : 'var(--bg-secondary)',
                color: targetLength === opt.id ? '#fff' : 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Additional Notes */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Additional notes (optional)</label>
        <textarea
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          placeholder="Any specific requirements: characters, setting constraints, themes, visual style, ending preferences..."
          rows={3}
          style={{ ...inputStyle, width: '100%', resize: 'vertical' }}
        />
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '10px 14px',
            background: '#f8717120',
            border: '1px solid #f87171',
            borderRadius: 6,
            color: '#f87171',
            fontSize: 12,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Generate Buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={handleGenerate}
          disabled={generating || degenRunning || !concept.trim()}
          style={{
            flex: 1,
            padding: '14px 24px',
            fontSize: 16,
            fontWeight: 700,
            borderRadius: 8,
            border: 'none',
            background: generating || degenRunning || !concept.trim() ? '#555' : 'var(--accent)',
            color: '#fff',
            cursor: generating || degenRunning || !concept.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? 'Writing your screenplay...' : 'Generate Screenplay'}
        </button>
        <button
          onClick={handleDegenMode}
          disabled={generating || degenRunning || !concept.trim()}
          style={{
            flex: 1,
            padding: '14px 24px',
            fontSize: 16,
            fontWeight: 700,
            borderRadius: 8,
            border: '2px solid #f59e0b',
            background: degenRunning ? '#92400e' : generating || !concept.trim() ? '#555' : 'linear-gradient(135deg, #f59e0b, #ef4444)',
            color: '#fff',
            cursor: generating || degenRunning || !concept.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {degenRunning ? 'RUNNING...' : 'DEGEN MODE'}
        </button>
      </div>

      {!degenRunning && !generating && concept.trim() && (
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          Degen Mode: auto-generates screenplay, characters, shots, and submits everything for video generation in one click.
        </div>
      )}

      {generating && (
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          This may take 30-60 seconds depending on length.
        </div>
      )}

      {/* Degen Mode Progress */}
      {(degenRunning || degenProgress.length > 0) && (
        <div style={{
          marginTop: 16,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 14px',
            background: degenRunning ? '#92400e' : 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: degenRunning ? '#fbbf24' : 'var(--text-primary)' }}>
              {degenStep || 'Degen Mode'}
            </span>
            {degenRunning && (
              <button
                onClick={() => { degenAbort.current = true; }}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  background: '#f87171',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Abort
              </button>
            )}
          </div>
          <div style={{
            padding: '10px 14px',
            maxHeight: 200,
            overflowY: 'auto',
            fontSize: 11,
            fontFamily: 'monospace',
            lineHeight: '1.6',
            color: 'var(--text-secondary)',
          }}>
            {degenProgress.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {degenRunning && (
              <div style={{ color: '#fbbf24', animation: 'pulse 1.5s infinite' }}>
                Processing...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 8,
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

const primaryBtn: React.CSSProperties = {
  padding: '10px 20px',
  background: 'var(--accent)',
  color: 'white',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
};

const secondaryBtn: React.CSSProperties = {
  padding: '10px 20px',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  borderRadius: 6,
  border: '1px solid var(--border)',
  cursor: 'pointer',
  fontSize: 13,
};
