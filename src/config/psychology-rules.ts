/**
 * Psychology Rules Engine
 *
 * Encodes empirically-validated film psychology mechanisms from:
 * - Green & Brock (2000) — Narrative Transportation
 * - Cohen (2001) — Character Identification (4 components)
 * - Zillmann (1983) — Excitation Transfer
 * - Nabi & Green (2015) — Emotional Flow Hypothesis
 * - Gallese & Guerra (2012) — Embodied Simulation / Mirror Neurons
 * - Hasson (2004) — Neurocinematics / Brain Synchronization
 * - Reagan et al. (2016) — 6 Validated Story Shapes
 * - Sedikides & Wildschut — Nostalgia Psychology (Southampton Group)
 * - Zillmann (1996) — Suspense Theory
 * - Bordwell (1985) — Schema Theory
 * - Tan (1996) — Interest as Central Emotion
 */

// ─── Camera-to-Emotion Mapping ─────────────────────────────
// Based on Gallese & Guerra (2012): close-ups activate mirror neurons
// Based on Rooney et al. (2017): close-ups increase Theory of Mind
// Based on Cutting (2018): cryptic reaction shots exploit mentalizing

export const CAMERA_EMOTION_MAP: Record<string, {
  shotTypes: string[];
  movements: string[];
  angles: string[];
  rationale: string;
}> = {
  empathy: {
    shotTypes: ['CLOSE-UP', 'MEDIUM CLOSE-UP', 'EXTREME CLOSE-UP'],
    movements: ['SLOW DOLLY IN', 'STATIC', 'SUBTLE PUSH IN'],
    angles: ['EYE LEVEL', 'SLIGHTLY LOW'],
    rationale: 'Close-ups activate mirror neurons (Gallese 2012), facial muscles engage empathically',
  },
  fear: {
    shotTypes: ['WIDE SHOT', 'EXTREME WIDE', 'CLOSE-UP'],
    movements: ['HANDHELD', 'SLOW TRACKING', 'WHIP PAN'],
    angles: ['LOW ANGLE', 'DUTCH ANGLE', 'HIGH ANGLE'],
    rationale: 'Wide isolation + sudden close-ups create threat schema. Dutch angles signal instability',
  },
  joy: {
    shotTypes: ['MEDIUM SHOT', 'WIDE SHOT', 'TWO-SHOT'],
    movements: ['STEADY TRACKING', 'CRANE UP', 'DOLLY OUT'],
    angles: ['EYE LEVEL', 'SLIGHTLY LOW'],
    rationale: 'Expanding framing mirrors emotional openness. Steady movement = psychological safety',
  },
  tension: {
    shotTypes: ['MEDIUM CLOSE-UP', 'OVER-THE-SHOULDER', 'CLOSE-UP'],
    movements: ['SLOW DOLLY IN', 'STATIC WITH MICRO-DRIFT', 'SLOW PUSH'],
    angles: ['EYE LEVEL', 'SLIGHTLY HIGH'],
    rationale: 'Tightening frame creates psychological compression. Slow movement builds dread',
  },
  sadness: {
    shotTypes: ['MEDIUM SHOT', 'WIDE SHOT', 'CLOSE-UP'],
    movements: ['STATIC', 'SLOW PAN', 'GENTLE DRIFT'],
    angles: ['SLIGHTLY HIGH', 'EYE LEVEL'],
    rationale: 'High angles create vulnerability (Bordwell 1985). Static shots let emotion breathe',
  },
  power: {
    shotTypes: ['MEDIUM SHOT', 'FULL SHOT', 'MEDIUM WIDE'],
    movements: ['DOLLY IN', 'TRACKING ALONGSIDE', 'STEADICAM'],
    angles: ['LOW ANGLE', 'SLIGHTLY LOW'],
    rationale: 'Low angles encode dominance schema. Movement alongside = audience alignment with power',
  },
  vulnerability: {
    shotTypes: ['CLOSE-UP', 'MEDIUM SHOT', 'WIDE SHOT'],
    movements: ['STATIC', 'SLIGHT PULL BACK', 'HANDHELD'],
    angles: ['HIGH ANGLE', 'BIRDS EYE'],
    rationale: 'High angles diminish subject, activate protective empathy (Cohen 2001)',
  },
  hope: {
    shotTypes: ['MEDIUM SHOT', 'WIDE SHOT'],
    movements: ['CRANE UP', 'DOLLY OUT', 'SLOW TILT UP'],
    angles: ['EYE LEVEL', 'SLIGHTLY LOW'],
    rationale: 'Upward movement and expanding frame signal possibility and aspiration',
  },
  surprise: {
    shotTypes: ['CLOSE-UP', 'EXTREME CLOSE-UP', 'WIDE SHOT'],
    movements: ['WHIP PAN', 'CRASH ZOOM', 'SNAP TO'],
    angles: ['EYE LEVEL', 'DUTCH ANGLE'],
    rationale: 'Schema violation (Bordwell 1985) via sudden movement creates productive surprise',
  },
  isolation: {
    shotTypes: ['EXTREME WIDE', 'WIDE SHOT'],
    movements: ['STATIC', 'VERY SLOW PULL BACK', 'CRANE OUT'],
    angles: ['HIGH ANGLE', 'BIRDS EYE'],
    rationale: 'Small subject in large frame = existential isolation. Pulling back = emotional distancing',
  },
};

