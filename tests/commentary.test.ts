import { describe, it, expect } from 'vitest';
import { generateCommentary } from '../src/core/Commentary';
import type { RaceSnapshot } from '../src/core/types';

function snap(over: Partial<RaceSnapshot>): RaceSnapshot {
  return {
    lap: 2,
    totalLaps: 8,
    positions: new Map([['player', 2], ['ai0', 1], ['ai1', 3]]),
    riders: [
      { id: 'player', name: 'Marco Rossi' },
      { id: 'ai0', name: 'Bruno Silva' },
      { id: 'ai1', name: 'Mei Watanabe' },
    ],
    crashed: new Set(),
    fastestLap: null,
    tireWear: new Map(),
    overtookBy: new Map(),
    overtakeBy: new Map(),
    gapAheadSec: new Map(),
    ...over,
  };
}

describe('battle commentary', () => {
  it('fires when the player closes onto the rider ahead (gap crosses under 1.0s)', () => {
    const prev = snap({ lap: 3, gapAheadSec: new Map([['player', 1.8]]) });
    const cur = snap({ lap: 3, gapAheadSec: new Map([['player', 0.7]]) });
    const events = generateCommentary(prev, cur);
    const battle = events.filter((e) => e.type === 'battle');
    expect(battle).toHaveLength(1);
    expect(battle[0].text).toContain('Marco Rossi');
    expect(battle[0].text).toContain('Bruno Silva');
  });

  it('does not re-fire while the gap stays inside battle range', () => {
    const prev = snap({ lap: 4, gapAheadSec: new Map([['player', 0.7]]) });
    const cur = snap({ lap: 4, gapAheadSec: new Map([['player', 0.5]]) });
    expect(generateCommentary(prev, cur).filter((e) => e.type === 'battle')).toHaveLength(0);
  });

  it('announces a battle for the lead between two AI riders', () => {
    const positions = new Map([['player', 3], ['ai0', 1], ['ai1', 2]]);
    const prev = snap({ lap: 5, positions, gapAheadSec: new Map([['ai1', 2.2]]) });
    const cur = snap({ lap: 5, positions, gapAheadSec: new Map([['ai1', 0.6]]) });
    const events = generateCommentary(prev, cur).filter((e) => e.type === 'battle');
    expect(events).toHaveLength(1);
    expect(events[0].text).toContain('Mei Watanabe');
    expect(events[0].text).toContain('Bruno Silva');
  });
});

describe('tire commentary', () => {
  it('fires once when player wear crosses 70%, tagged as tire (not battle)', () => {
    const prev = snap({ lap: 6, tireWear: new Map([['player', 65]]) });
    const cur = snap({ lap: 6, tireWear: new Map([['player', 74]]) });
    const events = generateCommentary(prev, cur);
    const tire = events.filter((e) => e.type === 'tire');
    expect(tire).toHaveLength(1);
    expect(events.filter((e) => e.type === 'battle')).toHaveLength(0);
  });

  it('does not repeat the warning while wear stays above 70%', () => {
    const prev = snap({ lap: 7, tireWear: new Map([['player', 78]]) });
    const cur = snap({ lap: 7, tireWear: new Map([['player', 86]]) });
    expect(generateCommentary(prev, cur).filter((e) => e.type === 'tire')).toHaveLength(0);
  });
});
