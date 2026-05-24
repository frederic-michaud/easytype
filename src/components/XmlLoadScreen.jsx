import { useState } from 'react';
import StarField from './StarField';
import { parseXML } from '../utils/xml';

export default function XmlLoadScreen({ playerName, onLoad }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function processFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xml')) { setError('Fichier .xml attendu'); return; }
    setLoading(true); setError('');
    const reader = new FileReader();
    reader.onload = e => {
      try { onLoad(parseXML(e.target.result)); }
      catch (err) { setError(err.message); setLoading(false); }
    };
    reader.onerror = () => { setError('Impossible de lire le fichier'); setLoading(false); };
    reader.readAsText(file, 'utf-8');
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(175deg,#020814,#050b1c,#080d22)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Courier New',monospace", color: 'white', padding: 24,
      position: 'relative', overflow: 'hidden',
    }}>
      <StarField brightMult={0.4} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
        <div style={{ fontSize: 20, color: '#00e5ff', fontWeight: 'bold', letterSpacing: 3, marginBottom: 4 }}>
          Bienvenue, {playerName} !
        </div>
        <div style={{ fontSize: 12, color: '#3a5070', letterSpacing: 1, marginBottom: 32 }}>
          Charge le fichier de niveaux pour commencer
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]); }}
          style={{
            border: `2px dashed ${dragging ? '#00e5ff' : '#1e3a60'}`,
            borderRadius: 16, padding: '40px 24px', marginBottom: 16,
            background: dragging ? '#0a1e34' : '#040e1a',
            transition: 'all .2s', cursor: 'pointer',
          }}
        >
          <input type="file" accept=".xml" id="xml-input" style={{ display: 'none' }} onChange={e => processFile(e.target.files[0])} />
          <label htmlFor="xml-input" style={{ cursor: 'pointer', display: 'block' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗂️</div>
            <div style={{ fontSize: 13, color: dragging ? '#00e5ff' : '#3a5570', letterSpacing: 1 }}>
              {loading ? 'Chargement...' : 'Glisse le fichier XML ici'}
            </div>
            <div style={{ fontSize: 11, color: '#1e3050', marginTop: 8 }}>ou clique pour choisir</div>
          </label>
        </div>

        {error && (
          <div style={{ color: '#ff7755', fontSize: 12, marginBottom: 16, padding: '8px 16px', background: '#1a0808', borderRadius: 8, border: '1px solid #442222' }}>
            {error}
          </div>
        )}

        <div style={{ fontSize: 10, color: '#1a2e44', letterSpacing: 1, lineHeight: 1.8 }}>
          Fichier généré par :<br />
          <span style={{ color: '#2a4060', fontFamily: 'monospace' }}>python filter_words.py wordlist.csv filters.txt output.xml</span>
        </div>
      </div>
    </div>
  );
}
