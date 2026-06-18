import { describe, it, expect, beforeEach } from 'vitest';
import { applyProgression, investBikePoint, resetProgression } from '../src/core/Progression';
import type { Rider, RaceResult, Track } from '../src/core/types';

beforeEach(resetProgression);

const track: Track = { id: 't', name: 'T', location: 'X', weights: { speed: 0.8, cornering: 0.1, acceleration: 0.1 } };

function mkRider(id: string, isPlayer: boolean): Rider {
  return {
    id, name: id, team: 'T', isPlayer, brandId: 'titan',
    age: 25, skills: { pace: 5, cornering: 5, consistency: 5 },
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

  it('investBikePoint spends points, respects cost curve and caps at 10', () => {
    const player = mkRider('player', true);
    // cost at param 5 = Math.round(2 * (1 + 0.5 * 4)) = 6
    player.rndPoints = 6;
    expect(investBikePoint(player, 'speed')).toBe(true);
    expect(player.bike.speed).toBe(6);
    expect(player.rndPoints).toBe(0);
    // param 6 costs Math.round(2 * (1 + 0.5 * 5)) = 7, can't afford
    expect(investBikePoint(player, 'speed')).toBe(false);
   });

  it('pilot auto-levels toward the raced track emphasis after enough XP', () => {
    const ai = mkRider('ai', false);
    ai.skills = { pace: 2, cornering: 5, consistency: 5 };
       // Convex curve: cost at pace 2 = round(25*(1+0.0375*1)) = 26; at pace 3 = 29.
       // 3 wins => XP 3*20=60 => 2 level-ups (26+29=55), remaining XP 5.
    const all = [ai];
    for (let i = 0; i < 3; i++) applyProgression(all, resultWith([ai]));
    expect(ai.skills.pace).toBe(4); // +2 (early levels are cheap)
    expect(ai.pilotXp).toBe(5);      // 60 - 26 - 29
       });

  it('AI bikes auto-spend their R&D on the weakest param', () => {
    const ai = mkRider('ai', false);
    ai.bike = { speed: 8, handling: 3, acceleration: 8 };
     // earns 4 R&D points (base 2 + podium 1 + win 1), all to handling
     // cost at handling 3 = Math.round(2*(1+0.5*2)) = 4, exactly 1 upgrade
    applyProgression([ai], resultWith([ai]));
    expect(ai.bike.handling).toBe(4);
    expect(ai.rndPoints).toBe(0);
     // Next cost at handling 4 = Math.round(2*(1+0.5*3)) = 5, can't afford more
    expect(ai.bike.handling).toBe(4);
     });
});
