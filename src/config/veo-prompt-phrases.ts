/**
 * Veo Prompt Phrases
 *
 * Maps canonical camera movement tokens to Veo-optimized descriptive phrases.
 * Based on real-world testing data from 347 test shots (Wim Arys Photography)
 * and Google's official Veo prompting guides.
 *
 * Key findings:
 * - Descriptive everyday language outperforms technical jargon by 15-65 percentage points
 * - Speed modifiers ("slow", "gentle") work; numeric timing is ignored
 * - Simple single-direction movements have the highest success rates
 * - Compound movements (dolly zoom, complex crane arcs) are unreliable
 *
 * Sources:
 * - Google Cloud Blog: Ultimate Prompting Guide for Veo 3.1
 * - Wim Arys Photography: 347-shot camera movement test
 * - Google AI for Developers: Video Generation Prompt Guide
 * - Nina Labs AI / JsonPrompt.it: Master JSON Template
 */

export interface VeoMovementConfig {
  /** Veo-optimized descriptive phrase for the prompt */
  phrase: string;
  /** Overall success rate from testing (0-100) */
  successRate: number;
  /** Reliability tier */
  tier: 'safe' | 'good' | 'risky' | 'unreliable';
  /** Best-performing prompt variant and its success rate */
  bestPhrase?: { text: string; rate: number };
  /** Worst-performing prompt variant and its success rate */
  worstPhrase?: { text: string; rate: number };
  /** Suggested alternative for unreliable movements */
  alternative?: string;
  /** Platform-specific tip */
  tip?: string;
}

