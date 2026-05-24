import { useState } from 'react';
import { loadCookie, saveCookie, clearCookie } from './utils/cookie';
import LoginScreen from './components/LoginScreen';
import XmlLoadScreen from './components/XmlLoadScreen';
import LevelSelect from './components/LevelSelect';
import GameScreen from './components/GameScreen';

function readCookieState() {
  const s = loadCookie();
  return s?.name
    ? { screen: 'xml_load', save: s }
    : { screen: 'login', save: { name: '', unlocked: 0, best: {} } };
}

const { screen: initialScreen, save: initialSave } = readCookieState();

export default function SpaceTyping() {
  const [screen, setScreen] = useState(initialScreen);
  const [save, setSave] = useState(initialSave);
  const [levels, setLevels] = useState(null);
  const [lvIdx, setLvIdx] = useState(0);

  function handleLogin(name) {
    const s = { name, unlocked: 0, best: {} };
    setSave(s); saveCookie(s); setScreen('xml_load');
  }

  function handleReset() {
    clearCookie(); setSave({ name: '', unlocked: 0, best: {} }); setLevels(null); setScreen('login');
  }

  function handleSaveUpdate(updated) {
    setSave(updated);
  }

  if (screen === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#020814', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00e5ff', fontFamily: 'monospace' }}>
        …
      </div>
    );
  }
  if (screen === 'login')    return <LoginScreen onLogin={handleLogin} />;
  if (screen === 'xml_load') return <XmlLoadScreen playerName={save.name} onLoad={lvs => { setLevels(lvs); setScreen('select'); }} />;
  if (screen === 'select')   return <LevelSelect save={save} levels={levels} onPlay={i => { setLvIdx(i); setScreen('game'); }} onReset={handleReset} onReloadXml={() => setScreen('xml_load')} />;

  return (
    <GameScreen
      levels={levels}
      save={save}
      initialLvIdx={lvIdx}
      onSaveUpdate={handleSaveUpdate}
      onBack={() => setScreen('select')}
    />
  );
}
