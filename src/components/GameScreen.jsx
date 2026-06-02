import { useState, useEffect, useCallback, useRef } from 'react';
import StarField from './StarField';
import Rocket from './Rocket';
import { KEYBOARD_ROWS, BUMP_KEYS } from '../constants';
import { pickWords } from '../utils/xml';
import { saveCookie } from '../utils/cookie';
import { getCtx, sfxCorrect, sfxWrong, sfxWordDone, sfxLaunch, sfxCrash, startAmbient } from '../utils/audio';

function calcStars(cpm, accuracy) {
  if (cpm >= 150 && accuracy >= 85) return 3;
  if (cpm >= 100 && accuracy >= 75) return 2;
  return 1;
}

export default function GameScreen({ levels, save: initialSave, initialLvIdx, onSaveUpdate, onBack }) {
  const audioRef = useRef(null), ambientRef = useRef(null), mutedRef = useRef(false);
  const wordFirstCharTimeRef = useRef(null);
  const activeTypingMsRef = useRef(0);
  const totalCharsRef = useRef(0);
  const totalKeystrokesRef = useRef(0);
  const charErrorsRef = useRef({});
  const [muted, setMuted] = useState(false);
  const [currentSave, setCurrentSave] = useState(initialSave);
  const [finalStats, setFinalStats] = useState(null);

  const [lvIdx, setLvIdx] = useState(initialLvIdx);
  const [phase, setPhase] = useState('playing');
  const [words, setWords] = useState(() => pickWords(levels[initialLvIdx]));
  const [wordIdx, setWordIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [wrong, setWrong] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [starBright, setStarBright] = useState(50);
  const [sparks, setSparks] = useState([]);

  function startLevel(i) {
    const lv = levels[i];
    setLvIdx(i); setWords(pickWords(lv));
    setWordIdx(0); setTyped(''); setPhase('playing');
    setStarBright(50);
    setSparks([]); setCelebrate(false); setWrong(false);
    wordFirstCharTimeRef.current = null;
    activeTypingMsRef.current = 0;
    totalCharsRef.current = 0;
    totalKeystrokesRef.current = 0;
    charErrorsRef.current = {};
    setFinalStats(null);
  }

  const handleLevelEnd = useCallback((passed, cpm, accuracy) => {
    setCurrentSave(prev => {
      const newUnlocked = passed
        ? Math.max(prev.unlocked, Math.min(lvIdx + 1, levels.length - 1))
        : prev.unlocked;
      const levelKey = levels[lvIdx].name;
      const prevEntry = prev.bestScores?.[levelKey];
      const stars = calcStars(cpm, accuracy);
      const newEntry = !prevEntry || cpm > prevEntry.cpm
        ? { cpm, accuracy, stars }
        : { ...prevEntry, stars: Math.max(prevEntry.stars || 0, stars) };
      const prevAttempts = prev.attempts?.[levelKey] || [];
      const updated = {
        ...prev,
        unlocked: newUnlocked,
        bestScores: { ...(prev.bestScores || {}), [levelKey]: newEntry },
        attempts: { ...(prev.attempts || {}), [levelKey]: [...prevAttempts, { cpm, acc: accuracy }].slice(-20) },
      };
      saveCookie(updated);
      onSaveUpdate(updated);
      return updated;
    });
  }, [lvIdx, levels, onSaveUpdate]);

  const level = levels[lvIdx];
  const currentWord = words[wordIdx] || '';
  const nextChar = currentWord[typed.length] || '';
  const progress = (wordIdx + typed.length / (currentWord.length || 1)) / (level.ms || 8) * 100;
  const brightMult = Math.max(0.08, starBright / 100);

  function snd(fn) { if (!mutedRef.current) fn(getCtx(audioRef)); }
  function toggleMute() {
    const m = !muted;
    mutedRef.current = m;
    setMuted(m);
    if (ambientRef.current) ambientRef.current.master.gain.value = m ? 0 : 0.032;
  }

  const handleKey = useCallback(e => {
    if (phase !== 'playing' || celebrate) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : null;
    if (!k) return;

    if (!ambientRef.current && !mutedRef.current) ambientRef.current = startAmbient(getCtx(audioRef));

    if (k === nextChar) {
      snd(sfxCorrect);
      const now = Date.now();
      if (typed === '') wordFirstCharTimeRef.current = now;
      totalCharsRef.current += 1;
      totalKeystrokesRef.current += 1;
      const next = typed + k;
      setTyped(next);
      setStarBright(b => Math.min(100, b + 3));

      if (next === currentWord) {
        snd(sfxWordDone);
        activeTypingMsRef.current += now - (wordFirstCharTimeRef.current ?? now);
        wordFirstCharTimeRef.current = null;
        setCelebrate(true);
        setSparks(Array.from({ length: 14 }, (_, i) => ({
          id: Date.now() + i,
          a: (i / 14) * 360,
          c: i % 3 === 0 ? '#00e5ff' : i % 3 === 1 ? '#ffe600' : '#ff8c00',
        })));

        setTimeout(() => {
          setSparks([]); setCelebrate(false);
          if (wordIdx + 1 >= level.ms) {
            const activeMin = activeTypingMsRef.current / 60000;
            const cpm = activeMin > 0 ? Math.round(totalCharsRef.current / activeMin) : 0;
            const accuracy = totalKeystrokesRef.current > 0
              ? Math.round(totalCharsRef.current / totalKeystrokesRef.current * 100)
              : 100;
            const prevBest = currentSave.bestScores?.[level.name];
            const prevAttempts = currentSave.attempts?.[level.name] || [];
            const allAttempts = [...prevAttempts, { cpm, acc: accuracy }].slice(-20);
            setFinalStats({ cpm, accuracy, charErrors: { ...charErrorsRef.current }, prevBest, attempts: allAttempts });
            const passed = cpm >= 150 && accuracy >= 85;
            handleLevelEnd(passed, cpm, accuracy);
            setPhase(passed ? 'launching' : 'crashing');
            if (!mutedRef.current) (passed ? sfxLaunch : sfxCrash)(getCtx(audioRef));
            setTimeout(() => setPhase(passed ? 'passed' : 'failed'), passed ? 3200 : 4200);
          } else {
            setWordIdx(i => i + 1); setTyped('');
          }
        }, 700);
      }
    } else if (/[a-zàâéèêëîïôùûüÿæœç]/i.test(k)) {
      snd(sfxWrong);
      totalKeystrokesRef.current += 1;
      charErrorsRef.current[nextChar] = (charErrorsRef.current[nextChar] || 0) + 1;
      setWrong(true);
      setStarBright(b => Math.max(10, b - 6));
      setTimeout(() => setWrong(false), 290);
    }
  }, [phase, celebrate, nextChar, typed, currentWord, wordIdx, level.ms, handleLevelEnd, currentSave]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <>
      <div style={{
        width: '100%', minHeight: '100vh',
        background: 'linear-gradient(175deg,#020814 0%,#050b1c 55%,#080d22 100%)',
        fontFamily: "'Courier New',Courier,monospace", color: 'white',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '16px 12px', position: 'relative', overflow: 'hidden',
      }}>
        <StarField brightMult={brightMult} />

        {/* Launch / crash overlay */}
        {(phase === 'launching' || phase === 'crashing') && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'flex-end', paddingBottom: 80,
            background: 'radial-gradient(ellipse at bottom,#080e20,#020814)',
          }}>
            {phase === 'launching' && (
              <div style={{
                position: 'absolute', bottom: 50, width: 180, height: 30,
                background: 'radial-gradient(ellipse,#ff880088,transparent 70%)',
                animation: 'pulse .3s ease-in-out infinite',
              }} />
            )}
            <div style={{ animation: `${phase === 'launching' ? 'launch 2.9s cubic-bezier(.4,0,1,1)' : 'crash 3.9s ease-in-out'} forwards` }}>
              <Rocket power={phase === 'launching' ? 100 : 15} w={90} h={168} />
            </div>
            <div style={{
              position: 'absolute', bottom: 24,
              color: phase === 'launching' ? '#00e5ff' : '#ff7755',
              fontSize: 15, letterSpacing: 4, textTransform: 'uppercase',
              animation: 'pulse .45s ease-in-out infinite',
              textShadow: phase === 'launching' ? '0 0 20px #00e5ff' : '0 0 20px #ff4400',
            }}>
              {phase === 'launching' ? '🚀 Décollage !' : '⚠️ Puissance insuffisante...'}
            </div>
          </div>
        )}

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 660 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={onBack} style={{ background: '#080f1e', border: '1px solid #1a3050', borderRadius: 8, padding: '4px 10px', color: '#90b0d0', cursor: 'pointer', fontSize: 13 }}>
                ← Niveaux
              </button>
              <div style={{ color: '#00e5ff', fontSize: 14, fontWeight: 'bold', letterSpacing: 2 }}>{level.name}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {phase === 'playing' && (
                <button onClick={() => startLevel(lvIdx)} style={{ background: '#080f1e', border: '1px solid #1a3050', borderRadius: 8, padding: '4px 10px', color: '#90b0d0', cursor: 'pointer', fontSize: 13 }}>
                  ↺ Recommencer
                </button>
              )}
              <button onClick={toggleMute} style={{ background: '#080f1e', border: '1px solid #1a3050', borderRadius: 8, padding: '4px 10px', color: '#90b0d0', cursor: 'pointer', fontSize: 14 }}>
                {muted ? '🔇' : '🔊'}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ height: 7, background: '#060f1e', border: '1px solid #1a2e55', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(to right,#0033cc,#00e5ff)', transition: 'width .4s ease', boxShadow: '0 0 8px #00e5ff44' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12, color: '#7090b0', letterSpacing: 2, textTransform: 'uppercase' }}>
              <span>Départ</span><span>{wordIdx}/{level.ms}</span><span>🪐</span>
            </div>
          </div>

          {/* Passed result */}
          {phase === 'passed' && (
            <div style={{ textAlign: 'center', padding: '28px 16px', animation: 'fadeIn .7s ease-out forwards' }}>
              <div style={{ fontSize: 52, marginBottom: 8 }}>🎉🚀</div>
              {finalStats && <div style={{ marginBottom: 12 }}><StarsDisplay count={calcStars(finalStats.cpm, finalStats.accuracy)} size={32} /></div>}
              <div style={{ fontSize: 22, color: '#ffe600', fontWeight: 'bold', letterSpacing: 3, marginBottom: 20 }}>NIVEAU RÉUSSI !</div>
              {finalStats && <ResultLayout cpm={finalStats.cpm} accuracy={finalStats.accuracy} attempts={finalStats.attempts} prevBest={finalStats.prevBest} />}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20 }}>
                <button onClick={() => startLevel(lvIdx)} style={{ background: '#080f1e', color: '#a0c0e0', border: '1.5px solid #1a3050', borderRadius: 10, padding: '10px 20px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', letterSpacing: 2, textTransform: 'uppercase' }}>
                  🔁 Rejouer
                </button>
                <button onClick={onBack} style={{ background: 'linear-gradient(135deg,#0044dd,#00ccff)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', letterSpacing: 2, textTransform: 'uppercase', boxShadow: '0 0 20px #00e5ff44' }}>
                  📋 Niveaux
                </button>
                {lvIdx + 1 < levels.length && currentSave.unlocked > lvIdx && (
                  <button onClick={() => startLevel(lvIdx + 1)} style={{ background: 'linear-gradient(135deg,#00aa44,#00e5ff)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', letterSpacing: 2, textTransform: 'uppercase', boxShadow: '0 0 20px #00e5ff44' }}>
                    ⬆️ Suivant
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Failed result */}
          {phase === 'failed' && (
            <div style={{ textAlign: 'center', padding: '28px 16px', animation: 'fadeIn .7s ease-out forwards' }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>💥😅🔧</div>
              <div style={{ fontSize: 22, color: '#ff6644', fontWeight: 'bold', letterSpacing: 3, marginBottom: 14 }}>RETOUR AU SOL...</div>
              {finalStats && <ResultLayout cpm={finalStats.cpm} accuracy={finalStats.accuracy} attempts={finalStats.attempts} prevBest={finalStats.prevBest} />}
              {finalStats && <TipsList charErrors={finalStats.charErrors} cpm={finalStats.cpm} accuracy={finalStats.accuracy} />}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
                <button onClick={() => startLevel(lvIdx)} style={{ background: 'linear-gradient(135deg,#bb3300,#ff5500)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', letterSpacing: 2, textTransform: 'uppercase', boxShadow: '0 0 18px #ff440033' }}>
                  🔁 Réessayer
                </button>
                <button onClick={onBack} style={{ background: '#080f1e', color: '#a0c0e0', border: '1.5px solid #1a3050', borderRadius: 10, padding: '10px 20px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', letterSpacing: 2, textTransform: 'uppercase' }}>
                  📋 Niveaux
                </button>
              </div>
            </div>
          )}

          {/* Playing UI */}
          {phase === 'playing' && (
            <>
              {/* Current word */}
              <div style={{
                background: '#030e1c',
                border: `1.5px solid ${wrong ? '#ff444466' : celebrate ? '#00e5ff55' : '#142540'}`,
                borderRadius: 16, padding: '22px 14px', textAlign: 'center', marginBottom: 16,
                position: 'relative',
                boxShadow: wrong ? '0 0 18px #ff220022' : celebrate ? '0 0 18px #00e5ff22' : 'none',
                transition: 'border-color .2s,box-shadow .2s',
                animation: wrong ? 'shake .29s ease' : celebrate ? 'pop .5s ease' : 'none',
              }}>
                <div style={{ fontSize: 12, color: '#7090b0', letterSpacing: 3, marginBottom: 16, textTransform: 'uppercase' }}>
                  Mot {wordIdx + 1} / {level.ms}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {currentWord.split('').map((ch, i) => {
                    const done = i < typed.length, next = i === typed.length;
                    return (
                      <div key={i} style={{
                        width: 48, height: 58, borderRadius: 10,
                        border: `2px solid ${done ? '#00e5ff88' : next ? '#ffe60099' : '#142540'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 26, fontWeight: 'bold',
                        color: done ? '#00e5ff' : next ? '#ffe600' : '#5878a0',
                        background: done ? '#001a34' : next ? '#1a1400' : '#040e1a',
                        transition: 'all .12s ease',
                        boxShadow: next ? '0 0 14px #ffe60044' : done ? '0 0 6px #00e5ff22' : 'none',
                        animation: next ? 'pulse 1s ease-in-out infinite' : 'none',
                        textTransform: 'uppercase', userSelect: 'none',
                      }}>
                        {ch.toUpperCase()}
                      </div>
                    );
                  })}
                </div>
                {sparks.map(p => (
                  <div key={p.id} style={{
                    position: 'absolute', top: '50%', left: '50%',
                    width: 8, height: 8, borderRadius: '50%', background: p.c,
                    '--tx': `${Math.cos(p.a * Math.PI / 180) * 85}px`,
                    '--ty': `${Math.sin(p.a * Math.PI / 180) * 85}px`,
                    animation: 'spark .75s ease-out forwards', pointerEvents: 'none',
                  }} />
                ))}
                {wrong && (
                  <div style={{ position: 'absolute', bottom: 9, left: '50%', transform: 'translateX(-50%)', color: '#ff8888', fontSize: 13, letterSpacing: 1, whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                    ✗ Réessaie !
                  </div>
                )}
              </div>

              {/* QWERTZ keyboard */}
              <div style={{ background: '#030e1c', border: '1.5px solid #142540', borderRadius: 16, padding: '13px 10px' }}>
                {KEYBOARD_ROWS.map((row, ri) => (
                  <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: ri < 2 ? 7 : 0 }}>
                    {row.map(key => {
                      const isTarget = key === nextChar;
                      const isNew = level.newKeys.has(key);
                      const inLevel = level.chars.has(key);
                      const isBump = BUMP_KEYS.has(key);
                      return (
                        <div key={key} style={{
                          width: key === 'é' ? 47 : 43, height: 43, borderRadius: 8,
                          border: `1.5px solid ${isTarget ? '#ffe600' : isNew ? '#00aa55' : inLevel ? '#1c3858' : '#0a1622'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1,
                          fontSize: 14, fontWeight: 'bold',
                          color: isTarget ? '#1a1200' : isNew ? '#11ee77' : inLevel ? '#7090b0' : '#0e1a28',
                          background: isTarget ? '#ffe600' : isNew ? '#001a0e' : inLevel ? '#070d1a' : '#040810',
                          textTransform: 'uppercase', transition: 'all .12s ease',
                          animation: isTarget ? 'glowKey 1s ease-in-out infinite' : isNew ? 'glowNew 2s ease-in-out infinite' : 'none',
                          userSelect: 'none', position: 'relative', opacity: inLevel ? 1 : .35,
                        }}>
                          {key}
                          {isBump && (
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: isTarget ? '#1a1200' : '#5a78a0', position: 'absolute', bottom: 4 }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12, fontSize: 12, color: '#90b0d0', letterSpacing: 1, flexWrap: 'wrap' }}>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#00aa55', marginRight: 5, verticalAlign: 'middle' }} />Nouvelles touches</span>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#1c3858', marginRight: 5, verticalAlign: 'middle' }} />Déjà apprises</span>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#ffe600', marginRight: 5, verticalAlign: 'middle' }} />Prochaine touche</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function zoneColor(v, target, mid) {
  if (v >= target) return '#11dd77';
  if (v >= mid)    return '#ffcc00';
  if (v >= mid * 0.7) return '#ff9900';
  return '#ff5533';
}

function MiniBarChart({ values: allValues, yMax, target, mid, label, unit }) {
  const values = allValues.slice(-10);
  const H = 100;
  const YW = 36;
  const BW = 14;
  const BG = 4;
  const ticks = [];
  const step = yMax <= 100 ? 25 : 50;
  for (let v = 0; v <= yMax; v += step) ticks.push(v);
  if (!ticks.includes(target)) ticks.push(target);
  ticks.sort((a, b) => a - b);

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, color: '#a0c0d8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, fontWeight: 'bold' }}>
        {label}
      </div>
      <div style={{ display: 'flex' }}>
        {/* Y axis labels */}
        <div style={{ width: YW, position: 'relative', height: H, flexShrink: 0 }}>
          {ticks.map(v => (
            <div key={v} style={{
              position: 'absolute',
              bottom: `${Math.min(98, (v / yMax) * 100)}%`,
              right: 5, fontSize: 11,
              color: v === target ? '#11dd77' : '#7090b0',
              fontWeight: v === target ? 'bold' : 'normal',
              transform: 'translateY(50%)',
            }}>
              {v}
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div style={{ flex: 1, position: 'relative', height: H, borderLeft: '2px solid #1a2e55', borderBottom: '2px solid #1a2e55', overflow: 'visible' }}>
          {/* Grid lines (behind bars) */}
          {ticks.filter(v => v > 0).map(v => (
            <div key={v} style={{
              position: 'absolute',
              bottom: `${Math.min(100, (v / yMax) * 100)}%`,
              left: 0, right: 0,
              borderTop: v === target ? '1.5px dashed #009944aa' : '1px solid #0d1c2e',
              zIndex: 0,
            }} />
          ))}

          {/* Bars - fixed width, left aligned, above grid */}
          <div style={{ position: 'absolute', inset: '0 0 0 4px', display: 'flex', alignItems: 'flex-end', gap: BG, zIndex: 1 }}>
            {values.map((v, i) => {
              const isLast = i === values.length - 1;
              const hPct = Math.max(1.5, Math.min(100, (v / yMax) * 100));
              const col = zoneColor(v, target, mid);
              return (
                <div key={i} style={{
                  width: BW, flexShrink: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'flex-end', height: '100%',
                }}>
                  {isLast && (
                    <div style={{
                      fontSize: 12, color: col, fontWeight: 'bold',
                      marginBottom: 2, whiteSpace: 'nowrap',
                      textShadow: `0 0 8px ${col}aa`,
                    }}>
                      {v}{unit}
                    </div>
                  )}
                  <div style={{
                    width: '100%', height: `${hPct}%`, minHeight: 3,
                    background: col,
                    borderRadius: '2px 2px 0 0',
                    boxShadow: isLast ? `0 0 12px ${col}cc` : 'none',
                    transition: 'height 0.5s ease',
                  }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Gauge({ value, max, target, mid, label, unit }) {
  const W = 130, H = 95, cx = 65, cy = 55, R = 44, SW = 9;
  const START = 135, SWEEP = 270;
  const toR = d => d * Math.PI / 180;
  const pt = (d, r = R) => [
    +(cx + r * Math.cos(toR(d))).toFixed(2),
    +(cy + r * Math.sin(toR(d))).toFixed(2),
  ];
  function arcD(startDeg, sweep) {
    if (sweep <= 0.5) return '';
    const s = Math.min(Math.abs(sweep), SWEEP - 0.1);
    const [sx, sy] = pt(startDeg);
    const [ex, ey] = pt(startDeg + s);
    return `M ${sx} ${sy} A ${R} ${R} 0 ${s > 180 ? 1 : 0} 1 ${ex} ${ey}`;
  }
  const z1 = mid * 0.7, z2 = mid, z3 = target;
  const ang = v => START + (Math.min(v, max) / max) * SWEEP;

  // Needle triangle
  const nAngle = ang(value);
  const nR = R - SW - 1;
  const [ntx, nty] = pt(nAngle, nR);
  const perpRad = toR(nAngle + 90);
  const bw = 2;
  const b1x = +(cx + bw * Math.cos(perpRad)).toFixed(2);
  const b1y = +(cy + bw * Math.sin(perpRad)).toFixed(2);
  const b2x = +(cx - bw * Math.cos(perpRad)).toFixed(2);
  const b2y = +(cy - bw * Math.sin(perpRad)).toFixed(2);
  const needlePts = `${ntx},${nty} ${b1x},${b1y} ${b2x},${b2y}`;

  const col = zoneColor(value, target, mid);

  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ overflow: 'visible' }}>
        {/* Zone arcs */}
        <path d={arcD(START, (z1 / max) * SWEEP)} fill="none" stroke="#ff5533" strokeWidth={SW} />
        <path d={arcD(ang(z1), ((z2 - z1) / max) * SWEEP)} fill="none" stroke="#ff9900" strokeWidth={SW} />
        <path d={arcD(ang(z2), ((z3 - z2) / max) * SWEEP)} fill="none" stroke="#ffcc00" strokeWidth={SW} />
        <path d={arcD(ang(z3), ((max - z3) / max) * SWEEP)} fill="none" stroke="#11dd77" strokeWidth={SW} />

        {/* Needle */}
        <polygon points={needlePts} fill="#ffffff"
          style={{ filter: 'drop-shadow(0 0 3px #00e5ffbb)' }} />
        <circle cx={cx} cy={cy} r={3.5} fill="#0d1c30" stroke="#ffffff" strokeWidth={1.2} />
      </svg>
      <div style={{ fontSize: 22, color: col, fontWeight: 'bold', marginTop: 2, fontFamily: "'Courier New',monospace", lineHeight: 1 }}>
        {value}<span style={{ fontSize: 11, color: '#90b0d0', fontWeight: 'normal', marginLeft: 5 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11, color: '#a0c0d8', letterSpacing: 2, textTransform: 'uppercase', marginTop: 5, fontWeight: 'bold' }}>{label}</div>
    </div>
  );
}

function ResultLayout({ cpm, accuracy, attempts, prevBest }) {
  const cpmVals = (attempts || []).map(a => a.cpm);
  const accVals = (attempts || []).map(a => a.acc);
  const maxCpm = Math.ceil(Math.max(200, ...(cpmVals.length ? cpmVals : [200])) / 50) * 50;
  return (
    <div style={{
      background: '#030e1c', border: '1.5px solid #142540', borderRadius: 14,
      padding: '16px', maxWidth: 520, margin: '0 auto', textAlign: 'left',
    }}>
      {prevBest && cpm > prevBest.cpm && (
        <div style={{ textAlign: 'center', color: '#ffe600', fontSize: 13, letterSpacing: 2, marginBottom: 14, fontWeight: 'bold', textShadow: '0 0 10px #ffe60066' }}>
          🏆 NOUVEAU RECORD PERSONNEL !
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <Gauge value={cpm} max={250} target={150} mid={100} label="Vitesse" unit="car/min" />
          <Gauge value={accuracy} max={100} target={85} mid={75} label="Précision" unit="%" />
        </div>
        {cpmVals.length >= 1 && (
          <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
            <MiniBarChart values={cpmVals} yMax={maxCpm} target={150} mid={100} label="Vitesse" unit="" />
            <MiniBarChart values={accVals} yMax={100} target={85} mid={75} label="Précision" unit="%" />
          </div>
        )}
      </div>
    </div>
  );
}

function StarsDisplay({ count, size = 20 }) {
  return (
    <span style={{ fontSize: size, letterSpacing: 4 }}>
      {[1, 2, 3].map(i => (
        <span key={i} style={{ color: i <= count ? '#ffe600' : '#1e3050', textShadow: i <= count ? '0 0 10px #ffe60066' : 'none' }}>★</span>
      ))}
    </span>
  );
}

function getTips(charErrors, cpm, accuracy) {
  const tips = [];
  const sorted = Object.entries(charErrors || {})
    .filter(([, n]) => n >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2);
  if (sorted.length > 0) {
    const keys = sorted.map(([k]) => `"${k.toUpperCase()}"`).join(' et ');
    const total = sorted.reduce((s, [, n]) => s + n, 0);
    tips.push(`🎯 ${total} erreur${total > 1 ? 's' : ''} sur ${keys} — pratique ces touches !`);
  }
  if (accuracy < 70) {
    tips.push('🐢 Ralentis et lis chaque lettre avant de taper — la précision d\'abord !');
  } else if (accuracy < 85) {
    tips.push('👀 Essaie de regarder l\'écran plutôt que tes doigts — ça aide à anticiper !');
  }
  if (cpm < 100) {
    tips.push('🖐️ Garde les doigts en position : A-S-D-F (main gauche) et J-K-L (main droite).');
  } else if (cpm < 150 && accuracy >= 80) {
    tips.push('⚡ Bonne précision ! Un tout petit peu plus de vitesse et tu décolles !');
  }
  if (tips.length === 0) tips.push('💪 Tu progresses à chaque essai — continue comme ça !');
  return tips;
}

function TipsList({ charErrors, cpm, accuracy }) {
  const tips = getTips(charErrors, cpm, accuracy);
  return (
    <div style={{
      background: '#030e1c', border: '1.5px solid #1a2540', borderRadius: 14,
      padding: '16px 22px', maxWidth: 520, margin: '12px auto 0', textAlign: 'left',
    }}>
      <div style={{ fontSize: 12, color: '#a0c0e0', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14, textAlign: 'center', fontWeight: 'bold' }}>
        Conseils pour la prochaine fois
      </div>
      {tips.map((tip, i) => (
        <div key={i} style={{ fontSize: 14, color: '#6090b0', marginBottom: i < tips.length - 1 ? 12 : 0, lineHeight: 1.7 }}>
          {tip}
        </div>
      ))}
    </div>
  );
}

