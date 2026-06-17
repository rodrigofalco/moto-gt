import type { SeasonState, RaceResult, Rider, CareerStats } from './types';
import { SEASON_RACE_COUNT } from './constants';

export function applyRaceResult(season: SeasonState, result: RaceResult): void {
  for (const e of result.finishingOrder) {
    e.rider.points += e.pointsAwarded;
    e.rider.positionCounts[e.position - 1] += 1;
   }
  season.raceResults.push(result);
  season.currentRaceIndex += 1;
  season.isSeasonComplete = season.currentRaceIndex >= SEASON_RACE_COUNT;
}

function compareStandings(a: Rider, b: Rider): number {
  if (a.points !== b.points) return b.points - a.points;
  for (let i = 0; i < 10; i++) {
    if (a.positionCounts[i] !== b.positionCounts[i]) return b.positionCounts[i] - a.positionCounts[i];
   }
   // Final deterministic fallback: id order (effectively never reached).
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function getStandings(season: SeasonState): Rider[] {
  return [season.playerRider, ...season.aiRiders].slice().sort(compareStandings);
}

export function getChampion(season: SeasonState): Rider {
  return getStandings(season)[0];
}

export function aggregateCareerStats(season: SeasonState): CareerStats {
  const player = season.playerRider;
  const existing = player.careerStats;
  const wins = player.positionCounts[0];
  const podiums = player.positionCounts[0] + player.positionCounts[1] + player.positionCounts[2];
  const champPos = getStandings(season).findIndex((r) => r.isPlayer) + 1;

  return {
    seasonsPlayed: existing.seasonsPlayed + 1,
    totalWins: existing.totalWins + wins,
    totalPodiums: existing.totalPodiums + podiums,
    totalPoints: existing.totalPoints + player.points,
    bestChampionship: Math.min(existing.bestChampionship, champPos),
    lapsCompleted: existing.lapsCompleted,
  };
}

export function mergeCareerStats(existing: CareerStats, newStats: CareerStats): CareerStats {
  return {
    seasonsPlayed: existing.seasonsPlayed + newStats.seasonsPlayed,
    totalWins: existing.totalWins + newStats.totalWins,
    totalPodiums: existing.totalPodiums + newStats.totalPodiums,
    totalPoints: existing.totalPoints + newStats.totalPoints,
    bestChampionship: Math.min(existing.bestChampionship, newStats.bestChampionship),
    lapsCompleted: existing.lapsCompleted + newStats.lapsCompleted,
  };
}