export const VEO_MOVEMENT_PHRASES: Record<string, VeoMovementConfig> = {
  'STATIC': {
    phrase: 'static shot, camera completely still, locked off',
    successRate: 94,
    tier: 'safe',
    bestPhrase: { text: 'static shot, camera completely still', rate: 97 },
    tip: 'Explicitly say "camera completely still" — omitting movement does not imply static',
  },
  'DOLLY IN': {
    phrase: 'slow dolly in toward the subject, camera physically moves closer',
    successRate: 58,
    tier: 'risky',
    bestPhrase: { text: 'tracking alongside running athlete, camera traveling parallel', rate: 68 },
    worstPhrase: { text: 'dolly zoom vertigo effect', rate: 22 },
    tip: '"Camera physically moves closer" distinguishes dolly from zoom',
  },
  'DOLLY OUT': {
    phrase: 'slow dolly out pulling away from the subject, camera physically moves back to reveal the surroundings',
    successRate: 58,
    tier: 'risky',
    tip: 'Include start/end composition: "starts close-up, ends wide shot"',
  },
  'PAN': {
    phrase: 'camera slowly pans across the scene',
    successRate: 73,
    tier: 'good',
    bestPhrase: { text: 'camera slowly moves left to right showing mountain range', rate: 85 },
    worstPhrase: { text: 'exact degree measurements', rate: 32 },
    tip: 'Describe direction with spatial landmarks, not degrees',
  },
  'PAN LEFT': {
    phrase: 'camera slowly pans left across the scene',
    successRate: 73,
    tier: 'good',
    bestPhrase: { text: 'camera slowly moves right to left across the scene', rate: 85 },
    tip: 'Spatial descriptors improve adherence over bare "pan left"',
  },
  'PAN RIGHT': {
    phrase: 'camera slowly pans right across the scene',
    successRate: 73,
    tier: 'good',
    bestPhrase: { text: 'camera slowly moves left to right across the scene', rate: 85 },
    tip: 'Spatial descriptors improve adherence over bare "pan right"',
  },
  'TILT': {
    phrase: 'camera slowly tilts to reveal the scene',
    successRate: 67,
    tier: 'good',
    bestPhrase: { text: 'camera angle shifts from looking down to looking up at building', rate: 81 },
    worstPhrase: { text: 'combined subject prompts', rate: 43 },
    tip: 'Describe the visual journey ("from boots to face"), not the angle',
  },
  'TILT UP': {
    phrase: 'camera slowly tilts upward to reveal',
    successRate: 67,
    tier: 'good',
    bestPhrase: { text: 'camera angle shifts from looking down to looking up', rate: 81 },
    tip: 'Describe what is revealed at the end of the tilt',
  },
  'TILT DOWN': {
    phrase: 'camera slowly tilts downward to reveal',
    successRate: 67,
    tier: 'good',
    tip: 'Describe what is revealed at the end of the tilt',
  },
  'TRACK': {
    phrase: 'smooth tracking shot following the subject through the environment, camera moves alongside',
    successRate: 58,
    tier: 'risky',
    bestPhrase: { text: 'tracking alongside running athlete, camera traveling parallel', rate: 68 },
    tip: 'Explicitly describe camera spatial relationship to subject',
  },
  'TRACKING': {
    phrase: 'smooth tracking shot following the subject through the environment, camera moves alongside',
    successRate: 58,
    tier: 'risky',
    bestPhrase: { text: 'tracking alongside running athlete, camera traveling parallel', rate: 68 },
    tip: 'Explicitly describe camera spatial relationship to subject',
  },
  'CRANE UP': {
    phrase: 'crane shot ascending above the subject to reveal the wider surroundings',
    successRate: 44,
    tier: 'risky',
    bestPhrase: { text: 'aerial perspective, camera slowly descending', rate: 63 },
    worstPhrase: { text: 'sweeping crane shot circling while rising', rate: 12 },
    tip: 'Limit to ONE direction (ascending OR descending) per generation',
  },
  'CRANE DOWN': {
    phrase: 'crane shot descending toward the subject from above',
    successRate: 44,
    tier: 'risky',
    bestPhrase: { text: 'aerial perspective, camera slowly descending', rate: 63 },
    tip: 'Limit to ONE direction per generation. Descending is more reliable than ascending.',
  },
  'TRUCK LEFT': {
    phrase: 'camera physically moves sideways to the left, sliding alongside the action',
    successRate: 58,
    tier: 'risky',
    tip: '"Camera physically moves sideways" distinguishes truck from pan',
  },
  'TRUCK RIGHT': {
    phrase: 'camera physically moves sideways to the right, sliding alongside the action',
    successRate: 58,
    tier: 'risky',
    tip: '"Camera physically moves sideways" distinguishes truck from pan',
  },
  'PEDESTAL UP': {
    phrase: 'camera physically rises to reveal the full height',
    successRate: 58,
    tier: 'risky',
    tip: '"Camera physically rises" distinguishes pedestal from tilt',
  },
  'PEDESTAL DOWN': {
    phrase: 'camera physically descends from above',
    successRate: 58,
    tier: 'risky',
    tip: '"Camera physically descends" distinguishes pedestal from tilt',
  },
  'BOOM UP': {
    phrase: 'camera sweeps upward on an arc, rising above the subject',
    successRate: 44,
    tier: 'risky',
    tip: 'Single direction only — do not combine with lateral movement',
  },
  'BOOM DOWN': {
    phrase: 'camera sweeps downward on an arc, descending toward the subject',
    successRate: 44,
    tier: 'risky',
    tip: 'Single direction only — do not combine with lateral movement',
  },
  'STEADICAM': {
    phrase: 'smooth floating camera movement following the subject through the space',
    successRate: 58,
    tier: 'risky',
    tip: '"Floating camera movement" conveys the Steadicam quality without relying on the brand name',
  },
  'HANDHELD': {
    phrase: 'handheld camera, shaky, documentary-style movement following the action',
    successRate: 58,
    tier: 'risky',
    tip: '"Shaky, documentary-style" reinforcement improves adherence over bare "handheld"',
  },
  'FOLLOW SHOT': {
    phrase: 'camera follows the subject from behind, moving through the environment',
    successRate: 58,
    tier: 'risky',
    tip: 'Specify the follow direction (behind, beside, ahead)',
  },
  'LEADING SHOT': {
    phrase: 'camera moves ahead of the subject, facing back toward them as they advance',
    successRate: 58,
    tier: 'risky',
  },
  'WHIP PAN': {
    phrase: 'quick whip pan with motion blur',
    successRate: 60,
    tier: 'good',
    tip: 'Use "whip pan from [A] to [B]" with clear spatial anchors (left/right)',
  },
  'ORBIT': {
    phrase: 'slow arc shot orbiting around the subject, camera circles from front to side',
    successRate: 50,
    tier: 'risky',
    tip: 'Specify arc extent ("180 degrees") and direction ("front to behind") for better adherence',
  },
  'ROLL': {
    phrase: 'slow camera roll rotating the frame, world tilting on its axis',
    successRate: 40,
    tier: 'risky',
    tip: 'Describe the visual effect ("world tilting") rather than the technical mechanism',
  },
  'DOLLY ZOOM': {
    phrase: 'dolly zoom effect, camera moves forward while perspective shifts, background appears to stretch away',
    successRate: 22,
    tier: 'unreliable',
    alternative: 'Use start/end frame interpolation instead of text prompt. Or decompose into: Shot A (slow dolly in) + Shot B (static close-up with background shift)',
    tip: 'Only 22% success rate via text. Use image + lastFrame API parameters for reliable results.',
  },
  'CRASH ZOOM': {
    phrase: 'rapid dramatic zoom in',
    successRate: 56,
    tier: 'risky',
    alternative: 'Use "gradual zoom into close-up" (89% success) instead when possible',
    tip: 'Crash zoom has 56% success vs. gradual zoom at 89%. Consider the tradeoff.',
  },
  'RACK FOCUS': {
    phrase: 'focus shifts from the foreground to the background, revealing the subject',
    successRate: 50,
    tier: 'risky',
    tip: 'Describe what comes into and out of focus, not the technical mechanism',
  },
  'DRONE FLYOVER': {
    phrase: 'aerial drone shot flying over the landscape from above',
    successRate: 44,
    tier: 'risky',
    bestPhrase: { text: 'aerial perspective, camera slowly descending', rate: 63 },
    tip: 'Keep flight path simple — one direction per generation',
  },
  'DRONE REVEAL': {
    phrase: 'aerial drone shot slowly rising to reveal the full scope of the landscape below',
    successRate: 44,
    tier: 'risky',
    tip: 'Single direction ascent for best results',
  },
  'FPV DRONE DIVE': {
    phrase: 'fast immersive first-person camera diving through the environment',
    successRate: 30,
    tier: 'unreliable',
    alternative: 'Break complex flight paths into sequential 4-second segments',
    tip: 'Compound FPV maneuvers have very low success. Split into simpler segments.',
  },
  'HYPERLAPSE': {
    phrase: 'dramatic hyperlapse with time passing rapidly, camera gliding forward through the scene',
    successRate: 40,
    tier: 'risky',
    tip: 'Describe the visual effect of time compression alongside the camera path',
  },
  'BULLET TIME': {
    phrase: 'frozen moment in time, camera slowly orbits around the frozen subject',
    successRate: 30,
    tier: 'unreliable',
    alternative: 'Use a slow arc shot with slow-motion physics instead',
    tip: 'Very low success rate. Consider arc shot + "slow motion" physics hint.',
  },
  'ZOOM IN': {
    phrase: 'gradual zoom into close-up',
    successRate: 81,
    tier: 'safe',
    bestPhrase: { text: 'gradual zoom into close-up', rate: 89 },
    worstPhrase: { text: 'crash zoom', rate: 56 },
    tip: 'Slow, deliberate zoom instructions are significantly more reliable than fast zooms',
  },
  'ZOOM OUT': {
    phrase: 'gradual zoom out to reveal the wider scene',
    successRate: 81,
    tier: 'safe',
    tip: 'Slow, deliberate zoom instructions are significantly more reliable',
  },
};

