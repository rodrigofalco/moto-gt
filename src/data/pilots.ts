import type { PilotArchetype } from '../core/types';

export const PILOT_ROSTER: readonly PilotArchetype[] = [
  { id: 'rossi',   name: 'Marco Rossi',    nickname: 'The Rocket',          skills: { pace: 9, cornering: 5, consistency: 5 } },
  { id: 'bianchi', name: 'Luca Bianchi',   nickname: 'The Surgeon',         skills: { pace: 5, cornering: 9, consistency: 6 } },
  { id: 'larsson', name: 'Sven Larsson',   nickname: 'The Metronome',       skills: { pace: 6, cornering: 6, consistency: 9 } },
  { id: 'marquez', name: 'Diego Marquez',  nickname: 'The All-Rounder',     skills: { pace: 7, cornering: 7, consistency: 6 } },
  { id: 'tanaka',  name: 'Yuki Tanaka',    nickname: 'The Hotshot',         skills: { pace: 8, cornering: 7, consistency: 3 } },
  { id: 'lindqvist', name: 'Sara Lindqvist', nickname: 'The Smooth Operator', skills: { pace: 6, cornering: 8, consistency: 7 } },
];
