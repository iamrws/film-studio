import { useCallback, useState } from 'react';
import { useProjectStore } from '../stores/project-store';
import { MonacoScreenplayEditor } from '../components/screenplay/MonacoScreenplayEditor';
import { generateScreenplay } from '../services/llm-service';
import type { ExtractedScene } from '../services/screenplay-parser';
import { extractScenes } from '../services/screenplay-parser';

export function ScreenplayEditor() {
  const rawText = useProjectStore((s) => s.project.screenplay.rawText);
  const parsed = useProjectStore((s) => s.project.screenplay.parsed);
  const settings = useProjectStore((s) => s.project.settings);
  const updateScreenplayText = useProjectStore((s) => s.updateScreenplayText);
  const parseCurrentScreenplay = useProjectStore((s) => s.parseCurrentScreenplay);
  const selectedSceneIndex = useProjectStore((s) => s.selectedSceneIndex);
  const setSelectedScene = useProjectStore((s) => s.setSelectedScene);
  const setActiveScreen = useProjectStore((s) => s.setActiveScreen);
  const [scrollToLine, setScrollToLine] = useState<number | undefined>(undefined);
  const [regenerating, setRegenerating] = useState(false);
  const [regenPrompt, setRegenPrompt] = useState('');
  const [showRegenPanel, setShowRegenPanel] = useState(false);

  const scenes: ExtractedScene[] = parsed ? extractScenes(parsed) : [];

  const handleParse = useCallback(() => {
    parseCurrentScreenplay();
  }, [parseCurrentScreenplay]);

  const handleSceneClick = useCallback(
    (scene: ExtractedScene) => {
      setSelectedScene(scene.index);
      setScrollToLine(scene.startLine);
    },
    [setSelectedScene]
  );

  const handleRegenerate = useCallback(async () => {
    const apiKey = settings.apiKeys[settings.llmProvider];
    if (!apiKey) return;

    setRegenerating(true);
    try {
      const screenplay = await generateScreenplay(
        {
          concept: regenPrompt || 'Rewrite and improve the following screenplay concept',
          additionalNotes: `Here is the current screenplay to revise and improve:\n\n${rawText.slice(0, 12000)}`,
        },
        { provider: settings.llmProvider, apiKey }
      );
      updateScreenplayText(screenplay);
      parseCurrentScreenplay();
      setShowRegenPanel(false);
      setRegenPrompt('');
    } catch (err) {
      console.error('Regeneration failed:', err);
    } finally {
      setRegenerating(false);
    }
  }, [regenPrompt, rawText, settings, updateScreenplayText, parseCurrentScreenplay]);

  // If there's no screenplay yet, nudge them to the dashboard
  if (!rawText) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <h3 style={{ marginBottom: 12 }}>No Screenplay Yet</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
          Describe your movie on the Dashboard and the AI will write it for you.
        </p>
        <button
          onClick={() => setActiveScreen('dashboard')}
          style={{
            padding: '10px 24px',
            background: 'var(--accent)',
            color: 'var(--text-on-accent)',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="screenplay-editor">
      <div className="editor-panel">
        <div className="editor-toolbar">
          <button className="primary" onClick={handleParse}>
            Re-Parse
          </button>
          <button onClick={() => setShowRegenPanel(!showRegenPanel)}>
            {showRegenPanel ? 'Cancel' : 'Regenerate with AI'}
          </button>
          <span style={{ flex: 1 }} />
          {parsed && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {parsed.sceneCount} scenes | {parsed.characters.length} characters |{' '}
              {parsed.locations.length} locations
            </span>
          )}
        </div>

        {/* Regeneration panel */}
        {showRegenPanel && (
          <div style={{
            padding: '12px 16px',
            background: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
          }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                What should change?
              </label>
              <textarea
                value={regenPrompt}
                onChange={(e) => setRegenPrompt(e.target.value)}
                placeholder="e.g., Make the ending darker, add a twist where the villain is actually the protagonist's father, more dialogue in scene 3..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  resize: 'none',
                  outline: 'none',
                }}
              />
            </div>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              style={{
                padding: '8px 16px',
                background: regenerating ? 'var(--bg-disabled)' : 'var(--accent)',
                color: 'var(--text-on-accent)',
                border: 'none',
                borderRadius: 4,
                cursor: regenerating ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {regenerating ? 'Rewriting...' : 'Regenerate'}
            </button>
          </div>
        )}

        <div className="editor-container">
          <MonacoScreenplayEditor
            value={rawText}
            onChange={updateScreenplayText}
            onScrollToLine={scrollToLine}
          />
        </div>
      </div>

      <div className="scene-tree-panel">
        <div className="scene-tree-header">
          <span>Scene Breakdown</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {scenes.length} scenes
          </span>
        </div>
        <div className="scene-tree-list">
          {scenes.length === 0 && (
            <div className="empty-state" style={{ padding: 24 }}>
              <p>Click "Re-Parse" to extract scenes</p>
            </div>
          )}
          {scenes.map((scene) => (
            <div
              key={scene.index}
              className={`scene-tree-item ${selectedSceneIndex === scene.index ? 'selected' : ''}`}
              onClick={() => handleSceneClick(scene)}
            >
              <div className="scene-number">Scene {scene.index + 1}</div>
              <div className="scene-heading">
                {scene.heading.prefix}. {scene.heading.location}
                {scene.heading.time ? ` - ${scene.heading.time}` : ''}
              </div>
              {scene.characters.length > 0 && (
                <div className="scene-chars">
                  {scene.characters.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
        {parsed && (
          <div className="parse-stats">
            <div className="stat">
              Elements: <span className="stat-value">{parsed.elements.length}</span>
            </div>
            <div className="stat">
              Lines: <span className="stat-value">{rawText.split('\n').length}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
