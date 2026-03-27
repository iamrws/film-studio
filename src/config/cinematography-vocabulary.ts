export const CAMERA_SHOT_TYPES = [
  'CLOSE-UP',
  'EXTREME CLOSE-UP',
  'MEDIUM CLOSE-UP',
  'MEDIUM SHOT',
  'WIDE SHOT',
  'LONG SHOT',
  'FULL SHOT',
  'EXTREME WIDE SHOT',
  'AERIAL SHOT',
  'OVER-THE-SHOULDER',
  'TWO-SHOT',
  'INSERT SHOT',
  'ESTABLISHING SHOT',
  'POINT OF VIEW',
] as const;

export const CAMERA_SHOT_TYPE_SET = new Set(CAMERA_SHOT_TYPES);

export const CAMERA_MOVEMENTS = [
  'STATIC',
  'DOLLY IN',
  'DOLLY OUT',
  'PAN',
  'PAN LEFT',
  'PAN RIGHT',
  'TILT',
  'TILT UP',
  'TILT DOWN',
  'TRACK',
  'TRACKING',
  'CRANE UP',
  'CRANE DOWN',
  'TRUCK LEFT',
  'TRUCK RIGHT',
  'PEDESTAL UP',
  'PEDESTAL DOWN',
  'BOOM UP',
  'BOOM DOWN',
  'STEADICAM',
  'HANDHELD',
  'FOLLOW SHOT',
  'LEADING SHOT',
  'WHIP PAN',
  'ORBIT',
  'ROLL',
  'DOLLY ZOOM',
  'CRASH ZOOM',
  'RACK FOCUS',
  'DRONE FLYOVER',
  'DRONE REVEAL',
  'FPV DRONE DIVE',
  'HYPERLAPSE',
  'BULLET TIME',
  'ZOOM IN',
  'ZOOM OUT',
] as const;

export const CAMERA_MOVEMENT_SET = new Set(CAMERA_MOVEMENTS);

export const CAMERA_ANGLES = [
  'EYE LEVEL',
  'HIGH ANGLE',
  'SLIGHTLY HIGH',
  'LOW ANGLE',
  'SLIGHTLY LOW',
  "BIRD'S-EYE VIEW",
  "WORM'S-EYE VIEW",
  'DUTCH ANGLE',
] as const;

export const CAMERA_ANGLE_SET = new Set(CAMERA_ANGLES);

export const LENS_TERMS = [
  '8MM',
  '14MM',
  '16MM',
  '18MM',
  '24MM',
  '28MM',
  '35MM',
  '50MM',
  '70MM',
  '85MM',
  '100MM',
  '135MM',
  '200MM',
  '300MM',
  'WIDE-ANGLE',
  'ULTRA-WIDE',
  'TELEPHOTO',
  'MACRO',
  'FISHEYE',
  'ANAMORPHIC',
  'TILT-SHIFT',
] as const;

export const LENS_TERM_SET = new Set(LENS_TERMS);

export const LIGHTING_STYLES = [
  'HIGH-KEY',
  'LOW-KEY',
  'NATURALISTIC',
  'CHIAROSCURO',
  'SOFT KEY',
  'HARD KEY',
  'REMBRANDT',
  'BUTTERFLY',
  'PARAMOUNT',
  'SPLIT',
  'RIM LIGHTING',
  'PRACTICAL LIGHTING',
  'THREE-POINT',
  'GOLDEN HOUR',
  'BLUE HOUR',
  'NEON PRACTICALS',
  'VOLUMETRIC',
  'BACKLIT',
  'SILHOUETTE',
] as const;

export const LIGHTING_STYLE_SET = new Set(LIGHTING_STYLES);

