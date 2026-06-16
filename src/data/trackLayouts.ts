import type { Point } from '../core/Path';

export interface TrackLayout { id: string; points: Point[]; }

export const TRACK_LAYOUTS: Record<string, TrackLayout> = {
  // Mugello — long flowing right-sweeper with a kink
  mugello: { id: 'mugello', points: [
    { x: 0.10, y: 0.55 }, { x: 0.20, y: 0.25 }, { x: 0.45, y: 0.18 }, { x: 0.62, y: 0.30 },
    { x: 0.70, y: 0.20 }, { x: 0.86, y: 0.32 }, { x: 0.88, y: 0.60 }, { x: 0.68, y: 0.78 },
    { x: 0.40, y: 0.82 }, { x: 0.18, y: 0.76 },
  ] },
  // Sachsenring — tight, twisty (many close corners)
  sachsenring: { id: 'sachsenring', points: [
    { x: 0.15, y: 0.50 }, { x: 0.22, y: 0.30 }, { x: 0.34, y: 0.36 }, { x: 0.40, y: 0.20 },
    { x: 0.54, y: 0.24 }, { x: 0.56, y: 0.42 }, { x: 0.72, y: 0.30 }, { x: 0.84, y: 0.46 },
    { x: 0.76, y: 0.66 }, { x: 0.58, y: 0.62 }, { x: 0.46, y: 0.78 }, { x: 0.28, y: 0.72 },
  ] },
  // Red Bull Ring — few corners, long straights
  redbull: { id: 'redbull', points: [
    { x: 0.12, y: 0.62 }, { x: 0.30, y: 0.22 }, { x: 0.46, y: 0.26 }, { x: 0.52, y: 0.40 },
    { x: 0.84, y: 0.24 }, { x: 0.90, y: 0.52 }, { x: 0.60, y: 0.80 }, { x: 0.24, y: 0.82 },
  ] },
  // Phillip Island — fast flowing ellipse
  phillip: { id: 'phillip', points: [
    { x: 0.16, y: 0.50 }, { x: 0.30, y: 0.24 }, { x: 0.56, y: 0.18 }, { x: 0.80, y: 0.28 },
    { x: 0.88, y: 0.50 }, { x: 0.80, y: 0.72 }, { x: 0.54, y: 0.82 }, { x: 0.28, y: 0.74 },
  ] },
  // Jerez — stadium loop with a tight final sector
  jerez: { id: 'jerez', points: [
    { x: 0.14, y: 0.46 }, { x: 0.26, y: 0.24 }, { x: 0.50, y: 0.20 }, { x: 0.74, y: 0.26 },
    { x: 0.86, y: 0.46 }, { x: 0.72, y: 0.58 }, { x: 0.78, y: 0.74 }, { x: 0.58, y: 0.80 },
    { x: 0.50, y: 0.66 }, { x: 0.34, y: 0.78 }, { x: 0.20, y: 0.66 },
  ] },
  // Silverstone — complex, two lobes
  silverstone: { id: 'silverstone', points: [
    { x: 0.12, y: 0.52 }, { x: 0.24, y: 0.30 }, { x: 0.42, y: 0.34 }, { x: 0.48, y: 0.18 },
    { x: 0.64, y: 0.22 }, { x: 0.62, y: 0.40 }, { x: 0.82, y: 0.34 }, { x: 0.90, y: 0.54 },
    { x: 0.74, y: 0.70 }, { x: 0.54, y: 0.64 }, { x: 0.44, y: 0.80 }, { x: 0.24, y: 0.74 },
  ] },
};