// ─── Color Temperature-to-Valence Mapping ──────────────────
// Based on nostalgia research (Sedikides & Wildschut)
// and embodied cognition (warm = safety, cool = threat)

export const COLOR_VALENCE_MAP: Record<string, {
  colorTemp: string;
  colorGrade: string;
  filmStock: string;
}> = {
  warm_safe: {
    colorTemp: 'warm tungsten 3200K',
    colorGrade: 'golden amber, lifted shadows',
    filmStock: 'Kodak Vision3 500T',
  },
  nostalgic: {
    colorTemp: 'warm golden hour 4000K',
    colorGrade: 'faded warm tones, soft grain, slightly lifted blacks',
    filmStock: 'Kodak Ektachrome 100D',
  },
  neutral: {
    colorTemp: 'daylight 5600K',
    colorGrade: 'natural balanced, moderate contrast',
    filmStock: 'Kodak Vision3 250D',
  },
  alienation: {
    colorTemp: 'cool fluorescent 4800K',
    colorGrade: 'desaturated teal, green undertones, clinical',
    filmStock: 'Fujifilm Eterna Vivid 500',
  },
  threat: {
    colorTemp: 'cool blue 6500K+',
    colorGrade: 'crushed blacks, high contrast, blue-steel shadows',
    filmStock: 'pushed Kodak 5219 500T two stops',
  },
  dream: {
    colorTemp: 'diffused warm 4500K',
    colorGrade: 'halation, bloomed highlights, soft focus edges',
    filmStock: 'Kodak Vision3 200T with Pro-Mist filter',
  },
};

// ─── Arousal-to-Editing-Pace ───────────────────────────────
// Based on Hasson (2004): high narrative control = high brain sync
// Based on Zillmann (1983): excitation transfer between cuts

export const AROUSAL_PACE_MAP: Record<number, {
  avgShotDuration: number;
  movementIntensity: string;
  cutStyle: string;
}> = {
  1: { avgShotDuration: 8, movementIntensity: 'minimal', cutStyle: 'long takes, dissolves' },
  2: { avgShotDuration: 7, movementIntensity: 'gentle', cutStyle: 'soft cuts' },
  3: { avgShotDuration: 6, movementIntensity: 'moderate', cutStyle: 'standard cuts' },
  4: { avgShotDuration: 6, movementIntensity: 'moderate', cutStyle: 'standard cuts' },
  5: { avgShotDuration: 5, movementIntensity: 'moderate', cutStyle: 'crisp cuts' },
  6: { avgShotDuration: 5, movementIntensity: 'active', cutStyle: 'crisp cuts' },
  7: { avgShotDuration: 4, movementIntensity: 'active', cutStyle: 'sharp cuts' },
  8: { avgShotDuration: 4, movementIntensity: 'intense', cutStyle: 'rapid cuts' },
  9: { avgShotDuration: 3, movementIntensity: 'intense', cutStyle: 'smash cuts, whip pans' },
  10: { avgShotDuration: 3, movementIntensity: 'frenetic', cutStyle: 'staccato cuts, flash frames' },
};

