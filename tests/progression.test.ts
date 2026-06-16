import { describe, it, expect, beforeEach } from 'vitest';
import { applyProgression, investBikePoint, resetProgression } from '../src/core/Progression';
import type { Rider, RaceResult, Track } from '../src/core/types';

beforeEach(resetProgression);

const track: Track = { id: 't', name: 'T', location: 'X', weights: { speed: 0.8, cornering: 0.1, acceleration: 0.1 } };

function mkRider(id: string, isPlayer: boolean): Rider {
  return {
    id, name: id, team: 'T', isPlayer, brandId: 'titan',
    skills: { pace: 5, cornering: 5, consistency: 5 },
    bike: { speed: 5, handling: 5, acceleration: 5 },
    pilotXp: 0, rndPoints: 0, points: 0, positionCounts: new Array(10).fill(0),
  };
}

function resultWith(order: Rider[]): RaceResult {
  return {
    raceIndex: 0, track,
    finishingOrder: order.map((rider, i) => ({
      rider, position: i + 1, pointsAwarded: 0, setup: 'topSpeed', risk: 'medium', crashed: false, performanceScore: 0,
    })),
  };
}

describe('Progression', () => {
  it('player earns R&D points (base + win bonus) but does not auto-spend the bike', () => {
    const player = mkRider('player', true);
    const ais = Array.from({ length: 9 }, (_, i) => mkRider(`ai${i}`, false));
    applyProgression([player, ...ais], resultWith([player, ...ais])); // player won
    expect(player.rndPoints).toBe(2 + 1 + 1); // base + podium + win
    expect(player.bike.speed).toBe(5);        // unspent
  });

  it('investBikePoint spends one point, capped at 10', () => {
    const player = mkRider('player', true);
    player.rndPoints = 1;
    expect(investBikePoint(player, 'speed')).toBe(true);
    expect(player.bike.speed).toBe(6);
    expect(player.rndPoints).toBe(0);
    expect(investBikePoint(player, 'speed')).toBe(false); // no points left
  });

  it('pilot auto-levels toward the raced track emphasis after enough XP', () => {
    const ai = mkRider('ai', false);
    // 3 wins on a speed-heavy track => XP 3*(10+5+5)=60 => 2 level-ups, both to pace (speed axis).
    const all = [ai];
    for (let i = 0; i < 3; i++) applyProgression(all, resultWith([ai]));
    expect(ai.skills.pace).toBe(7); // +2
  });

  it('AI bikes auto-spend their R&D on the weakest param', () => {
    const ai = mkRider('ai', false);
    ai.bike = { speed: 8, handling: 3, acceleration: 8 };
    applyProgression([ai], resultWith([ai])); // earns 4 points, all to handling (weakest)
    expect(ai.bike.handling).toBe(7);
    expect(ai.rndPoints).toBe(0);
  });
});