// ─── Shot Type Phrases ────────────────────────────────────

export const VEO_SHOT_TYPE_PHRASES: Record<string, string> = {
  'CLOSE-UP': 'close-up',
  'EXTREME CLOSE-UP': 'extreme close-up',
  'MEDIUM CLOSE-UP': 'medium close-up',
  'MEDIUM SHOT': 'medium shot',
  'WIDE SHOT': 'wide shot',
  'LONG SHOT': 'long shot',
  'FULL SHOT': 'full body shot',
  'EXTREME WIDE SHOT': 'extreme wide shot',
  'AERIAL SHOT': 'aerial view from above',
  'OVER-THE-SHOULDER': 'over-the-shoulder shot',
  'TWO-SHOT': 'two-shot framing both characters',
  'INSERT SHOT': 'insert detail shot',
  'ESTABLISHING SHOT': 'wide establishing shot',
  'POINT OF VIEW': 'first-person POV shot',
};

// ─── Angle Phrases ────────────────────────────────────────

export const VEO_ANGLE_PHRASES: Record<string, string> = {
  'EYE LEVEL': 'eye level',
  'HIGH ANGLE': 'high angle looking down',
  'SLIGHTLY HIGH': 'slightly high angle',
  'LOW ANGLE': 'low angle looking up',
  'SLIGHTLY LOW': 'slightly low angle',
  "BIRD'S-EYE VIEW": 'directly overhead bird\'s eye view looking straight down',
  "WORM'S-EYE VIEW": 'extreme low angle worm\'s eye view looking straight up',
  'DUTCH ANGLE': 'tilted dutch angle',
};