const SHOT_TYPE_ALIASES: Record<string, string> = {
  'close up': 'CLOSE-UP',
  closeup: 'CLOSE-UP',
  'extreme close up': 'EXTREME CLOSE-UP',
  xcu: 'EXTREME CLOSE-UP',
  ecu: 'EXTREME CLOSE-UP',
  'medium close up': 'MEDIUM CLOSE-UP',
  mcu: 'MEDIUM CLOSE-UP',
  'medium shot': 'MEDIUM SHOT',
  ms: 'MEDIUM SHOT',
  'wide shot': 'WIDE SHOT',
  ws: 'WIDE SHOT',
  'long shot': 'LONG SHOT',
  ls: 'LONG SHOT',
  'full shot': 'FULL SHOT',
  fs: 'FULL SHOT',
  'extreme wide shot': 'EXTREME WIDE SHOT',
  'extreme wide': 'EXTREME WIDE SHOT',
  xws: 'EXTREME WIDE SHOT',
  'aerial shot': 'AERIAL SHOT',
  aerial: 'AERIAL SHOT',
  'over the shoulder': 'OVER-THE-SHOULDER',
  ots: 'OVER-THE-SHOULDER',
  'two shot': 'TWO-SHOT',
  'two-shot': 'TWO-SHOT',
  'insert shot': 'INSERT SHOT',
  insert: 'INSERT SHOT',
  'establishing shot': 'ESTABLISHING SHOT',
  'point of view': 'POINT OF VIEW',
  pov: 'POINT OF VIEW',
};

const MOVEMENT_ALIASES: Record<string, string> = {
  'push in': 'DOLLY IN',
  'push-in': 'DOLLY IN',
  'push': 'DOLLY IN',
  'pull back': 'DOLLY OUT',
  'pull-back': 'DOLLY OUT',
  'pull out': 'DOLLY OUT',
  'pull-out': 'DOLLY OUT',
  'dolly in': 'DOLLY IN',
  'dolly out': 'DOLLY OUT',
  'track in': 'DOLLY IN',
  'track out': 'DOLLY OUT',
  'truck left': 'TRUCK LEFT',
  'truck right': 'TRUCK RIGHT',
  'lateral left': 'TRUCK LEFT',
  'lateral right': 'TRUCK RIGHT',
  truck: 'TRACKING',
  'pedestal up': 'PEDESTAL UP',
  'pedestal down': 'PEDESTAL DOWN',
  'boom up': 'BOOM UP',
  'boom down': 'BOOM DOWN',
  'tracking shot': 'TRACKING',
  tracking: 'TRACKING',
  steadicam: 'STEADICAM',
  pan: 'PAN',
  'pan left': 'PAN LEFT',
  'pan right': 'PAN RIGHT',
  tilt: 'TILT',
  'tilt up': 'TILT UP',
  'tilt down': 'TILT DOWN',
  track: 'TRACK',
  'crane up': 'CRANE UP',
  'crane down': 'CRANE DOWN',
  handheld: 'HANDHELD',
  'hand held': 'HANDHELD',
  'follow shot': 'FOLLOW SHOT',
  'following shot': 'FOLLOW SHOT',
  'leading shot': 'LEADING SHOT',
  'whip pan': 'WHIP PAN',
  'swish pan': 'WHIP PAN',
  orbit: 'ORBIT',
  'arc shot': 'ORBIT',
  roll: 'ROLL',
  'barrel roll': 'ROLL',
  'dolly zoom': 'DOLLY ZOOM',
  zolly: 'DOLLY ZOOM',
  'vertigo effect': 'DOLLY ZOOM',
  'crash zoom': 'CRASH ZOOM',
  'snap zoom': 'CRASH ZOOM',
  'rack focus': 'RACK FOCUS',
  'drone flyover': 'DRONE FLYOVER',
  'drone reveal': 'DRONE REVEAL',
  'fpv drone dive': 'FPV DRONE DIVE',
  hyperlapse: 'HYPERLAPSE',
  'bullet time': 'BULLET TIME',
  'zoom in': 'ZOOM IN',
  'zoom out': 'ZOOM OUT',
  static: 'STATIC',
};

const ANGLE_ALIASES: Record<string, string> = {
  'eye level': 'EYE LEVEL',
  'high angle': 'HIGH ANGLE',
  'slightly high': 'SLIGHTLY HIGH',
  'slightly high angle': 'SLIGHTLY HIGH',
  'low angle': 'LOW ANGLE',
  'slightly low': 'SLIGHTLY LOW',
  'slightly low angle': 'SLIGHTLY LOW',
  'birds eye': "BIRD'S-EYE VIEW",
  "bird's eye": "BIRD'S-EYE VIEW",
  'birds-eye': "BIRD'S-EYE VIEW",
  'birds eye view': "BIRD'S-EYE VIEW",
  'birdseye view': "BIRD'S-EYE VIEW",
  'birdseye': "BIRD'S-EYE VIEW",
  overhead: "BIRD'S-EYE VIEW",
  'top down': "BIRD'S-EYE VIEW",
  'top-down': "BIRD'S-EYE VIEW",
  'worms eye': "WORM'S-EYE VIEW",
  "worm's eye": "WORM'S-EYE VIEW",
  'worms eye view': "WORM'S-EYE VIEW",
  "worm's eye view": "WORM'S-EYE VIEW",
  'dutch angle': 'DUTCH ANGLE',
  'dutch tilt': 'DUTCH ANGLE',
  'canted angle': 'DUTCH ANGLE',
};

