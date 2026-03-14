import { useCallback, useEffect, useRef } from 'react';
import Editor, { type OnMount, type Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onScrollToLine?: number;
}

const SCREENPLAY_LANG_ID = 'screenplay';

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

  // Define the dark theme for screenplay
  monaco.editor.defineTheme('screenplay-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'scene-heading', foreground: '60a5fa', fontStyle: 'bold' },
      { token: 'character-cue', foreground: '4ade80', fontStyle: 'bold' },
      { token: 'parenthetical', foreground: '999999', fontStyle: 'italic' },
      { token: 'transition', foreground: 'f87171' },
      { token: 'shot-direction', foreground: 'fbbf24' },
      { token: 'note-directive', foreground: 'a78bfa', fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': '#0f0f0f',
      'editor.foreground': '#e8e8e8',
      'editor.lineHighlightBackground': '#1a1a1a',
      'editor.selectionBackground': '#6366f140',
      'editorLineNumber.foreground': '#444444',
      'editorLineNumber.activeForeground': '#888888',
      'editorIndentGuide.background': '#333333',
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
