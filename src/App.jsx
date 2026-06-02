import { useState } from 'react';
import { loadCookie, saveCookie, clearCookie } from './utils/cookie';
import LoginScreen from './components/LoginScreen';
import XmlLoadScreen from './components/XmlLoadScreen';
import LevelSelect from './components/LevelSelect';
import GameScreen from './components/GameScreen';
import { parseXML } from './utils/xml';
import defaultXmlRaw from './assets/base_level.xml?raw';

function readCookieState() {
  const s = loadCookie();
  if (s?.name) {
    try {
      return { screen: 'select', save: s, levels: parseXML(defaultXmlRaw) };
    } catch {
      return { screen: 'xml_load', save: s, levels: null };
    }
  }
  return { screen: 'login', save: { name: '', unlocked: 0 }, levels: null };
}

const { screen: initialScreen, save: initialSave, levels: initialLevels } = readCookieState();

export default function SpaceTyping() {
  const [screen, setScreen] = useState(initialScreen);
  const [save, setSave] = useState(initialSave);
  const [levels, setLevels] = useState(initialLevels);
  const [lvIdx, setLvIdx] = useState(0);

  function handleLogin(name) {
    const s = { name, unlocked: 0 };
    setSave(s); saveCookie(s);
    try {
      setLevels(parseXML(defaultXmlRaw));
      setScreen('select');
    } catch {
      setScreen('xml_load');
    }
  }

  function handleReset() {
    clearCookie(); setSave({ name: '', unlocked: 0 }); setLevels(null); setScreen('login');
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
