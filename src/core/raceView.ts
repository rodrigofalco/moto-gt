// Pure presentation helpers for the race-day view. No Phaser, no state.
// Turns each rider's live progress into an on-track "train" position, and derives
// race-fiction lap times. See docs/superpowers/specs/2026-06-16-race-view-overhaul-design.md.

export interface TrainEntry { id: string; progress: number; crashed: boolean; grid: number; }
export interface TrainSlot { id: string; placeBehind: number; crashed: boolean; rank: number; }

// Place each non-crashed rider behind the leader along the track, so the train's
// spatial order is exactly the standings order (progress desc, grid as tie-break).
// `placeBehind` is a loop fraction: 0 = leader, larger = further back.
//
// Spacing accumulates per-gap: the interval to the car ahead is clamped to
// [minSep, maxStep]. minSep guarantees dots never stack (even a whole field lapped onto
// the same progress stays separated and in order); maxStep caps any one gap so a lapped
// backmarker can't push the rest off the track. With (GRID-1)*maxStep <= ~one loop the
// train never wraps onto the leader.
export function trainLayout(
  entries: TrainEntry[],
  opts: { minSep: number; gapScale: number; maxStep: number; maxSpread: number },
): TrainSlot[] {
  const runners = entries
    .filter((e) => !e.crashed)
    .slice()
    .sort((a, b) => b.progress - a.progress || a.grid - b.grid);

  const slots: TrainSlot[] = [];
  let placeBehind = 0;
  runners.forEach((entry, idx) => {
    if (idx > 0) {
      const rawStep = (runners[idx - 1].progress - entry.progress) * opts.gapScale;
      placeBehind += Math.min(Math.max(rawStep, opts.minSep), opts.maxStep);
    }
    slots.push({ id: entry.id, placeBehind, crashed: false, rank: idx + 1 });
  });

  // Crashed riders are out of the train: ranked after all runners, parked at the tail.
  entries
    .filter((e) => e.crashed)
    .forEach((entry, k) =>
      slots.push({ id: entry.id, placeBehind: opts.maxSpread, crashed: true, rank: runners.length + k + 1 }));

  return slots;
}

// Race-fiction lap time: `base` seconds to cover one loop at average pace. A lap that
// gained more progress was faster (smaller time). `spread` compresses how much the
// simulation's progress noise shows up as time variation, so laps cluster realistically
// (spread 0 → every lap == base; 1 → raw progress ratio). delta is floored so a near-zero
// (crash-ish) lap can't produce an absurd time.
export function lapTime(delta: number, progressPerLoop: number, base: number, spread = 0.25): number {
  const ratio = progressPerLoop / Math.max(delta, progressPerLoop * 0.4);
  return base * (1 + spread * (ratio - 1));
}

// "1:29.430" at/over a minute, "58.200" under. Always 3 decimal places.
export function formatLapTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const ss = `${s < 10 ? '0' : ''}${s.toFixed(3)}`;
  return m > 0 ? `${m}:${ss}` : s.toFixed(3);
}
