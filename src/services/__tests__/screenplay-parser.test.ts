import { describe, it, expect } from 'vitest';
import { parseScreenplay, extractScenes } from '../screenplay-parser';

// ─── Scene Heading Detection ──────────────────────────────

describe('parseScreenplay', () => {
  it('parses basic INT scene heading', () => {
    const result = parseScreenplay('INT. LIVING ROOM - NIGHT');
    expect(result.sceneCount).toBe(1);
    expect(result.elements[0].type).toBe('scene_heading');
    expect(result.locations).toContain('LIVING ROOM');
  });

  it('parses EXT scene heading', () => {
    const result = parseScreenplay('EXT. CITY STREET - DAY');
    expect(result.sceneCount).toBe(1);
    expect(result.locations).toContain('CITY STREET');
  });

  it('parses INT/EXT combined headings', () => {
    const result = parseScreenplay('INT./EXT. CAR - MOVING - DAY');
    expect(result.sceneCount).toBe(1);
  });

  it('counts multiple scenes', () => {
    const screenplay = `INT. KITCHEN - MORNING

Action in the kitchen.

EXT. PARK - DAY

Action in the park.

INT. OFFICE - NIGHT

Action in the office.`;

    const result = parseScreenplay(screenplay);
    expect(result.sceneCount).toBe(3);
    expect(result.locations).toHaveLength(3);
  });

  it('rejects non-scene headings', () => {
    const result = parseScreenplay('This is just a regular line of action.');
    expect(result.sceneCount).toBe(0);
    expect(result.elements[0].type).toBe('action');
  });

  it('handles scene headings with numbers', () => {
    const result = parseScreenplay('12A INT. WAREHOUSE - NIGHT');
    expect(result.sceneCount).toBe(1);
    expect(result.locations).toContain('WAREHOUSE');
  });
});

// ─── Character Detection ──────────────────────────────────

describe('character detection', () => {
  it('detects character cues', () => {
    const screenplay = `INT. OFFICE - DAY

SARAH
Hello, how are you?

JOHN
I'm fine, thanks.`;

    const result = parseScreenplay(screenplay);
    expect(result.characters).toContain('SARAH');
    expect(result.characters).toContain('JOHN');
  });

  it('handles character cues with extensions', () => {
    const screenplay = `INT. ROOM - DAY

SARAH (V.O.)
I remember that day clearly.

JOHN (CONT'D)
And then what happened?`;

    const result = parseScreenplay(screenplay);
    expect(result.characters).toContain('SARAH');
    expect(result.characters).toContain('JOHN');
  });

  it('does not treat transitions as characters', () => {
    const screenplay = `INT. ROOM - DAY

CUT TO:

EXT. STREET - NIGHT`;

    const result = parseScreenplay(screenplay);
    expect(result.characters).not.toContain('CUT TO');
  });

  it('does not treat shot directions as characters', () => {
    const screenplay = `INT. ROOM - DAY

CLOSE ON
A hand reaching for the door.`;

    const result = parseScreenplay(screenplay);
    expect(result.characters).not.toContain('CLOSE ON');
  });
});

// ─── Dialogue Parsing ─────────────────────────────────────

describe('dialogue parsing', () => {
  it('associates dialogue with character', () => {
    const screenplay = `INT. CAFE - DAY

ANNA
I can't believe you did that.`;

    const result = parseScreenplay(screenplay);
    const charEl = result.elements.find((e) => e.type === 'character');
    const dialEl = result.elements.find((e) => e.type === 'dialogue');

    expect(charEl).toBeDefined();
    expect(charEl!.text.trim()).toBe('ANNA');
    expect(dialEl).toBeDefined();
    expect(dialEl!.text).toContain("I can't believe you did that.");
  });

  it('detects parentheticals', () => {
    const screenplay = `INT. ROOM - DAY

MIKE
(whispering)
Don't move.`;

    const result = parseScreenplay(screenplay);
    const paren = result.elements.find((e) => e.type === 'parenthetical');
    expect(paren).toBeDefined();
    expect(paren!.text).toBe('(whispering)');
  });
});

// ─── Action Blocks ────────────────────────────────────────

describe('action blocks', () => {
  it('merges consecutive action lines', () => {
    const screenplay = `INT. FOREST - DAY

The trees sway in the wind.
Leaves fall slowly to the ground.
A bird takes flight.`;

    const result = parseScreenplay(screenplay);
    const actionBlocks = result.elements.filter((e) => e.type === 'action');
    // Consecutive action lines should merge into one block
    expect(actionBlocks.length).toBe(1);
    expect(actionBlocks[0].text).toContain('The trees sway');
    expect(actionBlocks[0].text).toContain('A bird takes flight');
  });
});

// ─── Transitions ──────────────────────────────────────────

