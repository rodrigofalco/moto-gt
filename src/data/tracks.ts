import type { Track } from '../core/types';

export const TRACK_BANK: readonly Track[] = [
  { id: 'mugello',     name: 'Mugello Circuit',  location: 'Italy',     technicality: 0.45 },
  { id: 'assen',       name: 'TT Assen',         location: 'Netherlands', technicality: 0.70 },
  { id: 'phillip',     name: 'Phillip Island',   location: 'Australia', technicality: 0.65 },
  { id: 'jerez',       name: 'Circuito de Jerez',location: 'Spain',     technicality: 0.80 },
  { id: 'sachsenring', name: 'Sachsenring',      location: 'Germany',   technicality: 0.85 },
  { id: 'silverstone', name: 'Silverstone',      location: 'UK',        technicality: 0.55 },
  { id: 'm8',          name: 'Red Bull Ring',    location: 'Austria',   technicality: 0.25 },
  { id: 'm9',          name: 'Termas Rio Hondo', location: 'Argentina', technicality: 0.20 },
];
