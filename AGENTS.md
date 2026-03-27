# AGENTS.md — Film Studio

> **ALWAYS save/push changes to:** https://github.com/iamrws/film-studio

---

## Project Overview

Film Studio is a **Tauri 2 + React 19 + TypeScript** desktop application for AI-powered film production. It generates screenplays from movie concept descriptions via LLM (Claude/Gemini), decomposes them into psychologically-annotated shots, and submits those shots to multiple AI video generation platforms.

**Important:** The app does NOT import screenplays — it generates them from a movie concept description via LLM.

---

## Architecture

### Stack
- **Frontend:** React 19, Vite 8, TypeScript 5.9, Zustand 5 (state), TailwindCSS 4
- **Backend:** Tauri 2.10 (Rust) — filesystem, dialogs, shell, HTTP downloads
- **Editor:** Monaco Editor (screenplay editing with syntax highlighting)
- **Validation:** Zod 4 (runtime schema validation)
- **Charts:** Recharts 3

### Directory Layout
```
film-studio/
├── src/
│   ├── screens/          # 9 main UI screens (Dashboard, Screenplay, Characters, etc.)
│   ├── components/       # Reusable components organized by feature
│   ├── stores/           # Zustand stores (project-store, generation-store)
│   ├── services/         # Business logic (LLM, parser, persistence, queue, prompts)
│   ├── adapters/         # Video platform adapters (Veo3, Sora2, Kling3, Seedance2, Runway)
│   ├── types/            # TypeScript interfaces (project, scene, character, screenplay)
│   ├── config/           # Screenplay patterns, psychology rules
│   ├── schemas/          # Zod validation schemas
│   └── hooks/            # Custom React hooks
├── src-tauri/            # Rust backend (Tauri commands, config, capabilities)
└── public/               # Static assets
```

### Key Patterns
- **Sidebar navigation** with 9 screens rendered conditionally in `App.tsx`
- **Zustand stores** for state — `project-store.ts` (main app) and `generation-store.ts` (video queue)
- **Adapter pattern** for video platforms — each implements `VideoAPIAdapter` interface
- **Psychology-first shot design** — shots carry emotion, arousal, valence, identification mode
- **Dual persistence** — Tauri native filesystem + localStorage fallback
- **Auto-save** every 30 seconds
- **Inline styles** (CSS-in-JS via style objects) — the codebase does NOT use CSS modules or styled-components

### Data Flow
1. User describes a movie concept → LLM generates a screenplay
2. Screenplay is parsed into scenes (validated parser, Fountain format)
3. Scenes are decomposed into shots via LLM (with psychology annotations)
4. Shots get platform-specific rendered prompts
5. Shots are queued and submitted to video generation platforms via adapters
6. Generation queue polls for completion, downloads results

---

## Decisions & Preferences

- **No screenplay imports** — the app generates screenplays from concept descriptions
- **Inline styles over CSS classes** for component-level styling (existing pattern)
- **Unicode icons** for sidebar navigation (no icon library)
- **Dark theme** with indigo accent (`#6366f1`), dark backgrounds (`#0f0f0f`, `#1a1a1a`)
- **Monospace font** (Courier New) for screenplay text

---

## In Progress: Kanban Prompt Board Feature

### Overview
Adding a Kanban-style "Prompt Board" screen for visual arrangement and batch submission of video generation prompts.

### Columns
- Backlog → Ready → Generating → Review → Done

### Key Files to Create
- `src/screens/PromptBoard.tsx`
- `src/components/board/BoardColumn.tsx`
- `src/components/board/BoardCard.tsx`
- `src/components/board/BoardToolbar.tsx`

### Key Files to Modify
- `src/types/scene.ts` — add `boardStatus` to `Shot`
- `src/stores/project-store.ts` — add board actions
- `src/App.tsx` — add nav item + screen route
- `src/services/llm-service.ts` — default `boardStatus` on shot creation

### New Dependency
- `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop
