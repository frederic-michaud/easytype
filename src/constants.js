export const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'é'],
  ['y', 'x', 'c', 'v', 'b', 'n', 'm'],
];

export const BUMP_KEYS = new Set(['f', 'j']);

export const VOWELS = new Set([...'aeiouyéèêëàâùûôî']);

export const STARS = Array.from({ length: 130 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  s: [1, 1, 1, 2, 3][Math.floor(Math.random() * 5)],
  baseOp: 0.2 + Math.random() * 0.8,
  dur: 1.5 + Math.random() * 4,
}));
