export type Setup = 'topSpeed' | 'handling' | 'acceleration';
export type Risk = 'low' | 'medium' | 'high';
export type Weather = 'dry' | 'wet';
export type TireCompound = 'soft' | 'medium' | 'hard';

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
  brandId: string;            // bike brand (drives race-day dot color)
  age: number;                // incremented each off-season
  skills: PilotSkills;        // evolves automatically (pilot XP)
  bike: BikeParams;           // evolves via R&D investment
  pilotXp: number;            // accumulated XP toward auto level-ups
  rndPoints: number;          // unspent bike development points
  points: number;
  positionCounts: number[];   // length 10, countback tiebreak
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
  aiRiders: Rider[];          // 9
  calendar: Track[];          // 6
  currentRaceIndex: number;   // 0..6
  raceResults: RaceResult[];
  isSeasonComplete: boolean;
  lastRisk?: Risk;            // player's last-used in-race order, carried between races
  weatherByRace?: Weather[];  // per-race weather, seeded by RNG
  lastCompound?: TireCompound;  // player tire compound, carried
}

export interface LapSnapshot {
  lap: number;
  entries: { riderId: string; progress: number; crashed: boolean }[];
}

export interface RaceTimeline {
  laps: LapSnapshot[];
  totalLaps: number;
}

export interface OffSeasonReport {
  previousSeason: number;
  playerFinish: number;
  champion: string;
  promoted: boolean;
  retired: string[];
  rookies: string[];
  statChanges: { riderId: string; note: string }[];
}

export interface Tier {
  id: string;
  name: string;
  aiStatBonus: number;
  order: number;
}

export interface CareerState {
  version: number;
  team: string;
  pilotArchetypeId: string;
  brandId: string;
  tierId: string;
  seasonNumber: number;
  money: number;
  reputation: number;
  player: Rider;
  field: Rider[];
  season: SeasonState | null;
}

export interface QualifyingResult {
  gridOrder: string[];  // riderId array, fastest first
}

// Tire params
export interface TireParams {
  compound: TireCompound;
  wear: number;         // 0-100
  grip: number;         // effective grip multiplier
}

// Commentary
export type CommentaryType = 'overtake' | 'crash' | 'lead_change' | 'fastest_lap' | 'gap' | 'start' | 'finish' | 'battle' | 'tire';

export interface CommentaryEvent {
  lap: number;
  text: string;
  type: CommentaryType;
}

export interface RaceSnapshot {
  lap: number;
  totalLaps: number;
  positions: Map<string, number>;
  riders: Array<{ id: string; name: string }>;
  crashed: Set<string>;
  fastestLap: { id: string; time: string } | null;
  tireWear: Map<string, number>;
  overtookBy: Map<string, string>;
  overtakeBy: Map<string, string>;
  gapAheadSec: Map<string, number>;   // race-fiction seconds to the rider directly ahead
}

// Career continuation
export interface SeasonLoadData extends SeasonState {
  _savedAt?: number;
  _careerStats?: Record<string, number>;
}
