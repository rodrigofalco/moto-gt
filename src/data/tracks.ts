import type { Track } from '../core/types';

// Each track has a distinct axis character, but the 6-track season averages
// ~0.333 per axis (speed/cornering/acceleration each sum to 2.0), so no build
// type is systematically favored by the calendar.
export const TRACK_BANK: readonly Track[] = [
  { id: 'mugello',     name: 'Mugello Circuit',   location: 'Italy',     weights: { speed: 0.55, cornering: 0.25, acceleration: 0.20 } }, // power
  { id: 'sachsenring', name: 'Sachsenring',       location: 'Germany',   weights: { speed: 0.20, cornering: 0.55, acceleration: 0.25 } }, // technical
  { id: 'redbull',     name: 'Red Bull Ring',     location: 'Austria',   weights: { speed: 0.25, cornering: 0.20, acceleration: 0.55 } }, // stop-go
  { id: 'phillip',     name: 'Phillip Island',    location: 'Australia', weights: { speed: 0.45, cornering: 0.40, acceleration: 0.15 } }, // fast-flowing
  { id: 'jerez',       name: 'Circuito de Jerez', location: 'Spain',     weights: { speed: 0.15, cornering: 0.40, acceleration: 0.45 } }, // drive-technical
  { id: 'silverstone', name: 'Silverstone',       location: 'UK',        weights: { speed: 0.40, cornering: 0.20, acceleration: 0.40 } }, // mixed
];