// ─── Genre Schema Expectations ─────────────────────────────
// Based on Bordwell (1985) prototype schemata
// and Tan (1996) interest as central emotion

export const GENRE_SCHEMAS: Record<string, {
  dominantEmotions: string[];
  lightingDefaults: string;
  cameraDefaults: string;
  colorDefaults: string;
  audioDefaults: string;
  schemaConventions: string[];
}> = {
  horror: {
    dominantEmotions: ['fear', 'tension', 'surprise'],
    lightingDefaults: 'low-key, single harsh source, deep shadows',
    cameraDefaults: 'static with slow push-ins, sudden movements for scares',
    colorDefaults: 'desaturated, cold blues and greens, crushed blacks',
    audioDefaults: 'silence punctuated by diegetic sound, low drones, sudden stingers',
    schemaConventions: [
      'Off-screen threats more frightening than visible ones',
      'Confined spaces amplify claustrophobic tension',
      'Long takes before scares maximize excitation transfer',
      'Darkness activates threat-detection schemas',
    ],
  },
  drama: {
    dominantEmotions: ['empathy', 'sadness', 'hope'],
    lightingDefaults: 'naturalistic, motivated sources, soft key',
    cameraDefaults: 'close-ups for emotion, wide shots for context, steady movement',
    colorDefaults: 'warm naturalistic palette, period-appropriate',
    audioDefaults: 'sparse score, environmental ambiance, emphasis on dialogue clarity',
    schemaConventions: [
      'Character psychology drives visual language',
      'Reaction shots more powerful than action shots',
      'Silence is as important as dialogue',
      'Subtlety in performance = deeper identification (E-ELM)',
    ],
  },
  thriller: {
    dominantEmotions: ['tension', 'fear', 'surprise'],
    lightingDefaults: 'high-contrast, motivated shadows, chiaroscuro',
    cameraDefaults: 'tight framing, slow methodical movement, occasional handheld',
    colorDefaults: 'cool desaturated, teal-and-orange split toning',
    audioDefaults: 'ticking clocks, heartbeats, building orchestral tension',
    schemaConventions: [
      'Information asymmetry drives suspense (audience knows, character doesnt)',
      'Maximum suspense at 70-90% negative outcome probability with sliver of hope',
      'Crosscutting between threat and victim builds parallel tension',
      'Resolution excitation transfer amplifies relief',
    ],
  },
  comedy: {
    dominantEmotions: ['joy', 'surprise'],
    lightingDefaults: 'bright, even, high-key',
    cameraDefaults: 'wide shots for physical comedy, medium for dialogue, reaction shots',
    colorDefaults: 'saturated, warm, bright palette',
    audioDefaults: 'upbeat score, comedic timing in sound design, laughter-inducing SFX',
    schemaConventions: [
      'Wide shots give physical comedy room to breathe',
      'Reaction shots are where comedy lives',
      'Timing is everything — hold beats slightly longer than expected',
      'Schema subversion (unexpected outcomes) is the core of humor',
    ],
  },
  scifi: {
    dominantEmotions: ['wonder', 'tension', 'isolation'],
    lightingDefaults: 'stylized, neon practicals, volumetric',
    cameraDefaults: 'slow majestic movements, symmetrical compositions, scale shots',
    colorDefaults: 'stylized palette, blues/purples for technology, warm for humanity',
    audioDefaults: 'synthesized soundscapes, deep bass, spatial audio design',
    schemaConventions: [
      'Scale shots establish wonder and smallness of humans',
      'Technology contrasts with human warmth through lighting',
      'Symmetry in composition suggests order/control',
      'Breaking symmetry signals chaos/breakdown',
    ],
  },
  period: {
    dominantEmotions: ['nostalgia', 'empathy', 'hope'],
    lightingDefaults: 'motivated by period sources (candles, gas lamps, tungsten)',
    cameraDefaults: 'classical composition, steady tripod, period-appropriate techniques',
    colorDefaults: 'era-appropriate color science, warm period tones',
    audioDefaults: 'period-specific music, authentic environmental sounds',
    schemaConventions: [
      'Production design accuracy activates nostalgia circuits (Sedikides)',
      'Music is the strongest nostalgia trigger — use era-specific styles',
      'Warm color grading activates safety/belonging schemas',
      'Grain and film texture enhance temporal displacement',
    ],
  },
};

