export type Setup = 'topSpeed' | 'handling' | 'acceleration';
export type Risk = 'low' | 'medium' | 'high';

export interface PilotSkills { pace: number; cornering: number; consistency: number; } // 1..10
export interface BikeParams { speed: number; handling: number; acceleration: number; } // 1..10

export interface PilotArchetype { id: string; name: string; nickname: string; skills: PilotSkills; }
export interface Brand { id: string; name: string; params: BikeParams; }

export interface TrackWeights { speed: number; cornering: number; acceleration: number; } // sum = 1
export interface Track { id: string; name: string; location: string; weights: TrackWeights; }

export interface Rider {
  id: string;
  name: string;
  team: string;
  isPlayer: boolean;
  skills: PilotSkills;       // evolves automatically (pilot XP)
  bike: BikeParams;          // evolves via R&D investment
  pilotXp: number;           // accumulated XP toward auto level-ups
  rndPoints: number;         // unspent bike development points
  points: number;
  positionCounts: number[];  // length 10, countback tiebreak
}

export interface RaceEntry {
  rider: Rider;
  position: number;          // 1..10
  pointsAwarded: number;
  setup: Setup;
  risk: Risk;
  crashed: boolean;
  performanceScore: number;
}

export interface RaceResult {
  raceIndex: number;         // 0..5
  track: Track;
  finishingOrder: RaceEntry[];
}

export interface SeasonState {
  playerRider: Rider;
  aiRiders: Rider[];         // 9
  calendar: Track[];         // 6
  currentRaceIndex: number;  // 0..6
  raceResults: RaceResult[];
  isSeasonComplete: boolean;
}
