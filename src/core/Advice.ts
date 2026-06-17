import type { Setup, TrackWeights } from './types';

// speed→topSpeed, cornering→handling, acceleration→acceleration.
// `>=` precedence makes ties deterministic (topSpeed, then handling).
export function recommendedSetup(w: TrackWeights): Setup {
  if (w.speed >= w.cornering && w.speed >= w.acceleration) return 'topSpeed';
  if (w.cornering >= w.acceleration) return 'handling';
  return 'acceleration';
}

// racesLeft = calendar.length - currentRaceIndex (after this race is recorded).
export function resultHeadline(
  position: number, crashed: boolean, champPosition: number, racesLeft: number,
): string {
  let head: string;
  if (crashed) head = `Crashed out — finished P${position}.`;
  else if (position === 1) head = 'WIN! 🏆';
  else if (position <= 3) head = `Podium! P${position}.`;
  else if (position <= 10) head = `P${position} — points scored.`;
  else head = `P${position}.`;
  if (racesLeft <= 2) head += ` You're P${champPosition} in the title race.`;
  return head;
}
