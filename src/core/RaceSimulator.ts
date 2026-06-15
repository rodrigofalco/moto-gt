import type { SeasonState, RidingStyle, Rider, Track, RaceResult, FinishingPosition } from './types';
import { CORNERING_MULTIPLIER, NOISE_STD_DEV, STYLE_PACE_MODIFIER, POINTS_TABLE } from './constants';
import { mistakeProbability, mistakePenalty } from './MistakeSystem';
import { selectAIStyle } from './AIStyleSelector';
import type { RNG } from './RNG';

interface ScoredRider { rider: Rider; score: number; hadMistake: boolean; }

function corneringContribution(rider: Rider, track: Track): number {
  return (rider.stats.cornering / 10) * track.technicality * CORNERING_MULTIPLIER;
}

function computeScore(rider: Rider, style: RidingStyle, track: Track, rng: RNG): ScoredRider {
  let score = rider.stats.pace
    + corneringContribution(rider, track)
    + STYLE_PACE_MODIFIER[style]
    + rng.gaussian(0, NOISE_STD_DEV);
  let hadMistake = false;
  if (rng.nextFloat() < mistakeProbability(style, rider.stats.consistency)) {
    hadMistake = true;
    score -= mistakePenalty(rng);
  }
  return { rider, score, hadMistake };
}

function compareScored(a: ScoredRider, b: ScoredRider, rng: RNG): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.rider.stats.pace !== b.rider.stats.pace) return b.rider.stats.pace - a.rider.stats.pace;
  if (a.rider.stats.cornering !== b.rider.stats.cornering) return b.rider.stats.cornering - a.rider.stats.cornering;
  if (a.rider.stats.consistency !== b.rider.stats.consistency) return b.rider.stats.consistency - a.rider.stats.consistency;
  return rng.nextFloat() - 0.5;
}

export function simulateRace(season: SeasonState, playerStyle: RidingStyle, rng: RNG): RaceResult {
  if (season.currentRaceIndex >= season.calendar.length) {
    throw new Error('All races have been simulated.');
  }
  const track = season.calendar[season.currentRaceIndex];
  const all = [season.playerRider, ...season.aiRiders];

  const scored = all.map((rider) => {
    const style = rider.isPlayer ? playerStyle : selectAIStyle(rider, rng);
    return computeScore(rider, style, track, rng);
  });

  scored.sort((a, b) => compareScored(a, b, rng));

  const finishingOrder: FinishingPosition[] = scored.map((s, index) => {
    const position = index + 1;
    return {
      position,
      rider: s.rider,
      pointsAwarded: position <= POINTS_TABLE.length ? POINTS_TABLE[position - 1] : 0,
      performanceScore: s.score,
      hadMistake: s.hadMistake,
    };
  });

  return { raceIndex: season.currentRaceIndex, track, playerStyle, finishingOrder };
}
