// Phase B: the race is now resolved lap-by-lap in RaceEngine. This re-export keeps
// existing imports of `simulateRace` (tests, harness) working unchanged.
export { simulateRace } from './RaceEngine';
