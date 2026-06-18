import type { Tier } from '../core/types';

export const TIERS: readonly Tier[] = [
  { id: 'rookie', name: 'Rookie', aiStatBonus: 0, order: 1 },
  { id: 'pro', name: 'Pro', aiStatBonus: 1, order: 2 },
  { id: 'factory', name: 'Factory', aiStatBonus: 2, order: 3 },
];

export function getTier(id: string): Tier {
  return TIERS.find((t) => t.id === id) ?? TIERS[0];
}

export function nextTier(id: string): string {
  const idx = TIERS.findIndex((t) => t.id === id);
  return idx < TIERS.length - 1 ? TIERS[idx + 1].id : id;
}
