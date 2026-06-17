import { describe, it, expect } from 'vitest';
import { ordinal, formatMoney, formatSigned } from '../src/core/format';

describe('P0.4 — format helpers', () => {
  describe('ordinal', () => {
    it('handles 1, 2, 3 correctly', () => {
      expect(ordinal(1)).toBe('1st');
      expect(ordinal(2)).toBe('2nd');
      expect(ordinal(3)).toBe('3rd');
     });
    it('handles 4, 11, 21', () => {
      expect(ordinal(4)).toBe('4th');
      expect(ordinal(11)).toBe('11th');
      expect(ordinal(21)).toBe('21st');
     });
    it('handles negative numbers', () => {
      expect(ordinal(-1)).toBe('-1st');
      expect(ordinal(-2)).toBe('-2nd');
      expect(ordinal(-3)).toBe('-3rd');
     });
    it('handles zero', () => {
      expect(ordinal(0)).toBe('0th');
     });
   });

  describe('formatMoney', () => {
    it('formats basic amounts', () => {
      expect(formatMoney(1250)).toBe('$1,250');
      expect(formatMoney(0)).toBe('$0');
      expect(formatMoney(5000)).toBe('$5,000');
     });
    it('handles negative', () => {
      expect(formatMoney(-500)).toBe('($500)');
     });
   });

  describe('formatSigned', () => {
    it('formats positive and negative', () => {
      expect(formatSigned(3)).toBe('+3');
      expect(formatSigned(-1)).toBe('-1');
      expect(formatSigned(0)).toBe('+0');
     });
   });
});
