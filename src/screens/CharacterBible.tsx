import { useState } from 'react';
import { useProjectStore } from '../stores/project-store';
import { extractCharactersFromScreenplay } from '../services/llm-service';
import type { Character } from '../types/character';

export function CharacterBible() {
  const parsed = useProjectStore((s) => s.project.screenplay.parsed);
  const rawText = useProjectStore((s) => s.project.screenplay.rawText);
  const characters = useProjectStore((s) => s.project.characterBible.characters);
  const scenes = useProjectStore((s) => s.project.scenes);
  const settings = useProjectStore((s) => s.project.settings);
  const conceptContext = useProjectStore((s) => s.project.conceptContext);
  const updateCharacters = useProjectStore((s) => s.updateCharacters);

  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChar, setSelectedChar] = useState<string | null>(null);

  const detectedCharacters = parsed?.characters ?? [];

  // Count scenes per character
  const sceneCounts = new Map<string, number>();
  for (const scene of scenes) {
    for (const char of scene.charactersPresent) {
      sceneCounts.set(char, (sceneCounts.get(char) ?? 0) + 1);
    }
  }

  const handleExtract = async () => {
    const apiKey = settings.apiKeys[settings.llmProvider];
    if (!apiKey) {
      setError(`No API key set for ${settings.llmProvider}. Go to Settings to add one.`);
      return;
    }

    setExtracting(true);
    setError(null);

    try {
      const extracted = await extractCharactersFromScreenplay(
        rawText,
        detectedCharacters,
        { provider: settings.llmProvider, apiKey },
        conceptContext
          ? { concept: conceptContext.concept, genre: conceptContext.genre || undefined, tone: conceptContext.tone || undefined }
          : undefined
      );

      const fullCharacters: Character[] = extracted.map((c) => ({
        id: crypto.randomUUID(),
        referenceImages: [],
        ...c,
      }));

      updateCharacters(fullCharacters);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtracting(false);
    }
  };

  const selectedCharData = selectedChar
    ? characters.find((c) => c.name === selectedChar)
    : null;

  return (
    <div className="character-bible">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Character Bible</h2>
        <button
          onClick={handleExtract}
          disabled={extracting || !rawText}
          style={{
            padding: '8px 16px',
            background: extracting ? '#555' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: extracting ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {extracting
            ? 'Extracting characters...'
            : characters.length > 0
              ? 'Re-Extract with AI'
              : 'Extract Characters with AI'}
        </button>
      </div>

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

      {extracting && (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>
          Analyzing screenplay for character profiles and consistency anchors...
        </div>
      )}

      {detectedCharacters.length === 0 && characters.length === 0 ? (
        <div className="empty-state">
          <h3>No characters detected</h3>
          <p>Parse a screenplay first to auto-detect characters.</p>
        </div>
      ) : (
        <>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 13 }}>
            {detectedCharacters.length} characters detected from screenplay.
            {characters.length === 0
              ? ' Click "Extract Characters with AI" to generate full profiles.'
              : ' Click a card to view details.'}
          </p>

          <div style={{ display: 'flex', gap: 16 }}>
            {/* Character grid */}
            <div className="character-grid" style={{ flex: 1 }}>
              {(characters.length > 0 ? characters : detectedCharacters.map((name) => ({ name }))).map((char) => {
                const name = typeof char === 'string' ? char : char.name;
                const existing = characters.find((c) => c.name === name);
                const sceneCount = sceneCounts.get(name) ?? 0;
                const isSelected = selectedChar === name;

                return (
                  <div
                    key={name}
                    className="character-card"
                    onClick={() => setSelectedChar(isSelected ? null : name)}
                    style={{
                      cursor: existing ? 'pointer' : 'default',
                      border: isSelected
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border)',
                      padding: isSelected ? 11 : 12,
                    }}
                  >
                    <div className="char-name">{name}</div>
                    {existing?.consistencyAnchor ? (
                      <div className="char-anchor" style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                        "{existing.consistencyAnchor}"
                      </div>
                    ) : (
                      <div className="char-anchor" style={{ color: 'var(--warning)', fontSize: 11 }}>
                        No consistency anchor defined
                      </div>
                    )}
                    <div className="char-scenes" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Appears in {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail panel */}
            {selectedCharData && (
              <div
                style={{
                  flex: 1,
                  maxWidth: 400,
                  padding: 16,
                  background: 'var(--bg-secondary)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 13,
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>{selectedCharData.name}</h3>

                <Section title="Consistency Anchor">
                  <p style={{ fontStyle: 'italic' }}>"{selectedCharData.consistencyAnchor}"</p>
                </Section>

                <Section title="Appearance">
                  <Detail label="Age" value={selectedCharData.appearance.age} />
                  <Detail label="Ethnicity" value={selectedCharData.appearance.ethnicity} />
                  <Detail label="Build" value={selectedCharData.appearance.build} />
                  <Detail label="Hair" value={selectedCharData.appearance.hair} />
                  <Detail label="Face" value={selectedCharData.appearance.face} />
                  {selectedCharData.appearance.distinguishingFeatures.length > 0 && (
                    <Detail
                      label="Distinguishing"
                      value={selectedCharData.appearance.distinguishingFeatures.join(', ')}
                    />
                  )}
                </Section>

                <Section title="Wardrobe">
                  <p>{selectedCharData.wardrobe.default}</p>
                </Section>

                <Section title="Voice">
                  <Detail label="Quality" value={selectedCharData.voice.quality} />
                  <Detail label="Accent" value={selectedCharData.voice.accent} />
                  <Detail label="Speech" value={selectedCharData.voice.speechPattern} />
                </Section>

                {selectedCharData.mannerisms.length > 0 && (
                  <Section title="Mannerisms">
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {selectedCharData.mannerisms.map((m, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>{m}</li>
                      ))}
                    </ul>
                  </Section>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 80 }}>{label}:</span>
      <span>{value}</span>
    </div>
  );
}