// ─── Nostalgia Trigger Checklist by Decade ─────────────────
// Based on Sedikides & Wildschut nostalgia research
// and Barrett & Janata (2016) music-evoked nostalgia

export const NOSTALGIA_TRIGGERS: Record<string, {
  musicStyle: string;
  filmStock: string;
  colorPalette: string;
  productionDesignCues: string[];
}> = {
  '1950s': {
    musicStyle: 'rock and roll, doo-wop, big band jazz',
    filmStock: 'Technicolor three-strip look, saturated primaries',
    colorPalette: 'vivid reds, turquoise, chrome silver, pastel pink',
    productionDesignCues: ['chrome diners', 'tail-fin cars', 'jukeboxes', 'poodle skirts', 'tube TVs'],
  },
  '1960s': {
    musicStyle: 'British Invasion, Motown, psychedelic rock, folk',
    filmStock: 'Eastmancolor, slightly faded, grain visible',
    colorPalette: 'earth tones, olive green, burnt orange, paisley patterns',
    productionDesignCues: ['Eames furniture', 'rotary phones', 'VW buses', 'mod fashion', 'transistor radios'],
  },
  '1970s': {
    musicStyle: 'disco, funk, punk, prog rock, singer-songwriter',
    filmStock: 'pushed Kodak, high grain, warm amber cast',
    colorPalette: 'burnt orange, avocado green, mustard yellow, brown',
    productionDesignCues: ['shag carpet', 'wood paneling', 'lava lamps', 'bell-bottoms', 'vinyl records'],
  },
  '1980s': {
    musicStyle: 'synth-pop, new wave, hair metal, hip-hop origins',
    filmStock: 'Fujicolor, high saturation, neon glow',
    colorPalette: 'neon pink, electric blue, hot magenta, chrome',
    productionDesignCues: ['CRT monitors', 'boomboxes', 'arcade cabinets', 'Walkman', 'Members Only jackets'],
  },
  '1990s': {
    musicStyle: 'grunge, hip-hop golden age, pop, R&B, trip-hop',
    filmStock: 'Kodak Vision 500T, natural grain, cool undertones',
    colorPalette: 'muted earth tones, flannel patterns, denim blue',
    productionDesignCues: ['bulky desktops', 'pagers', 'VHS tapes', 'Discman', 'skateboards'],
  },
  '2000s': {
    musicStyle: 'pop-punk, emo, crunk, indie rock, early EDM',
    filmStock: 'early digital mixed with 35mm, slightly flat',
    colorPalette: 'teal-and-orange, desaturated with occasional pop',
    productionDesignCues: ['flip phones', 'iPods', 'MySpace', 'low-rise jeans', 'chunky laptops'],
  },
  '2010s': {
    musicStyle: 'EDM, trap, indie folk, streaming-era pop',
    filmStock: 'ARRI Alexa digital, clean, wide dynamic range',
    colorPalette: 'Instagram-filtered, golden hour, VSCO aesthetics',
    productionDesignCues: ['smartphones', 'flat design UI', 'craft coffee', 'airpods', 'Tesla'],
  },
};

