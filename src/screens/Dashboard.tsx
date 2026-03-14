import { useState, useCallback } from 'react';
import { useProjectStore } from '../stores/project-store';
import { generateScreenplay } from '../services/llm-service';

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

  const [concept, setConcept] = useState('');
  const [genre, setGenre] = useState('');
  const [tone, setTone] = useState('');
  const [targetLength, setTargetLength] = useState<'short' | 'medium' | 'feature'>('medium');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={generating || !concept.trim()}
        style={{
          width: '100%',
          padding: '14px 24px',
          fontSize: 16,
          fontWeight: 700,
          borderRadius: 8,
          border: 'none',
          background: generating || !concept.trim() ? '#555' : 'var(--accent)',
          color: '#fff',
          cursor: generating || !concept.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {generating ? 'Writing your screenplay...' : 'Generate Screenplay'}
      </button>

      {generating && (
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          This may take 30-60 seconds depending on length.
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
