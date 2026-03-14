export interface CharacterAppearance {
  age: string;
  ethnicity: string;
  build: string;
  hair: string;
  face: string;
  distinguishingFeatures: string[];
}

export interface WardrobeVariation {
  sceneRange: string;
  description: string;
}

export interface CharacterWardrobe {
  default: string;
  variations: WardrobeVariation[];
}

export interface CharacterVoice {
  quality: string;
  accent: string;
  speechPattern: string;
}

export interface Character {
  id: string;
  name: string;
  appearance: CharacterAppearance;
  wardrobe: CharacterWardrobe;
  voice: CharacterVoice;
  mannerisms: string[];
  referenceImages: string[];
  /** 30-word frozen description used verbatim in every prompt. NEVER changes between shots. */
  consistencyAnchor: string;
}

export interface CharacterBible {
  characters: Character[];
}