// ─── Embodied Simulation Cues ──────────────────────────────
// Based on Gallese (2009) and Gallese & Guerra (2012)
// These are injected into action/subject descriptions to activate
// the viewer's motor and somatosensory cortex

export const EMBODIED_SIMULATION_CUES: Record<string, string[]> = {
  face: [
    'jaw tightens',
    'eyes narrow',
    'corners of mouth tremble',
    'brow furrows deeply',
    'nostrils flare',
    'lips press together',
    'eyes well with tears',
    'a barely perceptible swallow',
    'cheek muscles twitch',
    'gaze drops',
    'eyes widen',
    'chin lifts defiantly',
  ],
  body: [
    'shoulders tense',
    'hands clench into fists',
    'fingers drum nervously',
    'chest heaves with a deep breath',
    'body stiffens',
    'leans forward unconsciously',
    'recoils slightly',
    'spine straightens',
    'weight shifts from one foot to the other',
    'arms cross defensively',
  ],
  sensation: [
    'rain hits her face',
    'cold breath visible in the air',
    'sweat beads on his forehead',
    'wind whips through her hair',
    'the warmth of sunlight on skin',
    'goosebumps rise on bare arms',
    'the shock of cold water',
    'dust stings his eyes',
    'the hum of electricity in the air',
    'the weight of silence pressing down',
  ],
};

// ─── Story Shape Visual Treatment ──────────────────────────
// Based on Reagan et al. (2016) — 6 core emotional arcs
// Maps each arc to a visual treatment progression

export const STORY_SHAPE_TREATMENTS: Record<string, {
  description: string;
  lightingProgression: string;
  colorProgression: string;
  framingProgression: string;
  musicProgression: string;
}> = {
  rags_to_riches: {
    description: 'Steady emotional rise — protagonist ascends',
    lightingProgression: 'dim/harsh → gradually warmer → bright/golden',
    colorProgression: 'desaturated → gradually warming → rich saturated warm',
    framingProgression: 'tight/confined → gradually opening → expansive wide',
    musicProgression: 'sparse/minor → building → triumphant major key',
  },
  tragedy: {
    description: 'Steady emotional fall — protagonist descends',
    lightingProgression: 'bright/warm → gradually dimming → dark/cold',
    colorProgression: 'saturated/warm → cooling → desaturated/cold',
    framingProgression: 'open/free → gradually tightening → claustrophobic',
    musicProgression: 'full/major → thinning → sparse/dissonant',
  },
  man_in_a_hole: {
    description: 'Fall then rise — protagonist fails then recovers (redemption)',
    lightingProgression: 'normal → dark nadir at midpoint → warm redemptive final act',
    colorProgression: 'natural → cold/desaturated at crisis → warm golden resolution',
    framingProgression: 'medium → tight at crisis → expansive at resolution',
    musicProgression: 'established → stripped/absent at crisis → swelling return',
  },
  icarus: {
    description: 'Rise then fall — protagonist succeeds then crashes',
    lightingProgression: 'building warm → peak brightness → crashing to darkness',
    colorProgression: 'warming → peak saturation → rapid desaturation',
    framingProgression: 'opening → widest at peak → collapsing to tight',
    musicProgression: 'building → triumphant peak → dissonant collapse',
  },
  cinderella: {
    description: 'Rise-fall-rise — most commercially successful arc',
    lightingProgression: 'warm rise → dark setback → brighter-than-before triumph',
    colorProgression: 'warming → sudden cooling → richest warmth at end',
    framingProgression: 'opening → constricting → most expansive at finale',
    musicProgression: 'hopeful → stripped at setback → fullest orchestration at end',
  },
  oedipus: {
    description: 'Fall-rise-fall — darkest arc, anti-hero narratives',
    lightingProgression: 'descending → false dawn brightness → final darkness',
    colorProgression: 'cooling → brief warmth → coldest at end',
    framingProgression: 'tightening → brief opening → most confined at end',
    musicProgression: 'minor → brief major → most dissonant/silent at end',
  },
};
