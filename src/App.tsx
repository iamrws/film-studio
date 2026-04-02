import { useEffect } from 'react';
import { useProjectStore } from './stores/project-store';
import { useGenerationStore } from './stores/generation-store';
import { ScreenplayEditor } from './screens/ScreenplayEditor';
import { Dashboard } from './screens/Dashboard';
import { CharacterBible } from './screens/CharacterBible';
import { ShotDesigner } from './screens/ShotDesigner';
import { GenerationQueue } from './screens/GenerationQueue';
import { ReviewGallery } from './screens/ReviewGallery';
import { Settings } from './screens/Settings';
import { EmotionalArc } from './screens/EmotionalArc';
import { Storyboard } from './screens/Storyboard';
import { PromptBoard } from './screens/PromptBoard';
import { BRollStudio } from './screens/BRollStudio';
import './App.css';

/* SVG icon components — inline so no external dependency needed */
function IconDashboard() {
  return (
    <svg className="nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2" y="2" width="6" height="6" rx="1.5" />
      <rect x="10" y="2" width="6" height="6" rx="1.5" />
      <rect x="2" y="10" width="6" height="6" rx="1.5" />
      <rect x="10" y="10" width="6" height="6" rx="1.5" />
    </svg>
  );
}
function IconScreenplay() {
  return (
    <svg className="nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="2" width="12" height="14" rx="1.5" />
      <line x1="6" y1="6" x2="12" y2="6" />
      <line x1="6" y1="9" x2="12" y2="9" />
      <line x1="6" y1="12" x2="10" y2="12" />
    </svg>
  );
}
function IconCharacters() {
  return (
    <svg className="nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="9" cy="6" r="3" />
      <path d="M3 16c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeLinecap="round" />
    </svg>
  );
}
function IconShots() {
  return (
    <svg className="nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2" y="4" width="14" height="10" rx="1.5" />
      <path d="M7 8l4 2-4 2V8z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconArc() {
  return (
    <svg className="nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <polyline points="2,14 5,8 8,11 11,5 14,9 16,7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconStoryboard() {
  return (
    <svg className="nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2" y="4" width="5" height="4" rx="1" />
      <rect x="9" y="4" width="5" height="4" rx="1" />
      <line x1="7" y1="6" x2="9" y2="6" />
      <rect x="2" y="11" width="5" height="4" rx="1" />
      <rect x="9" y="11" width="5" height="4" rx="1" />
    </svg>
  );
}
function IconBRoll() {
  return (
    <svg className="nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="9" cy="9" r="7" />
      <circle cx="9" cy="9" r="2.5" />
      <line x1="2" y1="9" x2="6.5" y2="9" />
      <line x1="11.5" y1="9" x2="16" y2="9" />
    </svg>
  );
}
function IconBoard() {
  return (
    <svg className="nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2" y="3" width="4" height="12" rx="1" />
      <rect x="7" y="3" width="4" height="7" rx="1" />
      <rect x="12" y="3" width="4" height="10" rx="1" />
    </svg>
  );
}
function IconQueue() {
  return (
    <svg className="nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <line x1="3" y1="5" x2="15" y2="5" strokeLinecap="round" />
      <line x1="3" y1="9" x2="15" y2="9" strokeLinecap="round" />
      <line x1="3" y1="13" x2="10" y2="13" strokeLinecap="round" />
      <polyline points="12,11 15,13 12,15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconReview() {
  return (
    <svg className="nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2" y="4" width="5" height="5" rx="1" />
      <rect x="9" y="4" width="5" height="5" rx="1" />
      <rect x="2" y="11" width="5" height="5" rx="1" />
      <rect x="9" y="11" width="5" height="5" rx="1" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg className="nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="9" cy="9" r="2.5" />
      <path d="M9 2v1.5M9 14.5V16M2 9h1.5M14.5 9H16M3.93 3.93l1.06 1.06M13.01 13.01l1.06 1.06M14.07 3.93l-1.06 1.06M4.99 13.01l-1.06 1.06" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',    Icon: IconDashboard },
  { id: 'editor',     label: 'Screenplay',   Icon: IconScreenplay },
  { id: 'characters', label: 'Characters',   Icon: IconCharacters },
  { id: 'shots',      label: 'Shot Designer', Icon: IconShots },
  { id: 'arc',        label: 'Emotional Arc', Icon: IconArc },
  { id: 'storyboard', label: 'Storyboard',   Icon: IconStoryboard },
  { id: 'broll',      label: 'B-Roll',       Icon: IconBRoll },
  { id: 'board',      label: 'Prompt Board', Icon: IconBoard },
  { id: 'queue',      label: 'Queue',        Icon: IconQueue },
  { id: 'review',     label: 'Review',       Icon: IconReview },
  { id: 'settings',   label: 'Settings',     Icon: IconSettings },
] as const;

function App() {
  const activeScreen = useProjectStore((s) => s.activeScreen);
  const setActiveScreen = useProjectStore((s) => s.setActiveScreen);
  const projectTitle = useProjectStore((s) => s.project.metadata.title);
  const isDirty = useProjectStore((s) => s.isDirty);
  const isSaving = useProjectStore((s) => s.isSaving);
  const save = useProjectStore((s) => s.save);
  const loadFromDisk = useProjectStore((s) => s.loadFromDisk);
  const initAutoSave = useProjectStore((s) => s.initAutoSave);
  const loadPersistedApiKeys = useProjectStore((s) => s.loadPersistedApiKeys);
  const projectSettings = useProjectStore((s) => s.project.settings);
  const syncFromProjectSettings = useGenerationStore((s) => s.syncFromProjectSettings);

  useEffect(() => {
    loadFromDisk();
    loadPersistedApiKeys();
    initAutoSave();
  }, [loadFromDisk, loadPersistedApiKeys, initAutoSave]);

  useEffect(() => {
    syncFromProjectSettings(projectSettings);
  }, [projectSettings, syncFromProjectSettings]);

  // Ctrl+S / Cmd+S save handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [save]);

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Main navigation">
        <div className="sidebar-header">
          <h1 className="app-title">
            <span className="app-title-dot" aria-hidden="true" />
            Film Studio
          </h1>
          <p className="project-name" title={projectTitle || 'Untitled'}>
            {projectTitle || 'Untitled'}
            {isDirty && <span style={{ color: 'var(--accent)', marginLeft: 4 }} aria-label="unsaved changes">*</span>}
            {isSaving && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>saving…</span>}
          </p>
        </div>
        <ul className="nav-list" role="list">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                className={`nav-item ${activeScreen === item.id ? 'active' : ''}`}
                onClick={() => setActiveScreen(item.id)}
                aria-current={activeScreen === item.id ? 'page' : undefined}
              >
                <item.Icon />
                <span className="nav-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="main-content" aria-label={`${NAV_ITEMS.find(i => i.id === activeScreen)?.label ?? ''} view`}>
        {activeScreen === 'dashboard'  && <Dashboard />}
        {activeScreen === 'editor'     && <ScreenplayEditor />}
        {activeScreen === 'characters' && <CharacterBible />}
        {activeScreen === 'shots'      && <ShotDesigner />}
        {activeScreen === 'arc'        && <EmotionalArc />}
        {activeScreen === 'storyboard' && <Storyboard />}
        {activeScreen === 'broll'      && <BRollStudio />}
        {activeScreen === 'board'      && <PromptBoard />}
        {activeScreen === 'queue'      && <GenerationQueue />}
        {activeScreen === 'review'     && <ReviewGallery />}
        {activeScreen === 'settings'   && <Settings />}
      </main>
    </div>
  );
}

export default App;
