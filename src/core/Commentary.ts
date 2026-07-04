// Dynamic race commentary — broadcast-style text for key moments.
import type { RaceSnapshot, CommentaryEvent } from './types';

const PHRASES: Record<string, string[]> = {
  overtake: [
    '{a} takes P{pos} from {b}! What a move!',
    '{a} slides past {b} into P{pos}!',
    'Brilliant! {a} overtakes {b} for P{pos}!',
    '{a} makes the pass on {b}! P{pos}!',
  ],
  crash: [
    'CRASH! {a} goes down! What a shame!',
    '{a} is down at the corner! Looks bad.',
    'OH NO! {a} crashes out of the race!',
    '{a} cannot recover! Crashed and out!',
  ],
  lead_change: [
    '{a} takes the lead! The race is wide open!',
    '{a} leads after a stunning lap!',
    'New leader: {a}! Everyone else chasing!',
    '{a} grabs the front! Unstoppable!',
  ],
  fastest_lap: [
    'FASTEST LAP! {a} sets a blistering {time}!',
    '{a} throws down lap time of {time}!',
    'Look at that pace! {a} — {time}!',
    '{a} sets the benchmark: {time}!',
  ],
  battle: [
    '{a} is closing on {b}! The battle is on! (+{gap}s)',
    '{a} hunts {b} — only +{gap}s back!',
    '{a} right on the tail of {b}! Pass coming?',
    'Chasing action: {a} trails {b} by +{gap}s!',
  ],
  start: [
    'And they are OFF! The grid is set!',
    'Lights out and we are racing!',
    'The field rolls away for lap {lap}!',
    'Away they go for another lap!',
  ],
  finish: [
    'CHECKERED FLAGS! {a} takes the win!',
    '{a} crosses the line to win the race!',
    'It is all {a}! Winner of the race!',
    '{a} dominates! Checkered flag!',
  ],
  last_lap: [
    'This is the last lap! Who will take the win?',
    'Final lap! Everything on the line!',
    'One lap left! The championship hangs in the balance!',
  ],
  tire_warning: [
    '{a} tires are shot! +{wear}% wear — crash risk high!',
    '{a} on squishy tires — {wear}% worn! Be careful!',
    'Heavy tire wear for {a}: {wear}% — could cost them!',
  ],
};

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}

