import { useState } from 'react';
import StarField from './StarField';

export default function LoginScreen({ onLogin }) {
  const [name, setName] = useState('');

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(175deg,#020814,#050b1c,#080d22)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Courier New',monospace", color: 'white', padding: 20,
      position: 'relative', overflow: 'hidden',
    }}>
      <StarField brightMult={0.5} />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 400, width: '100%' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🚀</div>
        <div style={{ fontSize: 24, color: '#00e5ff', fontWeight: 'bold', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 6 }}>
          Mission Cosmos
        </div>
        <div style={{ fontSize: 12, color: '#3a5070', letterSpacing: 2, marginBottom: 36 }}>
          Apprendre à taper au clavier
        </div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onLogin(name.trim())}
          placeholder="Ton prénom..."
          autoFocus
          style={{
            width: '100%', background: '#0a1428', border: '1.5px solid #1e3a60', borderRadius: 12,
            padding: '12px 18px', color: 'white', fontSize: 16, fontFamily: "'Courier New',monospace",
            outline: 'none', textAlign: 'center', marginBottom: 16,
          }}
        />
        <button
          onClick={() => name.trim() && onLogin(name.trim())}
          style={{
            width: '100%',
            background: name.trim() ? 'linear-gradient(135deg,#0044dd,#00ccff)' : '#0a1428',
            color: name.trim() ? 'white' : '#2a4060',
            border: 'none', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 'bold',
            cursor: name.trim() ? 'pointer' : 'default', letterSpacing: 3, textTransform: 'uppercase',
            boxShadow: name.trim() ? '0 0 20px #00e5ff33' : 'none', transition: 'all .2s',
          }}
        >
          🚀 Décoller !
        </button>
      </div>
    </div>
  );
}
