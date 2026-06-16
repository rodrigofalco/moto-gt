import type { Brand } from '../core/types';

// All brands sum to 21 param points — distinct identities, equal overall strength.
export const BRAND_ROSTER: readonly Brand[] = [
  { id: 'velocita', name: 'Velocita', params: { speed: 9, handling: 6, acceleration: 6 } },
  { id: 'apex',     name: 'Apex',     params: { speed: 6, handling: 9, acceleration: 6 } },
  { id: 'titan',    name: 'Titan',    params: { speed: 7, handling: 7, acceleration: 7 } },
  { id: 'vortex',   name: 'Vortex',   params: { speed: 6, handling: 6, acceleration: 9 } },
];
