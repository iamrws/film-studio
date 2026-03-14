/**
 * Persistence Service
 *
 * Handles project save/load with a dual-mode approach:
 *   - Tauri mode: Uses @tauri-apps/plugin-fs for native file system access
 *   - Browser mode: Falls back to localStorage for dev/preview
 *
 * Projects are stored as JSON files. Auto-save runs on a configurable interval.
 * API keys are stored separately from project data for security.
 */

import type { FilmProject } from '../types/project';

const STORAGE_KEY = 'film-studio:current-project';
const RECENT_PROJECTS_KEY = 'film-studio:recent-projects';
const API_KEYS_KEY = 'film-studio:api-keys';
const AUTO_SAVE_INTERVAL_MS = 30_000; // 30 seconds

export interface RecentProject {
  title: string;
  filePath: string;
  lastOpened: string;
}

// ─── Tauri Detection ──────────────────────────────────────

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// ─── Project Save/Load ────────────────────────────────────

export async function saveProject(project: FilmProject, filePath?: string): Promise<string> {
  const json = JSON.stringify(project, null, 2);

  if (isTauri() && filePath) {
    const { writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs');
    // Ensure parent directory exists
    const dir = filePath.replace(/[/\\][^/\\]+$/, '');
    try {
      await mkdir(dir, { recursive: true });
    } catch {
      // Directory may already exist
    }
    await writeTextFile(filePath, json);
    addRecentProject(project.metadata.title, filePath);
    return filePath;
  }

  // Browser fallback: localStorage
  localStorage.setItem(STORAGE_KEY, json);
  return 'localStorage';
}

export async function loadProject(filePath?: string): Promise<FilmProject | null> {
  if (isTauri() && filePath) {
    try {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const json = await readTextFile(filePath);
      const project = JSON.parse(json) as FilmProject;
      addRecentProject(project.metadata.title, filePath);
      return project;
    } catch {
      return null;
    }
  }

  // Browser fallback
  const json = localStorage.getItem(STORAGE_KEY);
  if (!json) return null;
  try {
    return JSON.parse(json) as FilmProject;
  } catch {
    return null;
  }
}

export async function saveProjectAs(project: FilmProject): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const filePath = await save({
      title: 'Save Project',
      defaultPath: `${project.metadata.title || 'Untitled'}.filmstudio`,
      filters: [{ name: 'Film Studio Project', extensions: ['filmstudio', 'json'] }],
    });
    if (!filePath) return null;
    await saveProject(project, filePath);
    return filePath;
  }

  // Browser fallback: download as file
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.metadata.title || 'Untitled'}.filmstudio`;
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem(STORAGE_KEY, json);
  return 'download';
}

export async function openProjectDialog(): Promise<FilmProject | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const filePath = await open({
      title: 'Open Project',
      filters: [{ name: 'Film Studio Project', extensions: ['filmstudio', 'json'] }],
      multiple: false,
    });
    if (!filePath) return null;
    return loadProject(filePath as string);
  }

  // Browser fallback: file input
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.filmstudio,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const text = await file.text();
        const project = JSON.parse(text) as FilmProject;
        localStorage.setItem(STORAGE_KEY, text);
        resolve(project);
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}

// ─── Recent Projects ──────────────────────────────────────

function addRecentProject(title: string, filePath: string): void {
  const recents = getRecentProjects();
  const filtered = recents.filter((r) => r.filePath !== filePath);
  filtered.unshift({ title, filePath, lastOpened: new Date().toISOString() });
  const trimmed = filtered.slice(0, 10);
  localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(trimmed));
}

export function getRecentProjects(): RecentProject[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_PROJECTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearRecentProjects(): void {
  localStorage.removeItem(RECENT_PROJECTS_KEY);
}

// ─── API Key Storage ──────────────────────────────────────
// Stored separately from project data so they're never serialized into .filmstudio files

export function saveApiKeys(keys: Record<string, string>): void {
  localStorage.setItem(API_KEYS_KEY, JSON.stringify(keys));
}

export function loadApiKeys(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(API_KEYS_KEY) || '{}');
  } catch {
    return {};
  }
}

// ─── Auto-Save ────────────────────────────────────────────

let autoSaveTimer: ReturnType<typeof setInterval> | null = null;
let currentFilePath: string | null = null;

export function setCurrentFilePath(path: string | null): void {
  currentFilePath = path;
}

export function getCurrentFilePath(): string | null {
  return currentFilePath;
}

export function startAutoSave(getProject: () => FilmProject): () => void {
  stopAutoSave();

  autoSaveTimer = setInterval(async () => {
    try {
      const project = getProject();
      await saveProject(project, currentFilePath || undefined);
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  }, AUTO_SAVE_INTERVAL_MS);

  return stopAutoSave;
}

export function stopAutoSave(): void {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}

// ─── Import Screenplay File ──────────────────────────────

export async function importScreenplayFile(): Promise<string | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const filePath = await open({
      title: 'Import Screenplay',
      filters: [
        { name: 'Screenplay', extensions: ['txt', 'md', 'fountain'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      multiple: false,
    });
    if (!filePath) return null;

    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    return readTextFile(filePath as string);
  }

  // Browser fallback
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.fountain';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      resolve(await file.text());
    };
    input.click();
  });
}
