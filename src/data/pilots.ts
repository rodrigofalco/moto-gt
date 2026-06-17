import type { PilotArchetype } from '../core/types';

// All pilots sum to 20 skill points — distinct identities, equal overall strength.
export const PILOT_ROSTER: readonly PilotArchetype[] = [
  { id: 'rossi',     name: 'Marco Rossi',    nickname: 'The Rocket',          skills: { pace: 9, cornering: 5, consistency: 6 } },
  { id: 'bianchi',   name: 'Luca Bianchi',   nickname: 'The Surgeon',         skills: { pace: 5, cornering: 9, consistency: 6 } },
  { id: 'larsson',   name: 'Sven Larsson',   nickname: 'The Metronome',       skills: { pace: 6, cornering: 5, consistency: 9 } },
  { id: 'marquez',   name: 'Diego Marquez',  nickname: 'The All-Rounder',     skills: { pace: 7, cornering: 7, consistency: 6 } },
  { id: 'tanaka',    name: 'Yuki Tanaka',    nickname: 'The Hotshot',         skills: { pace: 9, cornering: 8, consistency: 3 } },
  { id: 'lindqvist', name: 'Sara Lindqvist', nickname: 'The Smooth Operator', skills: { pace: 5, cornering: 8, consistency: 7 } },
  { id: 'moretti',   name: 'Alessandro Moretti',   nickname: 'The Apex Predator',     skills: { pace: 8, cornering: 7, consistency: 5 } },
  { id: 'vikander',  name: 'Erik Vikander',        nickname: 'The Ice Rider',         skills: { pace: 4, cornering: 6, consistency: 10 } },
  { id: 'costa',     name: 'Rafael Costa',         nickname: 'The Rain Master',       skills: { pace: 7, cornering: 9, consistency: 4 } },
  { id: 'duval',     name: 'Pierre Duval',         nickname: 'The Tilt King',         skills: { pace: 6, cornering: 10, consistency: 4 } },
  { id: 'nakamura',  name: 'Hiro Nakamura',        nickname: 'The Drift Prince',      skills: { pace: 10, cornering: 4, consistency: 6 } },
  { id: 'fuentes',   name: 'Mateo Fuentes',        nickname: 'The Closer',          skills: { pace: 6, cornering: 6, consistency: 8 } },
  { id: 'johansson', name: 'Astrid Johansson',     nickname: 'The Viking Fury',       skills: { pace: 8, cornering: 4, consistency: 8 } },
  { id: 'pavlov',    name: 'Dimitri Pavlov',       nickname: 'The Wall Rider',      skills: { pace: 5, cornering: 7, consistency: 8 } },
  { id: 'silva',     name: 'Bruno Silva',          nickname: 'The Late Braker',     skills: { pace: 7, cornering: 6, consistency: 7 } },
  { id: 'watanabe',  name: 'Mei Watanabe',         nickname: 'The Phantom',         skills: { pace: 8, cornering: 5, consistency: 7 } },
  { id: 'romero',    name: 'Carlos Romero',        nickname: 'The Slide King',      skills: { pace: 6, cornering: 8, consistency: 6 } },
  { id: 'bekker',    name: 'Johan Bekker',         nickname: 'The Tank',            skills: { pace: 5, cornering: 5, consistency: 10 } },
];

// Extra distinct names for AI riders beyond the non-player archetypes,
// so no AI rider shares a name (they borrow an archetype's skills but get their own identity).
export const AI_EXTRA_NAMES: readonly string[] = [
  'Otto Nilsson', 'Rafa Mendes', 'Kai Brenner', 'Tom Halloran',
  'Nico Fontana', 'Ivan Petrov', 'Leo Castille', 'Max Dunne',
  'Felix Moreau', 'Sam Okafor', 'Liam O\'Brien', 'Yusuf Kaya',
  'Dante Moreau', 'Kofi Asante', 'Remy Delacroix',
];