const LENS_ALIASES: Record<string, string> = {
  '8 mm': '8MM',
  '14 mm': '14MM',
  '16 mm': '16MM',
  '18 mm': '18MM',
  '24 mm': '24MM',
  '28 mm': '28MM',
  '35 mm': '35MM',
  '50 mm': '50MM',
  '70 mm': '70MM',
  '85 mm': '85MM',
  '100 mm': '100MM',
  '135 mm': '135MM',
  '200 mm': '200MM',
  '300 mm': '300MM',
  '35mm lens': '35MM',
  '50mm lens': '50MM',
  '85mm lens': '85MM',
  '70mm lens': '70MM',
  '135mm lens': '135MM',
  '200mm lens': '200MM',
  '300mm lens': '300MM',
  'wide angle': 'WIDE-ANGLE',
  wideangle: 'WIDE-ANGLE',
  'ultra wide': 'ULTRA-WIDE',
  'ultra-wide': 'ULTRA-WIDE',
  tele: 'TELEPHOTO',
  telephoto: 'TELEPHOTO',
  'telephoto lens': 'TELEPHOTO',
  'telephoto compression': 'TELEPHOTO',
  macro: 'MACRO',
  'macro lens': 'MACRO',
  fisheye: 'FISHEYE',
  anamorphic: 'ANAMORPHIC',
  'tilt shift': 'TILT-SHIFT',
  'tilt-shift': 'TILT-SHIFT',
};

const LIGHTING_ALIASES: Record<string, string> = {
  'high key': 'HIGH-KEY',
  'high-key': 'HIGH-KEY',
  'low key': 'LOW-KEY',
  'low-key': 'LOW-KEY',
  naturalistic: 'NATURALISTIC',
  chiaroscuro: 'CHIAROSCURO',
  'soft key': 'SOFT KEY',
  'hard key': 'HARD KEY',
  rembrandt: 'REMBRANDT',
  butterfly: 'BUTTERFLY',
  paramount: 'PARAMOUNT',
  split: 'SPLIT',
  'rim light': 'RIM LIGHTING',
  'rim lighting': 'RIM LIGHTING',
  practical: 'PRACTICAL LIGHTING',
  'practical lighting': 'PRACTICAL LIGHTING',
  'three point': 'THREE-POINT',
  'three-point': 'THREE-POINT',
  'golden hour': 'GOLDEN HOUR',
  'blue hour': 'BLUE HOUR',
  'neon practicals': 'NEON PRACTICALS',
  volumetric: 'VOLUMETRIC',
  backlit: 'BACKLIT',
  silhouette: 'SILHOUETTE',
};

const normalizeLookupKey = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[-_/]/g, ' ')
    .replace(/\s+/g, ' ');

const normalizeUppercaseFallback = (raw: string): string =>
  raw.trim().replace(/\s+/g, ' ').toUpperCase();

const normalizeWithAliases = (raw: string, aliases: Record<string, string>): string => {
  const normalized = normalizeLookupKey(raw);
  return aliases[normalized] ?? normalizeUppercaseFallback(raw);
};

export const normalizeCameraShotType = (raw: string): string =>
  normalizeWithAliases(raw, SHOT_TYPE_ALIASES);

export const normalizeCameraMovement = (raw: string): string =>
  normalizeWithAliases(raw, MOVEMENT_ALIASES);

export const normalizeCameraAngle = (raw: string): string =>
  normalizeWithAliases(raw, ANGLE_ALIASES);

export const normalizeLens = (raw: string): string =>
  normalizeWithAliases(raw, LENS_ALIASES);

export const normalizeLightingStyle = (raw: string): string =>
  normalizeWithAliases(raw, LIGHTING_ALIASES);

