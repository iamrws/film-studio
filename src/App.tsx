import { useEffect } from 'react';
import { useProjectStore } from './stores/project-store';
import { ScreenplayEditor } from './screens/ScreenplayEditor';
import { Dashboard } from './screens/Dashboard';
import { CharacterBible } from './screens/CharacterBible';
import { ShotDesigner } from './screens/ShotDesigner';
import { GenerationQueue } from './screens/GenerationQueue';
import { ReviewGallery } from './screens/ReviewGallery';
import { Settings } from './screens/Settings';
import { EmotionalArc } from './screens/EmotionalArc';
import { Storyboard } from './screens/Storyboard';
import './App.css';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '◻' },
  { id: 'editor', label: 'Screenplay', icon: '✎' },
  { id: 'characters', label: 'Characters', icon: '☺' },
  { id: 'shots', label: 'Shot Designer', icon: '◎' },
  { id: 'arc', label: 'Emotional Arc', icon: '∿' },
  { id: 'storyboard', label: 'Storyboard', icon: '▦' },
  { id: 'queue', label: 'Queue', icon: '▶' },
  { id: 'review', label: 'Review', icon: '★' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
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

  // Load persisted state on mount
  useEffect(() => {
    loadFromDisk();
    loadPersistedApiKeys();
    initAutoSave();
  }, [loadFromDisk, loadPersistedApiKeys, initAutoSave]);

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
      <nav className="sidebar">
        <div className="sidebar-header">
          <h1 className="app-title">Film Studio</h1>
          <p className="project-name">
            {projectTitle || 'Untitled'}
            {isDirty && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>*</span>}
            {isSaving && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>saving...</span>}
          </p>
        </div>
        <ul className="nav-list">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                className={`nav-item ${activeScreen === item.id ? 'active' : ''}`}
                onClick={() => setActiveScreen(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="main-content">
        {activeScreen === 'dashboard' && <Dashboard />}
        {activeScreen === 'editor' && <ScreenplayEditor />}
        {activeScreen === 'characters' && <CharacterBible />}
        {activeScreen === 'shots' && <ShotDesigner />}
        {activeScreen === 'arc' && <EmotionalArc />}
        {activeScreen === 'storyboard' && <Storyboard />}
        {activeScreen === 'queue' && <GenerationQueue />}
        {activeScreen === 'review' && <ReviewGallery />}
        {activeScreen === 'settings' && <Settings />}
      </main>
    </div>
  );
}

export default App;
