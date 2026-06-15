export type RidingStyle = 'safe' | 'balanced' | 'aggressive';

export interface RiderStats {
  pace: number;        // 1..10 — raw speed
  cornering: number;   // 1..10 — technical speed
  consistency: number; // 1..10 — error resistance only
}

export interface Rider {
  id: string;
  name: string;
  team: string;
  isPlayer: boolean;
  stats: RiderStats;
  points: number;
  positionCounts: number[]; // length 10: [#P1..#P10]
}

export interface Track {
  id: string;
  name: string;
  location: string;
  technicality: number; // 0..1
}

export interface FinishingPosition {
  position: number;      // 1..10
  rider: Rider;
  pointsAwarded: number;
  performanceScore: number;
  hadMistake: boolean;
}

export interface RaceResult {
  raceIndex: number;     // 0..5
  track: Track;
  playerStyle: RidingStyle;
  finishingOrder: FinishingPosition[];
}

export interface SeasonState {
  playerRider: Rider;
  aiRiders: Rider[];     // 9
  calendar: Track[];     // 6
  currentRaceIndex: number; // 0..6
  raceResults: RaceResult[];
  isSeasonComplete: boolean;
}
