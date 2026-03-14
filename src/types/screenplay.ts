export type ElementType =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'shot'
  | 'note'
  | 'page_break';

export interface ScreenplayElement {
  type: ElementType;
  text: string;
  sceneIndex: number;
  lineStart: number;
  lineEnd: number;
}

export interface TitlePage {
  title: string;
  author: string;
  date: string;
  draft: string;
}

export interface SceneHeading {
  prefix: 'INT' | 'EXT' | 'INT/EXT' | 'EXT/INT' | 'I/E';
  location: string;
  time: string;
  raw: string;
}

export interface ParsedScreenplay {
  titlePage: TitlePage | null;
  elements: ScreenplayElement[];
  sceneCount: number;
  characters: string[];
  locations: string[];
}

export interface ScreenplayDocument {
  rawText: string;
  format: 'fountain' | 'markdown' | 'plain';
  parsed: ParsedScreenplay | null;
}
