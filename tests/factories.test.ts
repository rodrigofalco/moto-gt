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
    expect(new Set(ai.map((r) => r.name)).size).toBe(9); // unique names, no "Rider 2" dupes
    // Never includes the player's pilot archetype.
    expect(ai.every((r) => r.name !== PILOT_ROSTER[0].name)).toBe(true);
  });

  it('generateAIRiders never uses the player pilot archetype', () => {
    for (const player of PILOT_ROSTER) {
      const ai = generateAIRiders(player.id, BRAND_ROSTER[0].id, new RNG(1));
      expect(ai.every((r) => r.name !== player.name)).toBe(true);
    }
  });

  it('generateAIRiders is deterministic per seed', () => {
    const a = generateAIRiders(PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(99));
    const b = generateAIRiders(PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(99));
    expect(a.map((r) => r.name)).toEqual(b.map((r) => r.name));
    expect(a.map((r) => r.brandId)).toEqual(b.map((r) => r.brandId));
  });

  it('generateAIRiders varies the archetype set across seeds (AI variety)', () => {
    // Different seeds should pick different 9-of-17 archetype sets, so the player
    // faces varied opponents across seasons. Not every seed must differ, but the
    // overwhelming majority should (17 choose 9 = 24310 combinations).
    const sets: string[][] = [];
    for (let seed = 1; seed <= 20; seed++) {
      const ai = generateAIRiders(PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, new RNG(seed));
      sets.push(ai.map((r) => r.name).sort());
    }
    const uniqueSets = new Set(sets.map((s) => s.join(',')));
    // At least 15 of 20 seeds yield a distinct opponent roster.
    expect(uniqueSets.size).toBeGreaterThanOrEqual(15);
  });

  it('createSeason assembles 1 player + 9 AI + 6 tracks', () => {
    const s = createSeason('My Team', PILOT_ROSTER[1], BRAND_ROSTER[1], new RNG(2));
    expect(s.playerRider.isPlayer).toBe(true);
    expect(s.aiRiders).toHaveLength(9);
    expect(s.calendar).toHaveLength(6);
    expect(new Set(s.calendar.map((t) => t.id)).size).toBe(6);
    expect(s.currentRaceIndex).toBe(0);
  });

  it('createSeason seeds lastRisk to medium', () => {
    const s = createSeason('My Team', PILOT_ROSTER[1], BRAND_ROSTER[1], new RNG(2));
    expect(s.lastRisk).toBe('medium');
    });

  it('weatherByRace has 6 entries matching calendar length', () => {
    const s = createSeason('My Team', PILOT_ROSTER[1], BRAND_ROSTER[1], new RNG(2));
    expect(s.weatherByRace).toHaveLength(6);
    });

  it('weather is deterministic per seed', () => {
    const a = createSeason('My Team', PILOT_ROSTER[1], BRAND_ROSTER[1], new RNG(42));
    const b = createSeason('My Team', PILOT_ROSTER[1], BRAND_ROSTER[1], new RNG(42));
    expect(a.weatherByRace).toEqual(b.weatherByRace);
    });

  it('weather contains both dry and wet races', () => {
    const s = createSeason('My Team', PILOT_ROSTER[1], BRAND_ROSTER[1], new RNG(7));
    const weathers = s.weatherByRace!;
    expect(weathers).toContain('dry');
    expect(weathers).toContain('wet');
    });
});