// ─── Helpers ──────────────────────────────────────────────

export function getVeoMovementPhrase(canonicalMovement: string): string {
  const config = VEO_MOVEMENT_PHRASES[canonicalMovement];
  return config ? config.phrase : canonicalMovement.toLowerCase();
}

export function getVeoShotTypePhrase(canonicalShotType: string): string {
  return VEO_SHOT_TYPE_PHRASES[canonicalShotType] || canonicalShotType.toLowerCase();
}

export function getVeoAnglePhrase(canonicalAngle: string): string {
  return VEO_ANGLE_PHRASES[canonicalAngle] || canonicalAngle.toLowerCase();
}

export function getMovementSuccessRate(canonicalMovement: string): number {
  const config = VEO_MOVEMENT_PHRASES[canonicalMovement];
  return config ? config.successRate : 50;
}

export function getMovementTier(canonicalMovement: string): VeoMovementConfig['tier'] {
  const config = VEO_MOVEMENT_PHRASES[canonicalMovement];
  return config ? config.tier : 'risky';
}

export function isUnreliableMovement(canonicalMovement: string): boolean {
  const config = VEO_MOVEMENT_PHRASES[canonicalMovement];
  return config ? config.tier === 'unreliable' : false;
}

export function getMovementAlternative(canonicalMovement: string): string | undefined {
  const config = VEO_MOVEMENT_PHRASES[canonicalMovement];
  return config?.alternative;
}

export function getMovementTip(canonicalMovement: string): string | undefined {
  const config = VEO_MOVEMENT_PHRASES[canonicalMovement];
  return config?.tip;
}

// ─── Compound Movement Detection ──────────────────────────

const COMPOUND_MOVEMENT_PATTERNS = [
  /while\s+(also\s+)?(panning|tilting|zooming|orbiting|rising|descending|tracking|rotating)/i,
  /and\s+(simultaneously|at the same time)\s+(pan|tilt|zoom|orbit|rise|descend|track|rotate)/i,
  /(circling|orbiting)\s+while\s+(rising|ascending|descending|zooming)/i,
  /(crane|boom)\s+.*\s+(orbit|circle|arc|pan|rotate)/i,
  /spiraling?\s+(crane|ascen|descen)/i,
];

export function detectCompoundMovement(movementText: string): boolean {
  return COMPOUND_MOVEMENT_PATTERNS.some((pattern) => pattern.test(movementText));
}