describe('transitions', () => {
  it('detects CUT TO:', () => {
    const screenplay = `INT. ROOM - DAY

Action here.

CUT TO:

EXT. STREET - NIGHT`;

    const result = parseScreenplay(screenplay);
    const transitions = result.elements.filter((e) => e.type === 'transition');
    expect(transitions.length).toBe(1);
  });

  it('detects FADE TO BLACK:', () => {
    const result = parseScreenplay('FADE TO BLACK:');
    const transitions = result.elements.filter((e) => e.type === 'transition');
    expect(transitions.length).toBe(1);
  });
});

// ─── Scene Extraction ─────────────────────────────────────

describe('extractScenes', () => {
  it('extracts scenes with characters', () => {
    const screenplay = `INT. KITCHEN - MORNING

SARAH enters carrying groceries.

SARAH
We need to talk.

JOHN
About what?

EXT. GARDEN - DAY

SARAH walks outside alone.`;

    const parsed = parseScreenplay(screenplay);
    const scenes = extractScenes(parsed);

    expect(scenes).toHaveLength(2);
    expect(scenes[0].heading.location).toBe('KITCHEN');
    expect(scenes[0].characters).toContain('SARAH');
    expect(scenes[0].characters).toContain('JOHN');
    expect(scenes[1].heading.location).toBe('GARDEN');
  });

  it('provides correct line ranges', () => {
    const screenplay = `INT. ROOM A - DAY

Some action.

EXT. ROOM B - NIGHT

More action.`;

    const parsed = parseScreenplay(screenplay);
    const scenes = extractScenes(parsed);

    expect(scenes).toHaveLength(2);
    expect(scenes[0].startLine).toBeLessThan(scenes[1].startLine);
  });
});

// ─── Text Normalization ───────────────────────────────────

describe('text normalization', () => {
  it('handles Windows line endings', () => {
    const screenplay = 'INT. ROOM - DAY\r\n\r\nSARAH\r\nHello.\r\n';
    const result = parseScreenplay(screenplay);
    expect(result.sceneCount).toBe(1);
    expect(result.characters).toContain('SARAH');
  });

  it('handles smart quotes', () => {
    const screenplay = `INT. ROOM - DAY

ANNA
\u201CI can\u2019t believe it.\u201D`;

    const result = parseScreenplay(screenplay);
    const dialogue = result.elements.find((e) => e.type === 'dialogue');
    expect(dialogue).toBeDefined();
    expect(dialogue!.text).toContain('"I can\'t believe it."');
  });

  it('handles em dashes', () => {
    const screenplay = `INT. ROOM - DAY

She paused\u2014then continued.`;

    const result = parseScreenplay(screenplay);
    const action = result.elements.find((e) => e.type === 'action');
    expect(action!.text).toContain('--');
  });
});

// ─── Edge Cases ───────────────────────────────────────────

describe('edge cases', () => {
  it('handles empty input', () => {
    const result = parseScreenplay('');
    expect(result.sceneCount).toBe(0);
    expect(result.elements).toHaveLength(0);
    expect(result.characters).toHaveLength(0);
  });

  it('handles input with only whitespace', () => {
    const result = parseScreenplay('   \n\n   \n');
    expect(result.sceneCount).toBe(0);
  });

  it('handles very long scene headings (should reject)', () => {
    const longHeading = 'INT. ' + 'A'.repeat(200) + ' - DAY';
    const result = parseScreenplay(longHeading);
    // Should NOT be treated as a scene heading (too long)
    expect(result.sceneCount).toBe(0);
  });

  it('parses a realistic multi-scene screenplay', () => {
    const screenplay = `FADE IN:

INT. APARTMENT - NIGHT

SARAH (30s, tired) sits at a desk. Papers everywhere.

SARAH
(muttering)
This doesn't make any sense.

She picks up the phone.

SARAH (CONT'D)
John, I need you to come over.

CUT TO:

EXT. CITY STREET - NIGHT

JOHN (35) walks quickly through rain.

JOHN (V.O.)
I knew something was wrong.

INT. APARTMENT - CONTINUOUS

John enters. Sarah shows him a photograph.

JOHN
Where did you find this?

SARAH
In the attic. Look at the date.

JOHN
That's impossible.

FADE TO BLACK:`;

    const parsed = parseScreenplay(screenplay);
    expect(parsed.sceneCount).toBe(3);
    expect(parsed.characters).toContain('SARAH');
    expect(parsed.characters).toContain('JOHN');
    expect(parsed.locations.length).toBeGreaterThanOrEqual(2);

    const scenes = extractScenes(parsed);
    expect(scenes).toHaveLength(3);
    expect(scenes[0].heading.prefix).toBe('INT');
    expect(scenes[1].heading.prefix).toBe('EXT');
    expect(scenes[2].heading.prefix).toBe('INT');
  });
});
