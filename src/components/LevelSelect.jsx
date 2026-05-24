import StarField from './StarField';

const LEVEL_EMOJIS = ['🏠', '🏠', '🏠', '🏠', '🏡', '🌙', '🌙', '⭐', '⭐', '✨', '✨', '🪐', '🌌', '🚀', '🌠'];

export default function LevelSelect({ save, levels, onPlay, onReset, onReloadXml }) {
  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(175deg,#020814,#050b1c,#080d22)',
      fontFamily: "'Courier New',monospace", color: 'white', padding: '20px 14px',
      position: 'relative', overflow: 'hidden',
    }}>
      <StarField brightMult={0.4} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ color: '#00e5ff', fontSize: 18, fontWeight: 'bold', letterSpacing: 3 }}>🚀 Mission Cosmos</div>
            <div style={{ color: '#3a5070', fontSize: 11, letterSpacing: 2, marginTop: 2 }}>Pilote : {save.name}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onReloadXml} style={{ background: '#0a1428', border: '1px solid #1a3050', borderRadius: 8, padding: '6px 12px', color: '#3a5570', fontSize: 11, cursor: 'pointer', letterSpacing: 1 }}>
              📂 XML
            </button>
            <button onClick={onReset} style={{ background: '#0a1428', border: '1px solid #1a3050', borderRadius: 8, padding: '6px 12px', color: '#334466', fontSize: 11, cursor: 'pointer', letterSpacing: 1 }}>
              Changer de pilote
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
          {levels.map((lv, i) => {
            const unlocked = i <= save.unlocked;
            const best = save.best?.[i] || 0;
            const done = best > 0;
            const emoji = LEVEL_EMOJIS[Math.min(i, LEVEL_EMOJIS.length - 1)];
            return (
              <div
                key={i}
                onClick={() => unlocked && onPlay(i)}
                style={{
                  background: done ? '#050e20' : unlocked ? '#040c1a' : '#030810',
                  border: `1.5px solid ${done ? '#00e5ff33' : unlocked ? '#1a2e55' : '#0e1e30'}`,
                  borderRadius: 14, padding: '14px 12px',
                  cursor: unlocked ? 'pointer' : 'default',
                  textAlign: 'center', transition: 'all .15s',
                  opacity: unlocked ? 1 : .45,
                  boxShadow: done ? '0 0 12px #00e5ff11' : 'none',
                }}
              >
                <div style={{ fontSize: 26, marginBottom: 6 }}>{unlocked ? emoji : '🔒'}</div>
                <div style={{ fontSize: 11, color: done ? '#00e5ff' : unlocked ? '#445566' : '#2a3a4a', fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 }}>
                  {lv.name}
                </div>
                {done && <div style={{ fontSize: 10, color: '#ffe600' }}>⭐ {best} pts</div>}
                {!done && unlocked && <div style={{ fontSize: 9, color: '#2a3a4a', letterSpacing: 1 }}>APPUYER</div>}
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 10, color: '#1e2e40', letterSpacing: 2 }}>
          {save.unlocked + 1}/{levels.length} niveaux débloqués
        </div>
      </div>
    </div>
  );
}
