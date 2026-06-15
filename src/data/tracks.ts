import type { Track } from '../core/types';

export const TRACK_BANK: readonly Track[] = [
  { id: 'mugello',     name: 'Mugello Circuit',  location: 'Italy',     weights: { speed: 0.50, cornering: 0.30, acceleration: 0.20 } },
  { id: 'sachsenring', name: 'Sachsenring',      location: 'Germany',   weights: { speed: 0.20, cornering: 0.60, acceleration: 0.20 } },
  { id: 'redbull',     name: 'Red Bull Ring',    location: 'Austria',   weights: { speed: 0.30, cornering: 0.25, acceleration: 0.45 } },
  { id: 'phillip',     name: 'Phillip Island',   location: 'Australia', weights: { speed: 0.40, cornering: 0.45, acceleration: 0.15 } },
  { id: 'jerez',       name: 'Circuito de Jerez', location: 'Spain',    weights: { speed: 0.20, cornering: 0.45, acceleration: 0.35 } },
  { id: 'silverstone', name: 'Silverstone',      location: 'UK',        weights: { speed: 0.35, cornering: 0.40, acceleration: 0.25 } },
];
