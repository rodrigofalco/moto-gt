import type { SeasonState, Setup, Risk, Rider, Track, RaceResult, RaceEntry, RaceTimeline, LapSnapshot } from './types';
import { POINTS_TABLE, PUSH_BONUS, RACE_LAPS, LAP_NOISE_STD } from './constants';
import { baseAxes, applySetup, weightedBase, type Axes } from './PerformanceModel';
import { crashProbability } from './CrashModel';
import { aiSetup, aiRisk } from './AIDecision';
import type { RNG } from './RNG';

interface RiderState {
  rider: Rider; setup: Setup; risk: Risk;
  basePace: number; axes: Axes;
  progress: number; crashed: boolean; crashLap: number;
}

function perLapCrashProb(risk: Risk, consistency: number, track: Track): number {
  const whole = crashProbability(risk, consistency, track);
  return 1 - Math.pow(1 - whole, 1 / RACE_LAPS);
}

function compare(a: RiderState, b: RiderState, rng: RNG): number {
  if (a.crashed !== b.crashed) return a.crashed ? 1 : -1;       // finishers ahead of crashers
  if (a.crashed && a.crashLap !== b.crashLap) return b.crashLap - a.crashLap; // later crash = ahead
  if (a.progress !== b.progress) return b.progress - a.progress;
  if (a.axes.speed !== b.axes.speed) return b.axes.speed - a.axes.speed;
  if (a.axes.cornering !== b.axes.cornering) return b.axes.cornering - a.axes.cornering;
  if (a.axes.acceleration !== b.axes.acceleration) return b.axes.acceleration - a.axes.acceleration;
  return rng.nextFloat() - 0.5;
}

export function runRace(season: SeasonState, playerSetup: Setup, playerRisk: Risk, rng: RNG): { result: RaceResult; timeline: RaceTimeline } {
  if (season.currentRaceIndex >= season.calendar.length) throw new Error('All races have been simulated.');
  const track = season.calendar[season.currentRaceIndex];

  const states: RiderState[] = [season.playerRider, ...season.aiRiders].map((rider) => {
    const setup = rider.isPlayer ? playerSetup : aiSetup(rider, track, rng);
    const risk = rider.isPlayer ? playerRisk : aiRisk(rider, rng);
    const axes = applySetup(baseAxes(rider.skills, rider.bike), setup);
    return { rider, setup, risk, basePace: weightedBase(axes, track) + PUSH_BONUS[risk], axes, progress: 0, crashed: false, crashLap: 0 };
  });

  const laps: LapSnapshot[] = [];
  for (let lap = 1; lap <= RACE_LAPS; lap++) {
    for (const s of states) {
      if (s.crashed) continue;
      s.progress += s.basePace + rng.gaussian(0, LAP_NOISE_STD);
      if (rng.nextFloat() < perLapCrashProb(s.risk, s.rider.skills.consistency, track)) {
        s.crashed = true;
        s.crashLap = lap;
      }
    }
    laps.push({ lap, entries: states.map((s) => ({ riderId: s.rider.id, progress: s.progress, crashed: s.crashed })) });
  }

  const ordered = states.slice().sort((a, b) => compare(a, b, rng));
  const finishingOrder: RaceEntry[] = ordered.map((s, i) => ({
    rider: s.rider,
    position: i + 1,
    pointsAwarded: i < POINTS_TABLE.length ? POINTS_TABLE[i] : 0,
    setup: s.setup,
    risk: s.risk,
    crashed: s.crashed,
    performanceScore: s.progress,
  }));

  return { result: { raceIndex: season.currentRaceIndex, track, finishingOrder }, timeline: { laps, totalLaps: RACE_LAPS } };
}

export function simulateRace(season: SeasonState, playerSetup: Setup, playerRisk: Risk, rng: RNG): RaceResult {
  return runRace(season, playerSetup, playerRisk, rng).result;
}
