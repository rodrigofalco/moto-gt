import type { Rider, RidingStyle } from './types';
import type { RNG } from './RNG';

interface Weights { safe: number; balanced: number; aggressive: number; }

function weightsFor(aggressionScore: number): Weights {
  if (aggressionScore <= -4) return { safe: 60, balanced: 30, aggressive: 10 };
  if (aggressionScore <= -1) return { safe: 35, balanced: 45, aggressive: 20 };
  if (aggressionScore <= 1)  return { safe: 20, balanced: 55, aggressive: 25 };
  if (aggressionScore <= 4)  return { safe: 10, balanced: 45, aggressive: 45 };
  return { safe: 5, balanced: 30, aggressive: 65 };
}

export function selectAIStyle(rider: Rider, rng: RNG): RidingStyle {
  const w = weightsFor(rider.stats.pace - rider.stats.consistency);
  const roll = rng.nextInt(1, 100);
  if (roll <= w.safe) return 'safe';
  if (roll <= w.safe + w.balanced) return 'balanced';
  return 'aggressive';
}
