import { describe, it, expect } from 'vitest';
import { pilotLevelCost, bikeUpgradeCost } from '../src/core/CostCurve';

describe('P2.1 — cost curves', () => {
  describe('pilotLevelCost', () => {
    it('is monotonically increasing', () => {
      for (let i = 1; i < 10; i++) {
        expect(pilotLevelCost(i + 1)).toBeGreaterThan(pilotLevelCost(i));
        }
      });

    it('cost at stat 9 >> cost at stat 2', () => {
      expect(pilotLevelCost(9)).toBeGreaterThan(pilotLevelCost(2) * 3);
      });

    it('returns specific values', () => {
      expect(pilotLevelCost(1)).toBe(25);  // 25 * (1 + 0.0375 * 0)  = 25
      expect(pilotLevelCost(2)).toBe(26);  // 25 * (1 + 0.0375 * 1)  = 25.9 → 26
      expect(pilotLevelCost(5)).toBe(40);  // 25 * (1 + 0.0375 * 16) = 40
      });
    });

  describe('bikeUpgradeCost', () => {
    it('is monotonically increasing', () => {
      for (let i = 1; i < 10; i++) {
        expect(bikeUpgradeCost(i + 1)).toBeGreaterThan(bikeUpgradeCost(i));
        }
      });

    it('cost at stat 9 >> cost at stat 2', () => {
      expect(bikeUpgradeCost(9)).toBeGreaterThan(bikeUpgradeCost(2) * 3);
      });

    it('returns specific values', () => {
      expect(bikeUpgradeCost(1)).toBe(2);   // 2 * (1 + 0.5 * 0) = 2
      expect(bikeUpgradeCost(2)).toBe(3);   // 2 * (1 + 0.5 * 1) = 3
      expect(bikeUpgradeCost(5)).toBe(6);    // 2 * (1 + 0.5 * 4) = 6
      });
    });
});
