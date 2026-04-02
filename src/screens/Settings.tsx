import { useState, useCallback } from 'react';
import { useProjectStore } from '../stores/project-store';
import { useGenerationStore } from '../stores/generation-store';
import { loadApiKeys } from '../services/persistence';
import type { PlatformId } from '../types/scene';
import type { GlobalStyle, QueuePlatformSettings, QueueSettings } from '../types/project';

const PLATFORMS: { id: PlatformId; name: string; description: string; keyField: string }[] = [
  { id: 'veo3', name: 'Veo 3 (Google Gemini)', description: 'Native audio, dialogue, frame chaining', keyField: 'gemini' },
  { id: 'sora2', name: 'Sora 2 (OpenAI)', description: 'Shot-list format', keyField: 'openai' },
  { id: 'kling3', name: 'Kling 3.0', description: 'Multi-shot connected clips', keyField: 'kling' },
  { id: 'seedance2', name: 'Seedance 2.0', description: '@Tag asset referencing', keyField: 'seedance' },
  { id: 'runwayGen4', name: 'Runway Gen-4', description: 'Motion-first prompting', keyField: 'runway' },
];

export function Settings() {
  const project = useProjectStore((s) => s.project);
  const updateSettings = useProjectStore((s) => s.updateSettings);
  const updateGlobalStyle = useProjectStore((s) => s.updateGlobalStyle);
  const persistApiKeys = useProjectStore((s) => s.persistApiKeys);
  const save = useProjectStore((s) => s.save);
  const saveAs = useProjectStore((s) => s.saveAs);
  const openProject = useProjectStore((s) => s.openProject);
  const resetProject = useProjectStore((s) => s.resetProject);
  const configureApi = useGenerationStore((s) => s.configureApi);

  // Load persisted API keys on mount (separate from project data)
  const [apiKeys, setApiKeys] = useState<Record<string, string>>(() => {
    const persisted = loadApiKeys();
    return { ...persisted, ...project.settings.apiKeys };
  });
  const [saved, setSaved] = useState(false);

  const handleSaveKeys = useCallback(() => {
    // Persist API keys separately from project
    persistApiKeys(apiKeys);
    updateSettings({ apiKeys });

    // Configure video platform adapters
    if (apiKeys['gemini']) configureApi('veo3', apiKeys['gemini']);
    if (apiKeys['openai']) configureApi('sora2', apiKeys['openai']);
    if (apiKeys['kling']) configureApi('kling3', apiKeys['kling']);
    if (apiKeys['seedance']) configureApi('seedance2', apiKeys['seedance']);
    if (apiKeys['runway']) configureApi('runwayGen4', apiKeys['runway']);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [apiKeys, updateSettings, persistApiKeys, configureApi]);

  const handleKeyChange = useCallback((key: string, value: string) => {
    setApiKeys((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleStyleChange = useCallback(
    (field: keyof GlobalStyle, value: string) => {
      updateGlobalStyle({ [field]: value });
    },
    [updateGlobalStyle]
  );

  const queueSettings = project.settings.queue;

  const handleQueueRootChange = useCallback(
    (field: keyof Pick<QueueSettings, 'maxConcurrent' | 'pollIntervalMs' | 'submissionDelayMs'>, raw: string) => {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed)) return;
      updateSettings({
        queue: {
          ...queueSettings,
          [field]: parsed,
        },
      });
    },
    [queueSettings, updateSettings]
  );

  const handleQueuePlatformChange = useCallback(
    (platform: PlatformId, field: keyof QueuePlatformSettings, raw: string) => {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed)) return;
      updateSettings({
        queue: {
          ...queueSettings,
          platform: {
            ...queueSettings.platform,
            [platform]: {
              ...queueSettings.platform[platform],
              [field]: parsed,
            },
          },
        },
      });
    },
    [queueSettings, updateSettings]
  );

  return (
    <div style={{ padding: 24, maxWidth: 800, overflowY: 'auto', height: '100%' }}>
      <h2 style={{ marginBottom: 24 }}>Settings</h2>

      {/* Project File Operations */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16, color: 'var(--accent)' }}>Project</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => save()} style={buttonStyle}>Save (Ctrl+S)</button>
          <button onClick={() => saveAs()} style={buttonStyle}>Save As...</button>
          <button onClick={() => openProject()} style={buttonStyle}>Open Project...</button>
          <button
            onClick={() => {
              if (confirm('Create a new project? Unsaved changes will be lost.')) {
                resetProject();
              }
            }}
            style={{ ...buttonStyle, background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
          >
            New Project
          </button>
        </div>
      </section>

      {/* API Keys */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16, color: 'var(--accent)' }}>API Keys</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          API keys are stored locally on your machine, never saved inside project files.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <KeyInput
            label="Claude API Key (LLM shot decomposition)"
            placeholder="sk-ant-..."
            value={apiKeys['claude'] || ''}
            onChange={(v) => handleKeyChange('claude', v)}
          />
          <KeyInput
            label="Google Gemini API Key (Veo 3 + LLM fallback)"
            placeholder="AIza..."
            value={apiKeys['gemini'] || ''}
            onChange={(v) => handleKeyChange('gemini', v)}
          />
          <KeyInput
            label="OpenAI API Key (Sora 2)"
            placeholder="sk-..."
            value={apiKeys['openai'] || ''}
            onChange={(v) => handleKeyChange('openai', v)}
          />
          <KeyInput
            label="Kling API Key (Kling 3.0)"
            placeholder="kling-..."
            value={apiKeys['kling'] || ''}
            onChange={(v) => handleKeyChange('kling', v)}
          />
          <KeyInput
            label="Seedance API Key (Seedance 2.0)"
            placeholder="sd-..."
            value={apiKeys['seedance'] || ''}
            onChange={(v) => handleKeyChange('seedance', v)}
          />
          <KeyInput
            label="Runway API Key (Gen-4)"
            placeholder="rw-..."
            value={apiKeys['runway'] || ''}
            onChange={(v) => handleKeyChange('runway', v)}
          />
        </div>

        <button onClick={handleSaveKeys} style={{ ...buttonStyle, marginTop: 12 }}>
          {saved ? 'Saved!' : 'Save API Keys'}
        </button>
      </section>

      {/* LLM Provider */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16, color: 'var(--accent)' }}>LLM Provider</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          {(['claude', 'gemini'] as const).map((provider) => (
            <button
              key={provider}
              onClick={() => updateSettings({ llmProvider: provider })}
              style={{
                ...buttonStyle,
                background:
                  project.settings.llmProvider === provider
                    ? 'var(--accent)'
                    : 'var(--bg-tertiary)',
              }}
            >
              {provider === 'claude' ? 'Claude (Anthropic)' : 'Gemini (Google)'}
            </button>
          ))}
        </div>
      </section>

      {/* Default Platform */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16, color: 'var(--accent)' }}>Default Video Platform</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PLATFORMS.map((p) => (
            <div
              key={p.id}
              onClick={() => updateSettings({ defaultPlatform: p.id })}
              style={{
                padding: '12px 16px',
                background:
                  project.settings.defaultPlatform === p.id
                    ? 'var(--accent-bg)'
                    : 'var(--bg-secondary)',
                border: `1px solid ${
                  project.settings.defaultPlatform === p.id ? 'var(--accent)' : 'var(--border)'
                }`,
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {p.description}
                  </div>
                </div>
                {apiKeys[p.keyField] && (
                  <span style={{ fontSize: 10, color: 'var(--emotion-very-positive)' }}>Key set</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Global Style */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16, color: 'var(--accent)' }}>
          Queue Reliability Runtime
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Controls retry and timeout behavior for generation recovery and restart resume.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Max Concurrent Jobs</label>
            <input
              type="number"
              min={1}
              max={6}
              value={queueSettings.maxConcurrent}
              onChange={(e) => handleQueueRootChange('maxConcurrent', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Poll Interval (ms)</label>
            <input
              type="number"
              min={2000}
              step={500}
              value={queueSettings.pollIntervalMs}
              onChange={(e) => handleQueueRootChange('pollIntervalMs', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Submission Delay (ms)</label>
            <input
              type="number"
              min={0}
              step={250}
              value={queueSettings.submissionDelayMs}
              onChange={(e) => handleQueueRootChange('submissionDelayMs', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PLATFORMS.map((platform) => (
            <div
              key={platform.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 10,
                background: 'var(--bg-secondary)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{platform.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Timeout (ms)</label>
                  <input
                    type="number"
                    min={5000}
                    step={1000}
                    value={queueSettings.platform[platform.id].timeoutMs}
                    onChange={(e) =>
                      handleQueuePlatformChange(platform.id, 'timeoutMs', e.target.value)
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Max Retries</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={queueSettings.platform[platform.id].maxRetries}
                    onChange={(e) =>
                      handleQueuePlatformChange(platform.id, 'maxRetries', e.target.value)
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Base Backoff (ms)</label>
                  <input
                    type="number"
                    min={1000}
                    step={500}
                    value={queueSettings.platform[platform.id].baseBackoffMs}
                    onChange={(e) =>
                      handleQueuePlatformChange(platform.id, 'baseBackoffMs', e.target.value)
                    }
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Global Style */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16, color: 'var(--accent)' }}>Global Style</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Aspect Ratio</label>
            <select
              value={project.globalStyle.aspectRatio}
              onChange={(e) => handleStyleChange('aspectRatio', e.target.value)}
              style={inputStyle}
            >
              <option value="16:9">16:9 (Widescreen)</option>
              <option value="21:9">21:9 (Cinematic)</option>
              <option value="4:3">4:3 (Classic)</option>
              <option value="9:16">9:16 (Vertical)</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Resolution</label>
            <select
              value={project.globalStyle.resolution}
              onChange={(e) => handleStyleChange('resolution', e.target.value)}
              style={inputStyle}
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4K">4K</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Film Style</label>
            <input
              value={project.globalStyle.filmStyle}
              onChange={(e) => handleStyleChange('filmStyle', e.target.value)}
              placeholder="e.g., cinematic, documentary, noir"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Era</label>
            <input
              value={project.globalStyle.era}
              onChange={(e) => handleStyleChange('era', e.target.value)}
              placeholder="e.g., 1970s, contemporary, futuristic"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Default Lens</label>
            <input
              value={project.globalStyle.defaultLens}
              onChange={(e) => handleStyleChange('defaultLens', e.target.value)}
              placeholder="e.g., 35mm, 50mm anamorphic"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Default Lighting</label>
            <input
              value={project.globalStyle.defaultLighting}
              onChange={(e) => handleStyleChange('defaultLighting', e.target.value)}
              placeholder="e.g., natural, high-key, chiaroscuro"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>Color Palette</label>
          <input
            value={project.globalStyle.colorPalette}
            onChange={(e) => handleStyleChange('colorPalette', e.target.value)}
            placeholder="e.g., warm earthy tones, desaturated cool blues"
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>Global Negative Prompt</label>
          <textarea
            value={project.globalStyle.globalNegativePrompt}
            onChange={(e) => handleStyleChange('globalNegativePrompt', e.target.value)}
            rows={3}
            style={{ ...inputStyle, width: '100%', resize: 'vertical' }}
          />
        </div>
      </section>
    </div>
  );
}

function KeyInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  marginBottom: 4,
  color: 'var(--text-secondary)',
};

const buttonStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--accent)',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
};
