import type { SeasonState, Setup, Risk, Rider, Track, RaceResult, RaceEntry, RaceTimeline, LapSnapshot, Weather } from './types';
import { POINTS_TABLE, PUSH_BONUS, RACE_LAPS, LAP_NOISE_STD, MOMENTUM_WEIGHT, DRAFT_RANGE, DRAFT_BONUS, FIELD_COMPRESSION, GRID_SPACING } from './constants';
import { baseAxes, applySetup, weightedBase, type Axes } from './PerformanceModel';
import { crashProbability } from './CrashModel';
import { aiSetup, aiRisk } from './AIDecision';
import type { RNG } from './RNG';

export interface RiderState {
  rider: Rider; setup: Setup; aiRisk: Risk; lastRisk: Risk;
  basePace: number; axes: Axes;            // basePace excludes push (push is applied per lap by risk)
  progress: number; crashed: boolean; crashLap: number;
  lastNoise: number;                       // AR(1) state: last lap's applied noise (0 before lap 1)
}

export interface RaceRun {
  raceIndex: number;
  track: Track;
  states: RiderState[];
  lap: number;        // laps completed (0..RACE_LAPS)
  meanPace: number;   // field-average basePace (compression reference; constant per race)
  rng: RNG;
  weather: Weather;   // weather for this race
}

function perLapCrashProb(risk: Risk, consistency: number, track: Track, weather: Weather): number {
  const whole = crashProbability(risk, consistency, track, weather);
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

export function createRace(season: SeasonState, playerSetup: Setup, rng: RNG, grid?: string[]): RaceRun {
  if (season.currentRaceIndex >= season.calendar.length) throw new Error('All races have been simulated.');
  const track = season.calendar[season.currentRaceIndex];
  const weather = season.weatherByRace?.[season.currentRaceIndex] ?? 'dry';
  const field = [season.playerRider, ...season.aiRiders];
  const fieldSize = field.length;
  const states: RiderState[] = field.map((rider) => {
    const setup = rider.isPlayer ? playerSetup : aiSetup(rider, track, rng);
    const risk = rider.isPlayer ? 'medium' : aiRisk(rider, rng);
    const axes = applySetup(baseAxes(rider.skills, rider.bike), setup, weather);
    let progress = 0;
    if (grid) {
      const gridPos = grid.indexOf(rider.id);
      if (gridPos !== -1) {
        progress = (fieldSize - gridPos) * GRID_SPACING;
       }
      }
    return { rider, setup, aiRisk: risk, lastRisk: risk, basePace: weightedBase(axes, track), axes, progress, crashed: false, crashLap: 0, lastNoise: 0 };
    });
  const meanPace = states.reduce((a, s) => a + s.basePace, 0) / states.length || 7;
  return { raceIndex: season.currentRaceIndex, track, states, lap: 0, meanPace, rng, weather };
}

// AR(1) momentum: blend carryover with fresh noise. Variance-preserving for the per-lap
// marginal; positive autocorrelation lifts race-total variance back toward the old level.
export function momentumNoise(lastNoise: number, fresh: number): number {
  return MOMENTUM_WEIGHT * lastNoise + Math.sqrt(1 - MOMENTUM_WEIGHT * MOMENTUM_WEIGHT) * fresh;
}

// A rider gets a tow if at least one non-crashed rider is strictly ahead within DRAFT_RANGE.
export function hasDraftTow(progress: number[], crashed: boolean[], i: number): boolean {
  if (crashed[i]) return false;
  return progress.some((p, j) =>
    j !== i && !crashed[j] && p > progress[i] && p - progress[i] <= DRAFT_RANGE);
}

// Advance exactly one lap. The player uses `playerRisk` this lap; AI use their fixed race risk.
export function stepLap(run: RaceRun, playerRisk: Risk): void {
  run.lap += 1;
  for (const s of run.states) {
    if (s.crashed) continue;
    const risk = s.rider.isPlayer ? playerRisk : s.aiRisk;
    s.lastRisk = risk;
    s.lastNoise = momentumNoise(s.lastNoise, run.rng.gaussian(0, LAP_NOISE_STD));
    // Order-preserving compression toward the field mean: keeps the pack close without
    // changing who finishes where (FIELD_COMPRESSION = 1 reproduces the raw spread).
    const dev = (s.basePace - run.meanPace) + PUSH_BONUS[risk] + s.lastNoise;
    s.progress += run.meanPace + FIELD_COMPRESSION * dev;
    if (run.rng.nextFloat() < perLapCrashProb(risk, s.rider.skills.consistency, run.track, run.weather)) {
      s.crashed = true;
      s.crashLap = run.lap;
    }
  }
  // Drafting: a second pass over post-movement positions (pre-tow), so tows don't cascade.
  const preDraft = run.states.map((s) => s.progress);
  const crashed = run.states.map((s) => s.crashed);
  run.states.forEach((s, i) => {
    if (hasDraftTow(preDraft, crashed, i)) s.progress += DRAFT_BONUS;
  });
}

export function finalizeRace(run: RaceRun, rng: RNG): RaceResult {
  const ordered = run.states.slice().sort((a, b) => compare(a, b, rng));
  const finishingOrder: RaceEntry[] = ordered.map((s, i) => ({
    rider: s.rider,
    position: i + 1,
    pointsAwarded: i < POINTS_TABLE.length ? POINTS_TABLE[i] : 0,
    setup: s.setup,
    risk: s.lastRisk,
    crashed: s.crashed,
    performanceScore: s.progress,
  }));
  return { raceIndex: run.raceIndex, track: run.track, finishingOrder };
}

// Non-interactive convenience: the player holds `playerRisk` for every lap.
export function runRace(season: SeasonState, playerSetup: Setup, playerRisk: Risk, rng: RNG): { result: RaceResult; timeline: RaceTimeline } {
  const run = createRace(season, playerSetup, rng);
  const laps: LapSnapshot[] = [];
  for (let i = 0; i < RACE_LAPS; i++) {
    stepLap(run, playerRisk);
    laps.push({ lap: run.lap, entries: run.states.map((s) => ({ riderId: s.rider.id, progress: s.progress, crashed: s.crashed })) });
  }
  return { result: finalizeRace(run, rng), timeline: { laps, totalLaps: RACE_LAPS } };
}

export function simulateRace(season: SeasonState, playerSetup: Setup, playerRisk: Risk, rng: RNG): RaceResult {
  return runRace(season, playerSetup, playerRisk, rng).result;
}
