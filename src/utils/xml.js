import { VOWELS } from '../constants';

function genPseudo(A, B, count = 40) {
  const Al = [...A], Bl = [...B];
  const vowels = Al.filter(c => VOWELS.has(c));
  const cons = Al.filter(c => !VOWELS.has(c));
  const result = new Set();
  let att = 0;
  while (result.size < count && att++ < 50000) {
    const len = 3 + Math.floor(Math.random() * 3);
    const word = [];
    let hasB = false;
    for (let p = 0; p < len; p++) {
      let pool = (vowels.length && cons.length) ? (p % 2 === 1 ? vowels : cons) : Al;
      if (p === len - 1 && !hasB) {
        const bp = pool.filter(c => B.has(c));
        if (bp.length) pool = bp;
        else if (Bl.length) pool = Bl;
      }
      const c = pool[Math.floor(Math.random() * pool.length)];
      if (B.has(c)) hasB = true;
      word.push(c);
    }
    const w = word.join('');
    if (hasB && new Set(w).size >= 2) result.add(w);
  }
  return [...result];
}

export function parseXML(text) {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  if (doc.querySelector('parsererror'))
    throw new Error('XML malformé — vérifie le fichier');

  const levels = [];
  for (const f of doc.querySelectorAll('filter')) {
    const parseChars = sel =>
      new Set((f.querySelector(sel)?.textContent || '').split(/\s+/).filter(c => c.length === 1));
    const A = parseChars('allowed_chars');
    const B = parseChars('required_chars');

    const name = f.getAttribute('level_name') || `Niveau ${f.getAttribute('index')}`;
    const minPct = parseFloat(f.getAttribute('min_score_pct') || '0.5');
    const ms = parseInt(f.getAttribute('mission_size') || '8', 10);

    const realWords = [...f.querySelectorAll('matches > word')].map(w => w.textContent.trim()).filter(Boolean);
    const pseudoWords = [...f.querySelectorAll('pseudo_words > word')].map(w => w.textContent.trim()).filter(Boolean);
    const words = realWords.length > 0 ? [...realWords, ...pseudoWords] : pseudoWords;

    if (words.length === 0) words.push(...genPseudo(A, B, 40));

    levels.push({ name, newKeys: B, chars: A, minPct, ms, words });
  }
  if (levels.length === 0) throw new Error('Aucun niveau <filter> trouvé');
  return levels;
}

export function pickWords(level) {
  const real = level.words.filter(w =>
    [...w].every(c => level.chars.has(c)) && [...w].some(c => level.newKeys.has(c))
  );
  const pseudo = level.words.filter(w => !real.includes(w));
  const pool = [
    ...real.sort(() => Math.random() - .5),
    ...pseudo.sort(() => Math.random() - .5),
  ];
  while (pool.length < level.ms) pool.push(...pool.slice(0, level.ms - pool.length));
  return pool.slice(0, level.ms);
}
