import { useState, useEffect, useCallback, useRef } from 'react';
import StarField from './StarField';
import Rocket from './Rocket';
import { KEYBOARD_ROWS, BUMP_KEYS } from '../constants';
import { pickWords } from '../utils/xml';
import { saveCookie } from '../utils/cookie';
import { getCtx, sfxCorrect, sfxWrong, sfxWordDone, sfxLaunch, sfxCrash, startAmbient } from '../utils/audio';

export default function GameScreen({ levels, save: initialSave, initialLvIdx, onSaveUpdate, onBack }) {
  const audioRef = useRef(null), ambientRef = useRef(null), mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const [currentSave, setCurrentSave] = useState(initialSave);

  const [lvIdx, setLvIdx] = useState(initialLvIdx);
  const [phase, setPhase] = useState('playing');
  const [words, setWords] = useState(() => pickWords(levels[initialLvIdx]));
  const [wordIdx, setWordIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [wrong, setWrong] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [score, setScore] = useState(0);
  const [wordErrors, setWordErrors] = useState(0);
  const [starBright, setStarBright] = useState(50);
  const [enginePower, setEnginePower] = useState(20);
  const [sparks, setSparks] = useState([]);
  const [wordStart, setWordStart] = useState(() => Date.now());

  function startLevel(i) {
    const lv = levels[i];
    setLvIdx(i); setWords(pickWords(lv));
    setWordIdx(0); setTyped(''); setPhase('playing'); setScore(0);
    setWordErrors(0); setStarBright(50); setEnginePower(20);
    setWordStart(Date.now()); setSparks([]); setCelebrate(false); setWrong(false);
  }

  const handleLevelEnd = useCallback((finalScore, passed) => {
    setCurrentSave(prev => {
      const newUnlocked = passed
        ? Math.max(prev.unlocked, Math.min(lvIdx + 1, levels.length - 1))
        : prev.unlocked;
      const newBest = { ...prev.best, [lvIdx]: Math.max(prev.best?.[lvIdx] || 0, finalScore) };
      const updated = { ...prev, unlocked: newUnlocked, best: newBest };
      saveCookie(updated);
      onSaveUpdate(updated);
      return updated;
    });
  }, [lvIdx, levels.length, onSaveUpdate]);

  const level = levels[lvIdx];
  const currentWord = words[wordIdx] || '';
  const nextChar = currentWord[typed.length] || '';
  const maxScore = words.reduce((s, w) => s + w.length * 20 + 20, 0);
  const minScore = Math.round(maxScore * level.minPct);
  const progress = (wordIdx + typed.length / (currentWord.length || 1)) / (level.ms || 8) * 100;
  const brightMult = Math.max(0.08, starBright / 100);
  const engColor = enginePower > 60
    ? 'linear-gradient(to right,#ff8c00,#00e5ff)'
    : enginePower > 30
      ? 'linear-gradient(to right,#ff4400,#ff8c00)'
      : 'linear-gradient(to right,#cc2200,#ff4400)';

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
      const next = typed + k;
      setTyped(next);
      setStarBright(b => Math.min(100, b + 3));
      setEnginePower(p => Math.min(100, p + 2.5));

      if (next === currentWord) {
        snd(sfxWordDone);
        const elapsed = (Date.now() - wordStart) / 1000;
        const spd = elapsed < 3 ? 20 : elapsed < 6 ? 10 : 0;
        const wScore = Math.max(0, currentWord.length * 20 - wordErrors * 5 + spd);
        const fin = score + wScore;
        setScore(fin); setCelebrate(true);
        setSparks(Array.from({ length: 14 }, (_, i) => ({
          id: Date.now() + i,
          a: (i / 14) * 360,
          c: i % 3 === 0 ? '#00e5ff' : i % 3 === 1 ? '#ffe600' : '#ff8c00',
        })));
        setEnginePower(p => Math.min(100, p + 12));

        setTimeout(() => {
          setSparks([]); setCelebrate(false);
          if (wordIdx + 1 >= level.ms) {
            const ok = fin >= minScore;
            handleLevelEnd(fin, ok);
            setPhase(ok ? 'launching' : 'crashing');
            if (!mutedRef.current) (ok ? sfxLaunch : sfxCrash)(getCtx(audioRef));
            setTimeout(() => setPhase(ok ? 'passed' : 'failed'), ok ? 3200 : 4200);
          } else {
            setWordIdx(i => i + 1); setTyped(''); setWordErrors(0); setWordStart(Date.now());
          }
        }, 700);
      }
    } else if (/[a-zàâéèêëîïôùûüÿæœç]/i.test(k)) {
      snd(sfxWrong);
      setWrong(true); setWordErrors(we => we + 1);
      setStarBright(b => Math.max(10, b - 6));
      setEnginePower(p => Math.max(0, p - 9));
      setTimeout(() => setWrong(false), 290);
    }
  }, [phase, celebrate, nextChar, typed, currentWord, wordIdx, score, wordErrors, wordStart, minScore, level.ms, handleLevelEnd]);

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
              <Rocket power={phase === 'launching' ? 100 : enginePower} w={90} h={168} />
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
              <button onClick={onBack} style={{ background: '#080f1e', border: '1px solid #1a3050', borderRadius: 8, padding: '4px 10px', color: '#3a5570', cursor: 'pointer', fontSize: 13 }}>
                ← Niveaux
              </button>
              <div style={{ color: '#00e5ff', fontSize: 14, fontWeight: 'bold', letterSpacing: 2 }}>{level.name}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ background: '#080f1e', border: '1px solid #1a3050', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#3a5570' }}>
                Min <span style={{ color: '#ffe600' }}>{minScore}</span>
              </div>
              <div style={{ background: '#080f1e', border: '1px solid #ffe60033', borderRadius: 8, padding: '4px 10px', color: '#ffe600', fontSize: 16, fontWeight: 'bold' }}>
                ⭐ {score}
              </div>
              <button onClick={toggleMute} style={{ background: '#080f1e', border: '1px solid #1a3050', borderRadius: 8, padding: '4px 10px', color: '#3a5570', cursor: 'pointer', fontSize: 14 }}>
                {muted ? '🔇' : '🔊'}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ height: 7, background: '#060f1e', border: '1px solid #1a2e55', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(to right,#0033cc,#00e5ff)', transition: 'width .4s ease', boxShadow: '0 0 8px #00e5ff44' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 10, color: '#1e3050', letterSpacing: 2, textTransform: 'uppercase' }}>
              <span>Départ</span><span>{wordIdx}/{level.ms}</span><span>🪐</span>
            </div>
          </div>

          {/* Passed result */}
          {phase === 'passed' && (
            <div style={{ textAlign: 'center', padding: '28px 16px', animation: 'fadeIn .7s ease-out forwards' }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🎉🚀⭐</div>
              <div style={{ fontSize: 22, color: '#ffe600', fontWeight: 'bold', letterSpacing: 3, marginBottom: 8 }}>NIVEAU RÉUSSI !</div>
              <div style={{ fontSize: 15, color: '#00e5ff', marginBottom: 6 }}>
                Score : <strong style={{ color: '#ffe600', fontSize: 20 }}>{score}</strong> / {maxScore} pts
              </div>
              <div style={{ fontSize: 12, color: '#3a5060', marginBottom: 28 }}>Minimum requis : {minScore} pts ✅</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => startLevel(lvIdx)} style={{ background: '#080f1e', color: '#4a6080', border: '1.5px solid #1a3050', borderRadius: 10, padding: '10px 20px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', letterSpacing: 2, textTransform: 'uppercase' }}>
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
              <div style={{ fontSize: 22, color: '#ff6644', fontWeight: 'bold', letterSpacing: 3, marginBottom: 8 }}>RETOUR AU SOL...</div>
              <div style={{ fontSize: 15, color: '#998888', marginBottom: 6 }}>
                Score : <strong style={{ color: '#ff9966', fontSize: 20 }}>{score}</strong> pts
              </div>
              <div style={{ fontSize: 12, color: '#5a3333', marginBottom: 28 }}>Il fallait {minScore} pts — encore un effort ! 💪</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => startLevel(lvIdx)} style={{ background: 'linear-gradient(135deg,#bb3300,#ff5500)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', letterSpacing: 2, textTransform: 'uppercase', boxShadow: '0 0 18px #ff440033' }}>
                  🔁 Réessayer
                </button>
                <button onClick={onBack} style={{ background: '#080f1e', color: '#4a6080', border: '1.5px solid #1a3050', borderRadius: 10, padding: '10px 20px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', letterSpacing: 2, textTransform: 'uppercase' }}>
                  📋 Niveaux
                </button>
              </div>
            </div>
          )}

          {/* Playing UI */}
          {phase === 'playing' && (
            <>
              {/* Engine gauge + rocket */}
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#2a4060', letterSpacing: 2, marginBottom: 5, textTransform: 'uppercase' }}>
                    <span>🔥 Puissance moteur</span>
                    <span style={{ color: enginePower > 60 ? '#00e5ff' : enginePower > 30 ? '#ffe600' : '#ff6644', transition: 'color .5s' }}>
                      {Math.round(enginePower)}%
                    </span>
                  </div>
                  <div style={{ height: 8, background: '#060f1e', border: '1px solid #1a2e55', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${enginePower}%`, background: engColor, transition: 'width .2s ease', boxShadow: `0 0 8px ${enginePower > 60 ? '#00e5ff55' : '#ff660055'}` }} />
                  </div>
                  <div style={{ fontSize: 9, color: '#1c2e42', marginTop: 3, letterSpacing: 1 }}>
                    {score >= minScore ? '✅ Minimum atteint !' : ` Encore ${minScore - score} pts`}
                  </div>
                </div>
                <div style={{ flexShrink: 0, paddingBottom: 2 }}>
                  <Rocket power={enginePower} w={44} h={82} />
                </div>
              </div>

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
                <div style={{ fontSize: 10, color: '#1e3050', letterSpacing: 3, marginBottom: 16, textTransform: 'uppercase' }}>
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
                        color: done ? '#00e5ff' : next ? '#ffe600' : '#1a2e48',
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
                  <div style={{ position: 'absolute', bottom: 9, left: '50%', transform: 'translateX(-50%)', color: '#ff6666', fontSize: 11, letterSpacing: 1, whiteSpace: 'nowrap' }}>
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
                          color: isTarget ? '#1a1200' : isNew ? '#00cc66' : inLevel ? '#26445e' : '#0e1a28',
                          background: isTarget ? '#ffe600' : isNew ? '#001a0e' : inLevel ? '#070d1a' : '#040810',
                          textTransform: 'uppercase', transition: 'all .12s ease',
                          animation: isTarget ? 'glowKey 1s ease-in-out infinite' : isNew ? 'glowNew 2s ease-in-out infinite' : 'none',
                          userSelect: 'none', position: 'relative', opacity: inLevel ? 1 : .35,
                        }}>
                          {key}
                          {isBump && (
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: isTarget ? '#1a1200' : '#1e3a60', position: 'absolute', bottom: 4 }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10, fontSize: 10, color: '#182a3e', letterSpacing: 1, flexWrap: 'wrap' }}>
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
