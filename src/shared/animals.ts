import type { Animal } from './types';

// Emoji stand in for the 3D animals in lists and buttons.
export const ANIMAL_EMOJI: Record<Animal, string> = {
  dog: '🐶',
  cat: '🐱',
  panda: '🐼',
  koala: '🐨',
  turtle: '🐢',
  duck: '🦆',
};

export const ANIMAL_LABEL: Record<Animal, string> = {
  dog: 'Dog',
  cat: 'Cat',
  panda: 'Panda',
  koala: 'Koala',
  turtle: 'Turtle',
  duck: 'Duck',
};

/** Scarf colours on offer in the avatar creator. */
export const AVATAR_COLORS: { name: string; hex: string }[] = [
  { name: 'Pink', hex: '#ff8fab' },
  { name: 'Peach', hex: '#ffb38a' },
  { name: 'Butter', hex: '#ffd166' },
  { name: 'Mint', hex: '#7fd8be' },
  { name: 'Sky', hex: '#7cc6fe' },
  { name: 'Lavender', hex: '#b8a1ff' },
  { name: 'Red', hex: '#e63946' },
  { name: 'Navy', hex: '#3d5a80' },
];
