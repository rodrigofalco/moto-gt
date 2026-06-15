import type { SeasonState, RaceResult, Rider } from './types';
import { SEASON_RACE_COUNT } from './constants';

export function applyRaceResult(season: SeasonState, result: RaceResult): void {
  for (const fp of result.finishingOrder) {
    fp.rider.points += fp.pointsAwarded;
    fp.rider.positionCounts[fp.position - 1] += 1;
  }
  season.raceResults.push(result);
  season.currentRaceIndex += 1;
  season.isSeasonComplete = season.currentRaceIndex >= SEASON_RACE_COUNT;
}

function compareForStandings(a: Rider, b: Rider, rng?: () => number): number {
  if (a.points !== b.points) return b.points - a.points;
  for (let i = 0; i < 10; i++) {
    if (a.positionCounts[i] !== b.positionCounts[i]) return b.positionCounts[i] - a.positionCounts[i];
  }
  if (a.stats.pace !== b.stats.pace) return b.stats.pace - a.stats.pace;
  if (a.stats.cornering !== b.stats.cornering) return b.stats.cornering - a.stats.cornering;
  if (a.stats.consistency !== b.stats.consistency) return b.stats.consistency - a.stats.consistency;
  return (rng ? rng() : 0.5) - 0.5;
}

export function getStandings(season: SeasonState): Rider[] {
  return [season.playerRider, ...season.aiRiders].slice().sort((a, b) => compareForStandings(a, b));
}

export function getChampion(season: SeasonState): Rider {
  return getStandings(season)[0];
}
