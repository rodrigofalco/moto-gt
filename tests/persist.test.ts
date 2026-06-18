import { describe, it, expect, beforeEach } from 'vitest';
import { loadJSON, saveJSON, clearKey } from '../src/core/persist';

// Tiny in-memory localStorage polyfill
let store: Record<string, string> = {};

function polyfillLocalStorage(): void {
  globalThis.localStorage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (n: number) => Object.keys(store)[n] ?? null,
  } as unknown as Storage;
}

beforeEach(() => { store = {}; });

describe('P0.5 — versioned localStorage helper', () => {
  beforeEach(polyfillLocalStorage);

  it('round-trips save → load', () => {
    saveJSON('test-key', { name: 'hello', count: 42 });
    const result = loadJSON<{ name: string; count: number }>('test-key', { name: 'default', count: 0 });
    expect(result.name).toBe('hello');
    expect(result.count).toBe(42);
   });

  it('returns fallback when key is missing', () => {
    const result = loadJSON<{ value: string }>('nonexistent', { value: 'fallback' });
    expect(result.value).toBe('fallback');
   });

  it('returns fallback when value is corrupt JSON', () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('corrupt', 'not-json');
      }
    const result = loadJSON<{ value: string }>('corrupt', { value: 'ok' });
    expect(result.value).toBe('ok');
    });

  it('returns fallback when stored version mismatches', () => {
    // Manually write an old-version object
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('old-key', JSON.stringify({ version: 0, data: 'old' }));
     }
    const result = loadJSON<{ data: string }>('old-key', { data: 'new' });
    expect(result.data).toBe('new');
   });

  it('clearKey removes the stored value', () => {
    saveJSON('del-me', { x: 1 });
    expect(loadJSON<{ x: number }>('del-me', { x: 0 }).x).toBe(1);
    clearKey('del-me');
    expect(loadJSON<{ x: number }>('del-me', { x: 0 }).x).toBe(0);
   });

  it('works without localStorage (SSR-safe)', () => {
    const saved = globalThis.localStorage;
    delete (globalThis as Record<string, unknown>).localStorage;
    expect(loadJSON<{ a: number }>('any', { a: 99 }).a).toBe(99);
    saveJSON('nope', { a: 1 }); // should not throw
    (globalThis as Record<string, unknown>).localStorage = saved;
   });
});
