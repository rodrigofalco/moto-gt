import { getStandings, getChampion } from './Championship';
import { nextTier } from '../data/tiers';
import type { CareerState, OffSeasonReport } from './types';

export function runOffSeason(career: CareerState): OffSeasonReport {
  const standings = career.season ? getStandings(career.season) : [];
  const champion = career.season ? getChampion(career.season).name : 'N/A';
  const playerFinish = standings.findIndex((r) => r.isPlayer) + 1;
  let promoted = false;
  if (playerFinish <= 3 && career.tierId !== 'factory') {
    career.tierId = nextTier(career.tierId);
    promoted = true;
     }
  career.seasonNumber += 1;
  career.season = null;
  return {
    previousSeason: career.seasonNumber - 1,
    playerFinish,
    champion,
    promoted,
    retired: [],
    rookies: [],
    statChanges: [],
     };
}
