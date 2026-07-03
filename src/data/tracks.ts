import type { Track } from '../core/types';

// Each track has a distinct axis character. The calendar is balanced
// (~0.32 speed / ~0.36 cornering / ~0.32 acceleration) to give each pilot
// build a fair shot across the season. The `baseAxes` blend in
// PerformanceModel.ts (70/30 pace/cornering for acceleration) ensures that
// pace and cornering contribute equally to overall performance, so no single
// stat dominates. Track identities and each track's crashy/non-crashy
// classification (cornering > 0.30) are preserved.
export const TRACK_BANK: readonly Track[] = [
  { id: 'mugello',     name: 'Mugello Circuit',   location: 'Italy',     weights: { speed: 0.54, cornering: 0.26, acceleration: 0.20 } }, // power
  { id: 'sachsenring', name: 'Sachsenring',       location: 'Germany',   weights: { speed: 0.18, cornering: 0.58, acceleration: 0.24 } }, // technical
  { id: 'redbull',     name: 'Red Bull Ring',     location: 'Austria',   weights: { speed: 0.24, cornering: 0.22, acceleration: 0.54 } }, // stop-go
  { id: 'phillip',     name: 'Phillip Island',    location: 'Australia', weights: { speed: 0.42, cornering: 0.43, acceleration: 0.15 } }, // fast-flowing
  { id: 'jerez',       name: 'Circuito de Jerez', location: 'Spain',     weights: { speed: 0.14, cornering: 0.43, acceleration: 0.43 } }, // drive-technical
  { id: 'silverstone', name: 'Silverstone',       location: 'UK',        weights: { speed: 0.38, cornering: 0.24, acceleration: 0.38 } }, // mixed
];
