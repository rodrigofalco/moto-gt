const VERSION = 1;

function safeGet(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSet(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* quota exceeded or unavailable */ }
}

function safeRemove(key: string): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(key); } catch { /* unavailable */ }
}

export function loadJSON<T>(key: string, fallback: T): T {
  const raw = safeGet(key);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    const obj = parsed as { version?: number } & Record<string, unknown>;
    if (obj && 'version' in obj && obj.version !== VERSION) return fallback;
    return obj as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  const wrapped = typeof value === 'object' && value !== null && 'version' in value
    ? value
    : { version: VERSION, ...value };
  safeSet(key, JSON.stringify(wrapped));
}

export function clearKey(key: string): void {
  safeRemove(key);
}
