import { describe, it, expect, beforeEach } from 'vitest';
import {
  newCareer, saveCareer, loadCareer, hasCareer, clearCareer,
  CAREER_KEY, CAREER_VERSION,
} from '../src/core/CareerStore';
import { RNG } from '../src/core/RNG';
import { PILOT_ROSTER } from '../src/data/pilots';
import { BRAND_ROSTER } from '../src/data/brands';

let store: Record<string, string> = {};

function polyfill(): void {
  globalThis.localStorage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    get length() { return Object.keys(store).length; },
    key: (n: number) => Object.keys(store)[n] ?? null,
  } as unknown as Storage;
}

beforeEach(() => { store = {}; polyfill(); });

describe('P1.3 — CareerStore', () => {
  it('round-trips: newCareer → saveCareer → loadCareer', () => {
    const rng = new RNG(123);
    const career = newCareer('Test Team', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, rng);
    saveCareer(career);

    const loaded = loadCareer();
    expect(loaded).not.toBeNull();
    expect(loaded!.team).toBe('Test Team');
    expect(loaded!.money).toBe(2000);
    expect(loaded!.field.length).toBe(9);
    expect(loaded!.player.id).toBe('player');
    expect(loaded!.tierId).toBe('rookie');
    expect(loaded!.season).toBeNull();
    expect(loaded!.version).toBe(CAREER_VERSION);
    expect(loaded!.pilotArchetypeId).toBe(PILOT_ROSTER[0].id);
    expect(loaded!.brandId).toBe(BRAND_ROSTER[0].id);
  });

  it('returns null for version mismatch', () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CAREER_KEY, JSON.stringify({ version: 0, team: 'Old' }));
    }
    expect(loadCareer()).toBeNull();
  });

  it('clearCareer removes the save and hasCareer returns false', () => {
    const rng = new RNG(123);
    const career = newCareer('Test', PILOT_ROSTER[0].id, BRAND_ROSTER[0].id, rng);
    saveCareer(career);
    expect(hasCareer()).toBe(true);

    clearCareer();
    expect(hasCareer()).toBe(false);
    expect(loadCareer()).toBeNull();
  });

  it('hasCareer returns false when no save exists', () => {
    expect(hasCareer()).toBe(false);
  });

  it('hasCareer returns false for corrupt JSON', () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CAREER_KEY, 'not-json');
    }
    expect(hasCareer()).toBe(false);
  });
});
