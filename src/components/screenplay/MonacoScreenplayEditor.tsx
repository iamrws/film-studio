import { useCallback, useEffect, useRef } from 'react';
import Editor, { type OnMount, type Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onScrollToLine?: number;
}

const SCREENPLAY_LANG_ID = 'screenplay';

/**
 * Resolves a CSS custom property to its actual hex colour by temporarily
 * applying it to a DOM element and reading back the computed value.
 * Returns a #rrggbb string, or '#000000' as a safe fallback.
 */
function resolveVar(varName: string): string {
  const el = document.createElement('span');
  el.style.display = 'none';
  el.style.color = `var(${varName})`;
  document.documentElement.appendChild(el);
  const rgb = window.getComputedStyle(el).color;
  document.documentElement.removeChild(el);
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return '#000000';
  return '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
}

/** Strip the leading '#' — Monaco token rules use bare hex strings. */
function monacoFg(varName: string): string {
  return resolveVar(varName).slice(1);
}

function registerScreenplayLanguage(monaco: Monaco) {
  // Only register once
  if (monaco.languages.getLanguages().some((lang: { id: string }) => lang.id === SCREENPLAY_LANG_ID)) return;

  monaco.languages.register({ id: SCREENPLAY_LANG_ID });

  monaco.languages.setMonarchTokensProvider(SCREENPLAY_LANG_ID, {
    tokenizer: {
      root: [
        // Scene headings: INT./EXT. lines
        [/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|I\/E\.|INT |EXT ).*$/, 'scene-heading'],

        // Transitions: CUT TO:, FADE TO:, etc.
        [/^(CUT TO|FADE TO|DISSOLVE TO|SMASH CUT TO|MATCH CUT TO|FADE IN|FADE OUT|CROSS DISSOLVE|FADE TO BLACK|TIME CUT)[:.]*\s*$/, 'transition'],

        // Parentheticals: (beat), (whispers), etc.
        [/^\(.*\)$/, 'parenthetical'],

        // Shot directions: CLOSE ON -, ANGLE ON -, etc.
        [/^(CLOSE ON|ANGLE ON|WIDE ON|LONG LENS ON|ULTRA-WIDE).*$/, 'shot-direction'],

        // Character cues: ALL CAPS lines, 1-4 words, under 40 chars
        // This is a heuristic — matches uppercase-only lines with optional (CONT'D)/(V.O.)/(O.S.)
        [/^[A-Z][A-Z\s'.]{0,38}(\s*\(.*\))?\s*$/, 'character-cue'],

        // CUE/NOTE directives
        [/^(CUE|NOTE|INSERT)[:.].*$/, 'note-directive'],
      ],
    },
  });

  // Build theme colours from design-system CSS vars resolved at init time
  const accentHex = resolveVar('--film-accent-500');

  monaco.editor.defineTheme('screenplay-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'scene-heading',  foreground: monacoFg('--scene-heading'),       fontStyle: 'bold' },
      { token: 'character-cue',  foreground: monacoFg('--character-name'),      fontStyle: 'bold' },
      { token: 'parenthetical',  foreground: monacoFg('--color-neutral-400'),   fontStyle: 'italic' },
      { token: 'transition',     foreground: monacoFg('--transition') },
      { token: 'shot-direction', foreground: monacoFg('--film-warning') },
      { token: 'note-directive', foreground: monacoFg('--film-secondary-400'),  fontStyle: 'italic' },
    ],
    colors: {
      'editor.background':             resolveVar('--color-neutral-900'),
      'editor.foreground':             resolveVar('--color-neutral-100'),
      'editor.lineHighlightBackground': resolveVar('--color-neutral-850'),
      'editor.selectionBackground':    accentHex + '40',
      'editorLineNumber.foreground':   resolveVar('--color-neutral-700'),
      'editorLineNumber.activeForeground': resolveVar('--color-neutral-400'),
      'editorIndentGuide.background':  resolveVar('--color-neutral-700'),
    },
  });
}

export function MonacoScreenplayEditor({ value, onChange, onScrollToLine }: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      registerScreenplayLanguage(monaco);
      editor.updateOptions({
        fontFamily: "'Courier New', 'Courier', monospace",
        fontSize: 13,
        lineHeight: 21,
        wordWrap: 'on',
        wordWrapColumn: 80,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderLineHighlight: 'line',
        padding: { top: 16 },
        lineNumbers: 'on',
        glyphMargin: false,
        folding: false,
        tabSize: 4,
        automaticLayout: true,
      });
      // Set language after registration
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, SCREENPLAY_LANG_ID);
      }
    },
    []
  );

  const handleChange = useCallback(
    (val: string | undefined) => {
      if (val !== undefined) onChange(val);
    },
    [onChange]
  );

  // Scroll to line when onScrollToLine changes
  useEffect(() => {
    if (onScrollToLine !== undefined && editorRef.current) {
      editorRef.current.revealLineInCenter(onScrollToLine + 1);
      editorRef.current.setPosition({ lineNumber: onScrollToLine + 1, column: 1 });
    }
  }, [onScrollToLine]);

  return (
    <Editor
      height="100%"
      defaultLanguage="plaintext"
      theme="screenplay-dark"
      value={value}
      onChange={handleChange}
      onMount={handleEditorMount}
      options={{
        fontFamily: "'Courier New', 'Courier', monospace",
        fontSize: 13,
        minimap: { enabled: false },
        wordWrap: 'on',
      }}
    />
  );
}
