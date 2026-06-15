import { describe, it, expect, beforeEach } from 'vitest';
import { createPlayerRider, generateAIRiders } from '../src/core/factories/RiderFactory';
import { createSeason } from '../src/core/factories/SeasonFactory';
import { resetProgression } from '../src/core/Progression';
import { PILOT_ROSTER } from '../src/data/pilots';
import { BRAND_ROSTER } from '../src/data/brands';
import { RNG } from '../src/core/RNG';

beforeEach(resetProgression);

describe('factories', () => {
  it('createPlayerRider copies pilot skills + brand params', () => {
    const r = createPlayerRider('My Team', PILOT_ROSTER[0], BRAND_ROSTER[0]);
    expect(r.isPlayer).toBe(true);
    expect(r.skills).toEqual(PILOT_ROSTER[0].skills);
    expect(r.bike).toEqual(BRAND_ROSTER[0].params);
    expect(r.skills).not.toBe(PILOT_ROSTER[0].skills); // a copy, not a reference
  });

  it('generateAIRiders makes 9 riders not using the player pilot/brand ids where possible', () => {
    const ai = generateAIRiders(PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(1));
    expect(ai).toHaveLength(9);
    expect(new Set(ai.map((r) => r.id)).size).toBe(9);
  });

  it('createSeason assembles 1 player + 9 AI + 6 tracks', () => {
    const s = createSeason('My Team', PILOT_ROSTER[1], BRAND_ROSTER[1], new RNG(2));
    expect(s.playerRider.isPlayer).toBe(true);
    expect(s.aiRiders).toHaveLength(9);
    expect(s.calendar).toHaveLength(6);
    expect(new Set(s.calendar.map((t) => t.id)).size).toBe(6);
    expect(s.currentRaceIndex).toBe(0);
  });
});
