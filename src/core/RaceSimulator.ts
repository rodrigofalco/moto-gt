import type { SeasonState, Setup, Risk, Rider, Track, RaceResult, RaceEntry } from './types';
import { POINTS_TABLE, PUSH_BONUS, NOISE_STD_DEV } from './constants';
import { baseAxes, applySetup, weightedBase, type Axes } from './PerformanceModel';
import { crashProbability, crashPenalty } from './CrashModel';
import { aiSetup, aiRisk } from './AIDecision';
import type { RNG } from './RNG';

interface Scored { rider: Rider; setup: Setup; risk: Risk; crashed: boolean; perf: number; axes: Axes; }

function scoreRider(rider: Rider, setup: Setup, risk: Risk, track: Track, rng: RNG): Scored {
  const axes = applySetup(baseAxes(rider.skills, rider.bike), setup);
  let perf = weightedBase(axes, track) + PUSH_BONUS[risk] + rng.gaussian(0, NOISE_STD_DEV);
  let crashed = false;
  if (rng.nextFloat() < crashProbability(risk, rider.skills.consistency, track)) {
    crashed = true;
    perf -= crashPenalty(rng);
  }
  return { rider, setup, risk, crashed, perf, axes };
}

function compare(a: Scored, b: Scored, rng: RNG): number {
  if (a.perf !== b.perf) return b.perf - a.perf;
  if (a.axes.speed !== b.axes.speed) return b.axes.speed - a.axes.speed;
  if (a.axes.cornering !== b.axes.cornering) return b.axes.cornering - a.axes.cornering;
  if (a.axes.acceleration !== b.axes.acceleration) return b.axes.acceleration - a.axes.acceleration;
  return rng.nextFloat() - 0.5;
}

export function simulateRace(season: SeasonState, playerSetup: Setup, playerRisk: Risk, rng: RNG): RaceResult {
  if (season.currentRaceIndex >= season.calendar.length) throw new Error('All races have been simulated.');
  const track = season.calendar[season.currentRaceIndex];
  const all = [season.playerRider, ...season.aiRiders];

  const scored = all.map((rider) => {
    const setup = rider.isPlayer ? playerSetup : aiSetup(rider, track, rng);
    const risk = rider.isPlayer ? playerRisk : aiRisk(rider, rng);
    return scoreRider(rider, setup, risk, track, rng);
  });

  scored.sort((a, b) => compare(a, b, rng));

  const finishingOrder: RaceEntry[] = scored.map((s, index) => ({
    rider: s.rider,
    position: index + 1,
    pointsAwarded: index < POINTS_TABLE.length ? POINTS_TABLE[index] : 0,
    setup: s.setup,
    risk: s.risk,
    crashed: s.crashed,
    performanceScore: s.perf,
  }));

  return { raceIndex: season.currentRaceIndex, track, finishingOrder };
}
