import { describe, it, expect } from 'vitest';
import { prizeFor, PRIZE_MONEY, RND_POINT_COST } from '../src/core/Economy';

describe('P2.5 — economy', () => {
  it('PRIZE_MONEY has 10 entries, descending', () => {
    expect(PRIZE_MONEY).toHaveLength(10);
    for (let i = 1; i < 10; i++) {
      expect(PRIZE_MONEY[i]).toBeLessThan(PRIZE_MONEY[i - 1]);
       }
     });

  it('prizeFor returns correct amounts', () => {
    expect(prizeFor(1)).toBe(5000);
    expect(prizeFor(5)).toBe(1300);
    expect(prizeFor(10)).toBe(150);
     });

  it('prizeFor returns 0 for positions outside 1-10', () => {
    expect(prizeFor(0)).toBe(0);
    expect(prizeFor(11)).toBe(0);
    expect(prizeFor(20)).toBe(0);
     });

  it('RND_POINT_COST is a positive number', () => {
    expect(RND_POINT_COST).toBe(800);
     });
   });
