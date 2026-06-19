import type { SeasonState } from './types';

const SAVE_KEY = 'motogt_save';

export class SaveSystem {
  private static instance: SaveSystem;
  private constructor() {}
  static get Instance() { return this.instance || (this.instance = new this()); }

  saveSeason(season: SeasonState): void {
    const data = {
      ...season,
      playerRider: { ...season.playerRider },
      aiRiders: season.aiRiders.map((r) => ({ ...r })),
      calendar: season.calendar.map((t) => ({ ...t })),
      raceResults: season.raceResults.map((r) => ({
        ...r,
        track: { ...r.track },
        finishingOrder: r.finishingOrder.map((e) => ({ ...e, rider: { ...e.rider } })),
      })),
      _savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  loadSeason(): SeasonState | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  hasSave(): boolean { return !!localStorage.getItem(SAVE_KEY); }

  deleteSave(): void { localStorage.removeItem(SAVE_KEY); }

  getSaveTimestamp(): number | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw)._savedAt ?? null;
    } catch { return null; }
  }
}