export function generateCommentary(prev: RaceSnapshot, cur: RaceSnapshot): CommentaryEvent[] {
  const events: CommentaryEvent[] = [];
  const player = cur.riders.find((r) => r.id === 'player')?.id ?? 'player';

  // Lap start
  if (cur.lap > prev.lap) {
    if (cur.lap === cur.totalLaps) {
      events.push({ lap: cur.lap, text: pick(PHRASES.last_lap), type: 'start' });
    }
    events.push({ lap: cur.lap, text: fill(pick(PHRASES.start), { lap: String(cur.lap) }), type: 'start' });
  }

  // Overtakes involving player
  const prevPos = prev.positions.get(player) ?? -1;
  const curPos = cur.positions.get(player) ?? -1;
  if (prevPos > 0 && curPos > 0 && curPos < prevPos) {
    const rider = cur.riders.find((r) => r.id === player);
    const behind = cur.riders.find((r) => r.id === cur.overtakeBy?.get(player));
    events.push({
      lap: cur.lap,
      text: fill(pick(PHRASES.overtake), {
        a: rider?.name ?? 'You',
        b: behind?.name ?? 'rival',
        pos: String(curPos),
      }),
      type: 'overtake',
    });
  }

  // Player crash
  if (!prev.crashed.has(player) && cur.crashed.has(player)) {
    const rider = cur.riders.find((r) => r.id === player);
    events.push({
      lap: cur.lap,
      text: fill(pick(PHRASES.crash), { a: rider?.name ?? 'You' }),
      type: 'crash',
    });
  }

  // Any rider crash
  for (const rid of cur.crashed) {
    if (!prev.crashed.has(rid)) {
      const rider = cur.riders.find((r) => r.id === rid);
      if (rid !== player && rider) {
        events.push({
          lap: cur.lap,
          text: fill(pick(PHRASES.crash), { a: rider.name }),
          type: 'crash',
        });
      }
    }
  }

  // Lead change
  const prevLeader = [...prev.positions.entries()].sort((a, b) => a[1] - b[1])[0];
  const curLeader = [...cur.positions.entries()].sort((a, b) => a[1] - b[1])[0];
  if (curLeader && prevLeader && curLeader[0] !== prevLeader[0]) {
    const leader = cur.riders.find((r) => r.id === curLeader[0]);
    events.push({
      lap: cur.lap,
      text: fill(pick(PHRASES.lead_change), { a: leader?.name ?? 'Leader' }),
      type: 'lead_change',
    });
  }

  // Fastest lap
  if (cur.fastestLap && cur.fastestLap.id !== prev.fastestLap?.id) {
    const rider = cur.riders.find((r) => r.id === cur.fastestLap!.id!);
    events.push({
      lap: cur.lap,
      text: fill(pick(PHRASES.fastest_lap), {
        a: rider?.name ?? 'Leader',
        time: cur.fastestLap.time!,
      }),
      type: 'fastest_lap',
    });
  }

  // Battles: fire once when a gap closes under the threshold (crossing, not while inside).
  const BATTLE_GAP = 1.0;
  const riderAt = (s: RaceSnapshot, pos: number): string | undefined => {
    for (const [rid, p] of s.positions.entries()) if (p === pos) return rid;
    return undefined;
  };
  const battleStarted = (rid: string): boolean => {
    const prevGap = prev.gapAheadSec.get(rid);
    const curGap = cur.gapAheadSec.get(rid);
    return prevGap !== undefined && curGap !== undefined && prevGap >= BATTLE_GAP && curGap < BATTLE_GAP;
  };
  const emitted = new Set<string>();
  const emitBattle = (chaserId: string): void => {
    const pos = cur.positions.get(chaserId);
    if (!pos || pos <= 1 || cur.crashed.has(chaserId)) return;
    const targetId = riderAt(cur, pos - 1);
    if (!targetId || cur.crashed.has(targetId) || emitted.has(chaserId)) return;
    emitted.add(chaserId);
    const a = cur.riders.find((r) => r.id === chaserId)?.name ?? 'Rider';
    const b = cur.riders.find((r) => r.id === targetId)?.name ?? 'rival';
    const gap = (cur.gapAheadSec.get(chaserId) ?? 0).toFixed(1);
    events.push({ lap: cur.lap, text: fill(pick(PHRASES.battle), { a, b, gap }), type: 'battle' });
  };
  if (battleStarted(player)) emitBattle(player);
  const p2 = riderAt(cur, 2);
  if (p2 && p2 !== player && battleStarted(p2)) emitBattle(p2); // battle for the lead

  // Tire warning for the player: once, when wear crosses 70%.
  const tireWear = cur.tireWear.get(player);
  const prevWear = prev.tireWear.get(player) ?? 0;
  if (tireWear !== undefined && tireWear > 70 && prevWear <= 70) {
    const rider = cur.riders.find((r) => r.id === player);
    events.push({
      lap: cur.lap,
      text: fill(pick(PHRASES.tire_warning), {
        a: rider?.name ?? 'You',
        wear: String(Math.round(tireWear)),
      }),
      type: 'tire',
    });
  }

  // Race finish
  if (cur.lap >= cur.totalLaps && cur.lap > prev.lap) {
    const winner = cur.riders.find((r) => {
      const pos = cur.positions.get(r.id);
      return pos === 1;
    });
    events.push({
      lap: cur.lap,
      text: fill(pick(PHRASES.finish), { a: winner?.name ?? 'Winner' }),
      type: 'finish',
    });
  }

  return events;
}
