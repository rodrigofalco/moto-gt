// Tire compound system: soft/medium/hard with degradation over race distance.
import type { TireCompound } from './types';
import { TIRE_COMPOUNDS, TIRE_WEAR_PER_LAP_BASE } from './constants';

// Calculate cumulative tire wear after a lap.
// Higher durability = slower wear. Consistent riders wear tires slightly less.
export function calcTireWear(lap: number, compound: TireCompound, consistency: number): number {
  const compoundData = TIRE_COMPOUNDS[compound];
  const wearPerLap = TIRE_WEAR_PER_LAP_BASE / compoundData.durability;
  const consistencyBonus = (consistency - 5) * 0.03; // +/- up to 0.3
  return Math.min(100, lap * (wearPerLap - consistencyBonus));
}

// Effective grip multiplier based on wear and compound.
// Fresh soft > fresh medium > fresh hard, but worn hard can beat fresh soft.
export function getTireGrip(wear: number, compound: TireCompound): number {
  const compoundData = TIRE_COMPOUNDS[compound];
  // Grip degrades linearly with wear, faster at high wear
  const wearFactor = 1 - (wear / 100) * (0.3 + (wear > 70 ? 0.4 : 0));
  return compoundData.grip * wearFactor;
}

// Crash risk multiplier from worn tires.
// Below 50% wear: no effect. Above 70%: significant increase.
export function getTireCrashRisk(wear: number): number {
  if (wear < 50) return 1.0;
  if (wear < 70) return 1.0 + (wear - 50) * 0.01;
  return 1.2 + (wear - 70) * 0.03;
}

// Get compound color for UI display.
export function getCompoundColor(compound: TireCompound): number {
  return TIRE_COMPOUNDS[compound].color;
}

export function getCompoundLabel(compound: TireCompound): string {
  return TIRE_COMPOUNDS[compound].label;
}
