import type { Track } from '../core/types';

// Each track has a distinct axis character. The calendar is tilted mildly
// toward cornering (~0.36 avg vs ~0.32 speed / ~0.32 acceleration) to partially
// offset `pace` being double-dipped in `baseAxes` (pace feeds both the speed AND
// acceleration axes, while cornering feeds only one), which otherwise lets
// pace-heavy pilots dominate and cornering-heavy pilots collapse — see
// tests/sweep.test.ts. The tilt is kept small enough that the three reference
// builds in tests/balance.test.ts stay co-equal (spread <= 0.15). Track
// identities and each track's crashy/non-crashy classification (cornering > 0.30)
// are preserved.
export const TRACK_BANK: readonly Track[] = [
  { id: 'mugello',     name: 'Mugello Circuit',   location: 'Italy',     weights: { speed: 0.54, cornering: 0.26, acceleration: 0.20 } }, // power
  { id: 'sachsenring', name: 'Sachsenring',       location: 'Germany',   weights: { speed: 0.18, cornering: 0.58, acceleration: 0.24 } }, // technical
  { id: 'redbull',     name: 'Red Bull Ring',     location: 'Austria',   weights: { speed: 0.24, cornering: 0.22, acceleration: 0.54 } }, // stop-go
  { id: 'phillip',     name: 'Phillip Island',    location: 'Australia', weights: { speed: 0.42, cornering: 0.43, acceleration: 0.15 } }, // fast-flowing
  { id: 'jerez',       name: 'Circuito de Jerez', location: 'Spain',     weights: { speed: 0.14, cornering: 0.43, acceleration: 0.43 } }, // drive-technical
  { id: 'silverstone', name: 'Silverstone',       location: 'UK',        weights: { speed: 0.38, cornering: 0.24, acceleration: 0.38 } }, // mixed
];
