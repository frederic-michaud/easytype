import { useState, useEffect, useCallback, useRef } from "react";

// ── Clavier QWERTZ suisse-français ────────────────────────────────────────
const KEYBOARD_ROWS = [
  ['q','w','e','r','t','z','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l','é'],
  ['y','x','c','v','b','n','m'],
];
const BUMP_KEYS = new Set(['f','j']);
const VOWELS    = new Set([...'aeiouyéèêëàâùûôî']);

// ── Étoiles ────────────────────────────────────────────────────────────────
const STARS = Array.from({length:130}, (_, i) => ({
  id: i, x: Math.random()*100, y: Math.random()*100,
  s: [1,1,1,2,3][Math.floor(Math.random()*5)],
  baseOp: 0.2 + Math.random()*0.8, dur: 1.5 + Math.random()*4,
}));

// ── Cookies ────────────────────────────────────────────────────────────────
const COOKIE = 'space_typing_v3';
function saveCookie(d){
  const e=new Date(); e.setDate(e.getDate()+90);
  document.cookie=`${COOKIE}=${encodeURIComponent(JSON.stringify(d))};expires=${e.toUTCString()};path=/`;
}
function loadCookie(){
  for(const c of document.cookie.split(';')){
    const [k,...vs]=c.trim().split('=');
    if(k===COOKIE){try{return JSON.parse(decodeURIComponent(vs.join('=')));}catch{return null;}}
  }
  return null;
}
function clearCookie(){document.cookie=`${COOKIE}=;expires=Thu,01 Jan 1970 00:00:00 UTC;path=/`;}

// ── Parseur XML ────────────────────────────────────────────────────────────
function parseXML(text) {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  if (doc.querySelector('parsererror'))
    throw new Error('XML malformé — vérifie le fichier');

  const levels = [];
  for (const f of doc.querySelectorAll('filter')) {
    // Caractères autorisés et requis
    const parseChars = sel =>
      new Set((f.querySelector(sel)?.textContent || '').split(/\s+/).filter(c => c.length === 1));
    const A = parseChars('allowed_chars');
    const B = parseChars('required_chars');

    const name    = f.getAttribute('level_name')    || `Niveau ${f.getAttribute('index')}`;
    const minPct  = parseFloat(f.getAttribute('min_score_pct') || '0.5');
    const ms      = parseInt(  f.getAttribute('mission_size')  || '8', 10);

    const realWords   = [...f.querySelectorAll('matches > word')].map(w => w.textContent.trim()).filter(Boolean);
    const pseudoWords = [...f.querySelectorAll('pseudo_words > word')].map(w => w.textContent.trim()).filter(Boolean);

    // On préfère les vrais mots ; les pseudo-mots comblent si besoin
    const words = realWords.length > 0 ? [...realWords, ...pseudoWords] : pseudoWords;

    if (words.length === 0) {
      // Fallback ultime : génération JS côté client
      words.push(...genPseudo(A, B, 40));
    }

    levels.push({ name, newKeys: B, chars: A, minPct, ms, words });
  }
  if (levels.length === 0) throw new Error('Aucun niveau <filter> trouvé');
  return levels;
}

// ── Générateur de pseudo-mots (fallback JS) ────────────────────────────────
function genPseudo(A, B, count = 40) {
  const Al = [...A], Bl = [...B];
  const vowels = Al.filter(c => VOWELS.has(c));
  const cons   = Al.filter(c => !VOWELS.has(c));
  const result = new Set();
  let att = 0;
  while (result.size < count && att++ < 50000) {
    const len = 3 + Math.floor(Math.random() * 3);
    const word = []; let hasB = false;
    for (let p = 0; p < len; p++) {
      let pool = (vowels.length && cons.length) ? (p%2===1 ? vowels : cons) : Al;
      if (p === len-1 && !hasB) {
        const bp = pool.filter(c => B.has(c));
        if (bp.length) pool = bp; else if (Bl.length) pool = Bl;
      }
      const c = pool[Math.floor(Math.random()*pool.length)];
      if (B.has(c)) hasB = true;
      word.push(c);
    }
    const w = word.join('');
    if (hasB && new Set(w).size >= 2) result.add(w);
  }
  return [...result];
}

// ── Sélection des mots pour une session ───────────────────────────────────
function pickWords(level) {
  const real   = level.words.filter(w => [...w].every(c => level.chars.has(c)) && [...w].some(c => level.newKeys.has(c)));
  const pseudo = level.words.filter(w => !real.includes(w));
  // Vrais mots en priorité, pseudo en complément
  const pool = [...real.sort(()=>Math.random()-.5), ...pseudo.sort(()=>Math.random()-.5)];
  while (pool.length < level.ms) pool.push(...pool.slice(0, level.ms - pool.length));
  return pool.slice(0, level.ms);
}

// ── Audio ──────────────────────────────────────────────────────────────────
function getCtx(r){
  if(!r.current) r.current=new(window.AudioContext||window.webkitAudioContext)();
  if(r.current.state==='suspended') r.current.resume();
  return r.current;
}
const sfxCorrect  = ctx => { const t=ctx.currentTime; [523,659].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0.12,t+i*.065);g.gain.exponentialRampToValueAtTime(.001,t+i*.065+.2);o.start(t+i*.065);o.stop(t+i*.065+.22);}); };
const sfxWrong    = ctx => { const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type='sawtooth';o.frequency.setValueAtTime(200,t);o.frequency.exponentialRampToValueAtTime(80,t+.18);g.gain.setValueAtTime(0.12,t);g.gain.exponentialRampToValueAtTime(.001,t+.22);o.start(t);o.stop(t+.24); };
const sfxWordDone = ctx => { const t=ctx.currentTime; [523,659,784,1047].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0.18,t+i*.075);g.gain.exponentialRampToValueAtTime(.001,t+i*.075+.3);o.start(t+i*.075);o.stop(t+i*.075+.32);}); };
const sfxLaunch   = ctx => { const t=ctx.currentTime;const buf=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;const src=ctx.createBufferSource();src.buffer=buf;const fl=ctx.createBiquadFilter();fl.type='lowpass';fl.frequency.setValueAtTime(120,t);fl.frequency.linearRampToValueAtTime(600,t+2.8);const g=ctx.createGain();g.gain.setValueAtTime(0.4,t);g.gain.exponentialRampToValueAtTime(.001,t+3);src.connect(fl);fl.connect(g);g.connect(ctx.destination);src.start(t);const o=ctx.createOscillator(),og=ctx.createGain();o.connect(og);og.connect(ctx.destination);o.type='sawtooth';o.frequency.setValueAtTime(55,t);o.frequency.exponentialRampToValueAtTime(350,t+2.8);og.gain.setValueAtTime(0.22,t);og.gain.exponentialRampToValueAtTime(.001,t+3);o.start(t);o.stop(t+3); };
const sfxCrash    = ctx => { const t=ctx.currentTime;const o=ctx.createOscillator(),og=ctx.createGain();o.connect(og);og.connect(ctx.destination);o.type='sawtooth';o.frequency.setValueAtTime(70,t);o.frequency.linearRampToValueAtTime(200,t+.9);o.frequency.exponentialRampToValueAtTime(25,t+2.2);og.gain.setValueAtTime(0.2,t);og.gain.setValueAtTime(0.2,t+.9);og.gain.exponentialRampToValueAtTime(.001,t+2.5);o.start(t);o.stop(t+2.6);const buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.5),ctx.sampleRate);const db=buf.getChannelData(0);for(let i=0;i<db.length;i++)db[i]=Math.random()*2-1;const src=ctx.createBufferSource();src.buffer=buf;const fl=ctx.createBiquadFilter();fl.type='lowpass';fl.frequency.value=80;const gg=ctx.createGain();gg.gain.setValueAtTime(0.5,t+2.8);gg.gain.exponentialRampToValueAtTime(.001,t+3.4);src.connect(fl);fl.connect(gg);gg.connect(ctx.destination);src.start(t+2.8); };
function startAmbient(ctx){const m=ctx.createGain();m.gain.value=0.032;m.connect(ctx.destination);[55,82.5,110,165].forEach(f=>{const o=ctx.createOscillator();o.type='sine';o.frequency.value=f;o.connect(m);o.start();});const lf=ctx.createOscillator(),lg=ctx.createGain();lf.frequency.value=0.12;lg.gain.value=4;lf.connect(lg);return{master:m};}

// ── Fusée ──────────────────────────────────────────────────────────────────
function Rocket({power=0,w=70,h=130}){
  const sc=w/70, fp=Math.min(100,Math.max(0,power));
  const fH=(20+fp*.9)*sc, fW=(14+fp*.18)*sc;
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
      <svg width={w} height={h} viewBox="0 0 70 130" style={{overflow:'visible'}}>
        <defs>
          <linearGradient id="rg1" x1="0" x2="1"><stop offset="0%" stopColor="#7080a0"/><stop offset="40%" stopColor="#ccdcea"/><stop offset="100%" stopColor="#7080a0"/></linearGradient>
          <linearGradient id="rg2" x1="0" x2="1"><stop offset="0%" stopColor="#9aaabb"/><stop offset="50%" stopColor="#eef2f8"/><stop offset="100%" stopColor="#9aaabb"/></linearGradient>
        </defs>
        <path d="M35 6 L17 52 Q35 43 53 52 Z" fill="url(#rg2)"/>
        <rect x="17" y="50" width="36" height="58" rx="7" fill="url(#rg1)"/>
        <circle cx="35" cy="70" r="11" fill="#4ab0e0" stroke="#3880c0" strokeWidth="2.5"/>
        <circle cx="35" cy="70" r="7" fill="#80d0f0" opacity=".7"/>
        <circle cx="30" cy="65" r="2.5" fill="white" opacity=".45"/>
        <rect x="17" y="84" width="36" height="6" fill="#cc2233" opacity=".75"/>
        <rect x="17" y="90" width="36" height="3" fill="white" opacity=".55"/>
        <path d="M24 108 L19 123 L51 123 L46 108 Z" fill="#686e80"/>
        <path d="M17 84 L6 118 L17 105 Z" fill="#4858a0"/>
        <path d="M53 84 L64 118 L53 105 Z" fill="#4858a0"/>
        <ellipse cx="35" cy="123" rx="16" ry="4.5" fill="#484e60"/>
      </svg>
      {fp>3&&(<div style={{marginTop:-7*sc,position:'relative',width:fW+12*sc,height:fH*1.5}}>
        <div style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:fW+12*sc,height:fH*1.5,background:'linear-gradient(to bottom,#ff6a0077,#ff220033 60%,transparent)',borderRadius:'40% 40% 60% 60%',filter:`blur(${5*sc}px)`,animation:'flkr1 .13s ease-in-out infinite alternate'}}/>
        <div style={{position:'absolute',top:3*sc,left:'50%',transform:'translateX(-50%)',width:fW,height:fH,background:'linear-gradient(to bottom,#fff,#ffe066 22%,#ff8800 65%,transparent)',borderRadius:'40% 40% 60% 60%',filter:`blur(${(1+fp*.012)*sc}px)`,animation:'flkr2 .09s ease-in-out infinite alternate'}}/>
      </div>)}
    </div>
  );
}

// ── Fond étoilé ────────────────────────────────────────────────────────────
function StarField({brightMult=0.5}){
  return(
    <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0}}>
      {STARS.map(s=>(
        <div key={s.id} style={{position:'absolute',left:`${s.x}%`,top:`${s.y}%`,width:s.s,height:s.s,borderRadius:'50%',background:'white',opacity:s.baseOp*brightMult,animation:`twinkle ${s.dur}s ease-in-out infinite alternate`,transition:'opacity .35s',boxShadow:brightMult>.75&&s.s>1?`0 0 ${s.s*4}px rgba(255,255,255,${(brightMult-.3).toFixed(2)})`:'none'}}/>
      ))}
    </div>
  );
}

// ── Écran de connexion ─────────────────────────────────────────────────────
function LoginScreen({onLogin}){
  const [name,setName]=useState('');
  return(
    <div style={{minHeight:'100vh',background:'linear-gradient(175deg,#020814,#050b1c,#080d22)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'Courier New',monospace",color:'white',padding:20,position:'relative',overflow:'hidden'}}>
      <StarField brightMult={0.5}/>
      <div style={{position:'relative',zIndex:1,textAlign:'center',maxWidth:400,width:'100%'}}>
        <div style={{fontSize:64,marginBottom:12}}>🚀</div>
        <div style={{fontSize:24,color:'#00e5ff',fontWeight:'bold',letterSpacing:4,textTransform:'uppercase',marginBottom:6}}>Mission Cosmos</div>
        <div style={{fontSize:12,color:'#3a5070',letterSpacing:2,marginBottom:36}}>Apprendre à taper au clavier</div>
        <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&name.trim()&&onLogin(name.trim())}
          placeholder="Ton prénom..." autoFocus
          style={{width:'100%',background:'#0a1428',border:'1.5px solid #1e3a60',borderRadius:12,padding:'12px 18px',color:'white',fontSize:16,fontFamily:"'Courier New',monospace",outline:'none',textAlign:'center',marginBottom:16}}/>
        <button onClick={()=>name.trim()&&onLogin(name.trim())} style={{width:'100%',background:name.trim()?'linear-gradient(135deg,#0044dd,#00ccff)':'#0a1428',color:name.trim()?'white':'#2a4060',border:'none',borderRadius:12,padding:'13px',fontSize:14,fontWeight:'bold',cursor:name.trim()?'pointer':'default',letterSpacing:3,textTransform:'uppercase',boxShadow:name.trim()?'0 0 20px #00e5ff33':'none',transition:'all .2s'}}>
          🚀 Décoller !
        </button>
      </div>
    </div>
  );
}

// ── Écran de chargement XML ────────────────────────────────────────────────
function XmlLoadScreen({playerName, onLoad}){
  const [dragging,setDragging]=useState(false);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);

  function processFile(file){
    if(!file) return;
    if(!file.name.toLowerCase().endsWith('.xml')){setError('Fichier .xml attendu');return;}
    setLoading(true); setError('');
    const reader=new FileReader();
    reader.onload=e=>{
      try{ const levels=parseXML(e.target.result); onLoad(levels); }
      catch(err){ setError(err.message); setLoading(false); }
    };
    reader.onerror=()=>{setError('Impossible de lire le fichier');setLoading(false);};
    reader.readAsText(file,'utf-8');
  }

  return(
    <div style={{minHeight:'100vh',background:'linear-gradient(175deg,#020814,#050b1c,#080d22)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'Courier New',monospace",color:'white',padding:24,position:'relative',overflow:'hidden'}}>
      <StarField brightMult={0.4}/>
      <div style={{position:'relative',zIndex:1,maxWidth:480,width:'100%',textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:12}}>📂</div>
        <div style={{fontSize:20,color:'#00e5ff',fontWeight:'bold',letterSpacing:3,marginBottom:4}}>Bienvenue, {playerName} !</div>
        <div style={{fontSize:12,color:'#3a5070',letterSpacing:1,marginBottom:32}}>Charge le fichier de niveaux pour commencer</div>

        {/* Zone de drop */}
        <div
          onDragOver={e=>{e.preventDefault();setDragging(true);}}
          onDragLeave={()=>setDragging(false)}
          onDrop={e=>{e.preventDefault();setDragging(false);processFile(e.dataTransfer.files[0]);}}
          style={{border:`2px dashed ${dragging?'#00e5ff':'#1e3a60'}`,borderRadius:16,padding:'40px 24px',marginBottom:16,background:dragging?'#0a1e34':'#040e1a',transition:'all .2s',cursor:'pointer'}}
        >
          <input type="file" accept=".xml" id="xml-input" style={{display:'none'}} onChange={e=>processFile(e.target.files[0])}/>
          <label htmlFor="xml-input" style={{cursor:'pointer',display:'block'}}>
            <div style={{fontSize:36,marginBottom:12}}>🗂️</div>
            <div style={{fontSize:13,color:dragging?'#00e5ff':'#3a5570',letterSpacing:1}}>
              {loading ? 'Chargement...' : 'Glisse le fichier XML ici'}
            </div>
            <div style={{fontSize:11,color:'#1e3050',marginTop:8}}>ou clique pour choisir</div>
          </label>
        </div>

        {error&&<div style={{color:'#ff7755',fontSize:12,marginBottom:16,padding:'8px 16px',background:'#1a0808',borderRadius:8,border:'1px solid #442222'}}>{error}</div>}

        <div style={{fontSize:10,color:'#1a2e44',letterSpacing:1,lineHeight:1.8}}>
          Fichier généré par :<br/>
          <span style={{color:'#2a4060',fontFamily:'monospace'}}>python filter_words.py wordlist.csv filters.txt output.xml</span>
        </div>
      </div>
    </div>
  );
}

// ── Sélection de niveau ────────────────────────────────────────────────────
function LevelSelect({save, levels, onPlay, onReset, onReloadXml}){
  const emojis=['🏠','🏠','🏠','🏠','🏡','🌙','🌙','⭐','⭐','✨','✨','🪐','🌌','🚀','🌠'];
  return(
    <div style={{minHeight:'100vh',background:'linear-gradient(175deg,#020814,#050b1c,#080d22)',fontFamily:"'Courier New',monospace",color:'white',padding:'20px 14px',position:'relative',overflow:'hidden'}}>
      <StarField brightMult={0.4}/>
      <div style={{position:'relative',zIndex:1,maxWidth:680,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:8}}>
          <div>
            <div style={{color:'#00e5ff',fontSize:18,fontWeight:'bold',letterSpacing:3}}>🚀 Mission Cosmos</div>
            <div style={{color:'#3a5070',fontSize:11,letterSpacing:2,marginTop:2}}>Pilote : {save.name}</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={onReloadXml} style={{background:'#0a1428',border:'1px solid #1a3050',borderRadius:8,padding:'6px 12px',color:'#3a5570',fontSize:11,cursor:'pointer',letterSpacing:1}}>📂 XML</button>
            <button onClick={onReset}     style={{background:'#0a1428',border:'1px solid #1a3050',borderRadius:8,padding:'6px 12px',color:'#334466',fontSize:11,cursor:'pointer',letterSpacing:1}}>Changer de pilote</button>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10}}>
          {levels.map((lv,i)=>{
            const unlocked=i<=save.unlocked;
            const best=save.best?.[i]||0;
            const done=best>0;
            const emoji=emojis[Math.min(i,emojis.length-1)];
            return(
              <div key={i} onClick={()=>unlocked&&onPlay(i)}
                style={{background:done?'#050e20':unlocked?'#040c1a':'#030810',border:`1.5px solid ${done?'#00e5ff33':unlocked?'#1a2e55':'#0e1e30'}`,borderRadius:14,padding:'14px 12px',cursor:unlocked?'pointer':'default',textAlign:'center',transition:'all .15s',opacity:unlocked?1:.45,boxShadow:done?'0 0 12px #00e5ff11':'none'}}>
                <div style={{fontSize:26,marginBottom:6}}>{unlocked?emoji:'🔒'}</div>
                <div style={{fontSize:11,color:done?'#00e5ff':unlocked?'#445566':'#2a3a4a',fontWeight:'bold',letterSpacing:1,marginBottom:4}}>{lv.name}</div>
                {done&&<div style={{fontSize:10,color:'#ffe600'}}>⭐ {best} pts</div>}
                {!done&&unlocked&&<div style={{fontSize:9,color:'#2a3a4a',letterSpacing:1}}>APPUYER</div>}
              </div>
            );
          })}
        </div>
        <div style={{textAlign:'center',marginTop:18,fontSize:10,color:'#1e2e40',letterSpacing:2}}>
          {save.unlocked+1}/{levels.length} niveaux débloqués
        </div>
      </div>
    </div>
  );
}

// ── Application principale ─────────────────────────────────────────────────
export default function SpaceTyping(){
  const audioRef=useRef(null), ambientRef=useRef(null), mutedRef=useRef(false);
  const [muted,setMuted]=useState(false);

  // Écrans : loading → login → xml_load → select → game
  const [screen,setScreen]=useState('loading');
  const [levels,setLevels]=useState(null);      // chargé depuis XML
  const [save,setSave]=useState({name:'',unlocked:0,best:{}});
  const [lvIdx,setLvIdx]=useState(0);

  // État de jeu
  const [phase,setPhase]=useState('playing');
  const [words,setWords]=useState([]);
  const [wordIdx,setWordIdx]=useState(0);
  const [typed,setTyped]=useState('');
  const [wrong,setWrong]=useState(false);
  const [celebrate,setCelebrate]=useState(false);
  const [score,setScore]=useState(0);
  const [wordErrors,setWordErrors]=useState(0);
  const [starBright,setStarBright]=useState(50);
  const [enginePower,setEnginePower]=useState(20);
  const [sparks,setSparks]=useState([]);
  const [wordStart,setWordStart]=useState(()=>Date.now());

  useEffect(()=>{
    const s=loadCookie();
    if(s?.name){setSave(s);setScreen('xml_load');}
    else setScreen('login');
  },[]);

  function handleLogin(name){
    const s={name,unlocked:0,best:{}};
    setSave(s); saveCookie(s); setScreen('xml_load');
  }
  function handleReset(){ clearCookie(); setSave({name:'',unlocked:0,best:{}}); setLevels(null); setScreen('login'); }
  function handleXmlLoad(lvs){ setLevels(lvs); setScreen('select'); }

  function startLevel(i){
    const lv=levels[i];
    setLvIdx(i); setWords(pickWords(lv));
    setWordIdx(0); setTyped(''); setPhase('playing'); setScore(0);
    setWordErrors(0); setStarBright(50); setEnginePower(20);
    setWordStart(Date.now()); setSparks([]); setCelebrate(false); setWrong(false);
    setScreen('game');
  }

  function handleLevelEnd(finalScore, passed){
    setSave(prev=>{
      const newUnlocked=passed?Math.max(prev.unlocked,Math.min(lvIdx+1,levels.length-1)):prev.unlocked;
      const newBest={...prev.best,[lvIdx]:Math.max(prev.best?.[lvIdx]||0,finalScore)};
      const updated={...prev,unlocked:newUnlocked,best:newBest};
      saveCookie(updated); return updated;
    });
  }

  const level       = levels?.[lvIdx] || { name:'', newKeys:new Set(), chars:new Set(), minPct:.5, ms:8 };
  const currentWord = words[wordIdx] || '';
  const nextChar    = currentWord[typed.length] || '';
  const maxScore    = words.reduce((s,w)=>s+w.length*20+20, 0);
  const minScore    = Math.round(maxScore * level.minPct);
  const progress    = (wordIdx + typed.length/(currentWord.length||1)) / (level.ms||8) * 100;
  const brightMult  = Math.max(0.08, starBright/100);

  function snd(fn){ if(!mutedRef.current) fn(getCtx(audioRef)); }
  function toggleMute(){ const m=!muted; mutedRef.current=m; setMuted(m); if(ambientRef.current) ambientRef.current.master.gain.value=m?0:0.032; }

  const handleKey=useCallback((e)=>{
    if(screen!=='game'||phase!=='playing'||celebrate) return;
    // é peut être envoyé comme Key ou comme Value selon OS
    const raw=e.key;
    const k=raw.length===1?raw.toLowerCase():null;
    if(!k) return;

    if(!ambientRef.current&&!mutedRef.current) ambientRef.current=startAmbient(getCtx(audioRef));

    if(k===nextChar){
      snd(sfxCorrect);
      const next=typed+k;
      setTyped(next);
      setStarBright(b=>Math.min(100,b+3));
      setEnginePower(p=>Math.min(100,p+2.5));

      if(next===currentWord){
        snd(sfxWordDone);
        const elapsed=(Date.now()-wordStart)/1000;
        const spd=elapsed<3?20:elapsed<6?10:0;
        const wScore=Math.max(0,currentWord.length*20-wordErrors*5+spd);
        const fin=score+wScore;
        setScore(fin); setCelebrate(true);
        setSparks(Array.from({length:14},(_,i)=>({id:Date.now()+i,a:(i/14)*360,c:i%3===0?'#00e5ff':i%3===1?'#ffe600':'#ff8c00'})));
        setEnginePower(p=>Math.min(100,p+12));

        setTimeout(()=>{
          setSparks([]); setCelebrate(false);
          if(wordIdx+1>=level.ms){
            const ok=fin>=minScore;
            handleLevelEnd(fin,ok);
            setPhase(ok?'launching':'crashing');
            if(!mutedRef.current)(ok?sfxLaunch:sfxCrash)(getCtx(audioRef));
            setTimeout(()=>setPhase(ok?'passed':'failed'),ok?3200:4200);
          }else{
            setWordIdx(i=>i+1); setTyped(''); setWordErrors(0); setWordStart(Date.now());
          }
        },700);
      }
    }else if(k.length===1&&/[a-zàâéèêëîïôùûüÿæœç]/i.test(k)){
      snd(sfxWrong);
      setWrong(true); setWordErrors(we=>we+1);
      setStarBright(b=>Math.max(10,b-6));
      setEnginePower(p=>Math.max(0,p-9));
      setTimeout(()=>setWrong(false),290);
    }
  },[screen,phase,celebrate,nextChar,typed,currentWord,wordIdx,score,wordErrors,wordStart,minScore,level.ms]);

  useEffect(()=>{window.addEventListener('keydown',handleKey);return()=>window.removeEventListener('keydown',handleKey);},[handleKey]);

  // ── Routage des écrans ─────────────────────────────────────────────────
  if(screen==='loading') return <div style={{minHeight:'100vh',background:'#020814',display:'flex',alignItems:'center',justifyContent:'center',color:'#00e5ff',fontFamily:'monospace'}}>…</div>;
  if(screen==='login')    return <LoginScreen onLogin={handleLogin}/>;
  if(screen==='xml_load') return <XmlLoadScreen playerName={save.name} onLoad={handleXmlLoad}/>;
  if(screen==='select')   return <LevelSelect save={save} levels={levels} onPlay={startLevel} onReset={handleReset} onReloadXml={()=>setScreen('xml_load')}/>;

  // ── Écran de jeu ───────────────────────────────────────────────────────
  const engColor=enginePower>60?'linear-gradient(to right,#ff8c00,#00e5ff)':enginePower>30?'linear-gradient(to right,#ff4400,#ff8c00)':'linear-gradient(to right,#cc2200,#ff4400)';

  return(
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes twinkle{from{opacity:.1;transform:scale(.7)}to{opacity:1;transform:scale(1.3)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes spark{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--tx),var(--ty)) scale(0);opacity:0}}
        @keyframes glowKey{0%,100%{box-shadow:0 0 10px #ffe60088}50%{box-shadow:0 0 24px #ffe600cc,0 0 44px #ffe60033}}
        @keyframes glowNew{0%,100%{box-shadow:0 0 8px #00ff8855}50%{box-shadow:0 0 18px #00ff88aa}}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
        @keyframes pop{0%{transform:scale(1)}40%{transform:scale(1.1)}100%{transform:scale(1)}}
        @keyframes flkr1{from{transform:translateX(-50%) scaleX(.94)}to{transform:translateX(-50%) scaleX(1.06)}}
        @keyframes flkr2{from{transform:translateX(-50%) scaleX(.88)}to{transform:translateX(-50%) scaleX(1.12)}}
        @keyframes launch{0%{transform:translateY(0)}6%{transform:translateY(-40px)}100%{transform:translateY(-240vh)}}
        @keyframes crash{0%{transform:translateY(0) rotate(0)}28%{transform:translateY(-140px) rotate(0)}58%{transform:translateY(-100px) rotate(40deg)}100%{transform:translateY(260px) rotate(88deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <div style={{width:'100%',minHeight:'100vh',background:'linear-gradient(175deg,#020814 0%,#050b1c 55%,#080d22 100%)',fontFamily:"'Courier New',Courier,monospace",color:'white',display:'flex',flexDirection:'column',alignItems:'center',padding:'16px 12px',position:'relative',overflow:'hidden'}}>
        <StarField brightMult={brightMult}/>

        {/* Overlay lancement/crash */}
        {(phase==='launching'||phase==='crashing')&&(
          <div style={{position:'fixed',inset:0,zIndex:100,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',paddingBottom:80,background:'radial-gradient(ellipse at bottom,#080e20,#020814)'}}>
            {phase==='launching'&&<div style={{position:'absolute',bottom:50,width:180,height:30,background:'radial-gradient(ellipse,#ff880088,transparent 70%)',animation:'pulse .3s ease-in-out infinite'}}/>}
            <div style={{animation:`${phase==='launching'?'launch 2.9s cubic-bezier(.4,0,1,1)':'crash 3.9s ease-in-out'} forwards`}}>
              <Rocket power={phase==='launching'?100:enginePower} w={90} h={168}/>
            </div>
            <div style={{position:'absolute',bottom:24,color:phase==='launching'?'#00e5ff':'#ff7755',fontSize:15,letterSpacing:4,textTransform:'uppercase',animation:'pulse .45s ease-in-out infinite',textShadow:phase==='launching'?'0 0 20px #00e5ff':'0 0 20px #ff4400'}}>
              {phase==='launching'?'🚀 Décollage !':'⚠️ Puissance insuffisante...'}
            </div>
          </div>
        )}

        <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:660}}>
          {/* Header */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <button onClick={()=>setScreen('select')} style={{background:'#080f1e',border:'1px solid #1a3050',borderRadius:8,padding:'4px 10px',color:'#3a5570',cursor:'pointer',fontSize:13}}>← Niveaux</button>
              <div style={{color:'#00e5ff',fontSize:14,fontWeight:'bold',letterSpacing:2}}>{level.name}</div>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <div style={{background:'#080f1e',border:'1px solid #1a3050',borderRadius:8,padding:'4px 10px',fontSize:11,color:'#3a5570'}}>Min <span style={{color:'#ffe600'}}>{minScore}</span></div>
              <div style={{background:'#080f1e',border:'1px solid #ffe60033',borderRadius:8,padding:'4px 10px',color:'#ffe600',fontSize:16,fontWeight:'bold'}}>⭐ {score}</div>
              <button onClick={toggleMute} style={{background:'#080f1e',border:'1px solid #1a3050',borderRadius:8,padding:'4px 10px',color:'#3a5570',cursor:'pointer',fontSize:14}}>{muted?'🔇':'🔊'}</button>
            </div>
          </div>

          {/* Barre de progression */}
          <div style={{marginBottom:14}}>
            <div style={{height:7,background:'#060f1e',border:'1px solid #1a2e55',borderRadius:8,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${progress}%`,background:'linear-gradient(to right,#0033cc,#00e5ff)',transition:'width .4s ease',boxShadow:'0 0 8px #00e5ff44'}}/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:3,fontSize:10,color:'#1e3050',letterSpacing:2,textTransform:'uppercase'}}>
              <span>Départ</span><span>{wordIdx}/{level.ms}</span><span>🪐</span>
            </div>
          </div>

          {/* Résultat réussi */}
          {phase==='passed'&&(
            <div style={{textAlign:'center',padding:'28px 16px',animation:'fadeIn .7s ease-out forwards'}}>
              <div style={{fontSize:52,marginBottom:12}}>🎉🚀⭐</div>
              <div style={{fontSize:22,color:'#ffe600',fontWeight:'bold',letterSpacing:3,marginBottom:8}}>NIVEAU RÉUSSI !</div>
              <div style={{fontSize:15,color:'#00e5ff',marginBottom:6}}>Score : <strong style={{color:'#ffe600',fontSize:20}}>{score}</strong> / {maxScore} pts</div>
              <div style={{fontSize:12,color:'#3a5060',marginBottom:28}}>Minimum requis : {minScore} pts ✅</div>
              <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
                <button onClick={()=>startLevel(lvIdx)} style={{background:'#080f1e',color:'#4a6080',border:'1.5px solid #1a3050',borderRadius:10,padding:'10px 20px',fontSize:12,fontWeight:'bold',cursor:'pointer',letterSpacing:2,textTransform:'uppercase'}}>🔁 Rejouer</button>
                <button onClick={()=>setScreen('select')} style={{background:'linear-gradient(135deg,#0044dd,#00ccff)',color:'white',border:'none',borderRadius:10,padding:'10px 24px',fontSize:12,fontWeight:'bold',cursor:'pointer',letterSpacing:2,textTransform:'uppercase',boxShadow:'0 0 20px #00e5ff44'}}>📋 Niveaux</button>
                {lvIdx+1<levels.length&&save.unlocked>lvIdx&&(
                  <button onClick={()=>startLevel(lvIdx+1)} style={{background:'linear-gradient(135deg,#00aa44,#00e5ff)',color:'white',border:'none',borderRadius:10,padding:'10px 24px',fontSize:12,fontWeight:'bold',cursor:'pointer',letterSpacing:2,textTransform:'uppercase',boxShadow:'0 0 20px #00e5ff44'}}>⬆️ Suivant</button>
                )}
              </div>
            </div>
          )}

          {/* Résultat raté */}
          {phase==='failed'&&(
            <div style={{textAlign:'center',padding:'28px 16px',animation:'fadeIn .7s ease-out forwards'}}>
              <div style={{fontSize:52,marginBottom:12}}>💥😅🔧</div>
              <div style={{fontSize:22,color:'#ff6644',fontWeight:'bold',letterSpacing:3,marginBottom:8}}>RETOUR AU SOL...</div>
              <div style={{fontSize:15,color:'#998888',marginBottom:6}}>Score : <strong style={{color:'#ff9966',fontSize:20}}>{score}</strong> pts</div>
              <div style={{fontSize:12,color:'#5a3333',marginBottom:28}}>Il fallait {minScore} pts — encore un effort ! 💪</div>
              <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
                <button onClick={()=>startLevel(lvIdx)} style={{background:'linear-gradient(135deg,#bb3300,#ff5500)',color:'white',border:'none',borderRadius:10,padding:'10px 24px',fontSize:12,fontWeight:'bold',cursor:'pointer',letterSpacing:2,textTransform:'uppercase',boxShadow:'0 0 18px #ff440033'}}>🔁 Réessayer</button>
                <button onClick={()=>setScreen('select')} style={{background:'#080f1e',color:'#4a6080',border:'1.5px solid #1a3050',borderRadius:10,padding:'10px 20px',fontSize:12,fontWeight:'bold',cursor:'pointer',letterSpacing:2,textTransform:'uppercase'}}>📋 Niveaux</button>
              </div>
            </div>
          )}

          {/* Interface de jeu */}
          {phase==='playing'&&(
            <>
              {/* Moteur + fusée */}
              <div style={{display:'flex',gap:14,alignItems:'flex-end',marginBottom:14}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#2a4060',letterSpacing:2,marginBottom:5,textTransform:'uppercase'}}>
                    <span>🔥 Puissance moteur</span>
                    <span style={{color:enginePower>60?'#00e5ff':enginePower>30?'#ffe600':'#ff6644',transition:'color .5s'}}>{Math.round(enginePower)}%</span>
                  </div>
                  <div style={{height:8,background:'#060f1e',border:'1px solid #1a2e55',borderRadius:8,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${enginePower}%`,background:engColor,transition:'width .2s ease',boxShadow:`0 0 8px ${enginePower>60?'#00e5ff55':'#ff660055'}`}}/>
                  </div>
                  <div style={{fontSize:9,color:'#1c2e42',marginTop:3,letterSpacing:1}}>
                    {score>=minScore?'✅ Minimum atteint !':` Encore ${minScore-score} pts`}
                  </div>
                </div>
                <div style={{flexShrink:0,paddingBottom:2}}><Rocket power={enginePower} w={44} h={82}/></div>
              </div>

              {/* Mot */}
              <div style={{background:'#030e1c',border:`1.5px solid ${wrong?'#ff444466':celebrate?'#00e5ff55':'#142540'}`,borderRadius:16,padding:'22px 14px',textAlign:'center',marginBottom:16,position:'relative',boxShadow:wrong?'0 0 18px #ff220022':celebrate?'0 0 18px #00e5ff22':'none',transition:'border-color .2s,box-shadow .2s',animation:wrong?'shake .29s ease':celebrate?'pop .5s ease':'none'}}>
                <div style={{fontSize:10,color:'#1e3050',letterSpacing:3,marginBottom:16,textTransform:'uppercase'}}>Mot {wordIdx+1} / {level.ms}</div>
                <div style={{display:'flex',justifyContent:'center',gap:6,flexWrap:'wrap'}}>
                  {currentWord.split('').map((ch,i)=>{
                    const done=i<typed.length, next=i===typed.length;
                    return(<div key={i} style={{width:48,height:58,borderRadius:10,border:`2px solid ${done?'#00e5ff88':next?'#ffe60099':'#142540'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,fontWeight:'bold',color:done?'#00e5ff':next?'#ffe600':'#1a2e48',background:done?'#001a34':next?'#1a1400':'#040e1a',transition:'all .12s ease',boxShadow:next?'0 0 14px #ffe60044':done?'0 0 6px #00e5ff22':'none',animation:next?'pulse 1s ease-in-out infinite':'none',textTransform:'uppercase',userSelect:'none'}}>{ch.toUpperCase()}</div>);
                  })}
                </div>
                {sparks.map(p=>(<div key={p.id} style={{position:'absolute',top:'50%',left:'50%',width:8,height:8,borderRadius:'50%',background:p.c,'--tx':`${Math.cos(p.a*Math.PI/180)*85}px`,'--ty':`${Math.sin(p.a*Math.PI/180)*85}px`,animation:'spark .75s ease-out forwards',pointerEvents:'none'}}/>))}
                {wrong&&<div style={{position:'absolute',bottom:9,left:'50%',transform:'translateX(-50%)',color:'#ff6666',fontSize:11,letterSpacing:1,whiteSpace:'nowrap'}}>✗ Réessaie !</div>}
              </div>

              {/* Clavier QWERTZ (é inclus) */}
              <div style={{background:'#030e1c',border:'1.5px solid #142540',borderRadius:16,padding:'13px 10px'}}>
                {KEYBOARD_ROWS.map((row,ri)=>(
                  <div key={ri} style={{display:'flex',justifyContent:'center',gap:5,marginBottom:ri<2?7:0}}>
                    {row.map(key=>{
                      const isTarget=key===nextChar;
                      const isNew=level.newKeys.has(key);
                      const inLevel=level.chars.has(key);
                      const isBump=BUMP_KEYS.has(key);
                      return(<div key={key} style={{width:key==='é'?47:43,height:43,borderRadius:8,border:`1.5px solid ${isTarget?'#ffe600':isNew?'#00aa55':inLevel?'#1c3858':'#0a1622'}`,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:1,fontSize:14,fontWeight:'bold',color:isTarget?'#1a1200':isNew?'#00cc66':inLevel?'#26445e':'#0e1a28',background:isTarget?'#ffe600':isNew?'#001a0e':inLevel?'#070d1a':'#040810',textTransform:'uppercase',transition:'all .12s ease',animation:isTarget?'glowKey 1s ease-in-out infinite':isNew?'glowNew 2s ease-in-out infinite':'none',userSelect:'none',position:'relative',opacity:inLevel?1:.35}}>
                        {key}
                        {isBump&&<div style={{width:4,height:4,borderRadius:'50%',background:isTarget?'#1a1200':'#1e3a60',position:'absolute',bottom:4}}/>}
                      </div>);
                    })}
                  </div>
                ))}
                <div style={{display:'flex',justifyContent:'center',gap:16,marginTop:10,fontSize:10,color:'#182a3e',letterSpacing:1,flexWrap:'wrap'}}>
                  <span><span style={{display:'inline-block',width:8,height:8,borderRadius:2,background:'#00aa55',marginRight:5,verticalAlign:'middle'}}/>Nouvelles touches</span>
                  <span><span style={{display:'inline-block',width:8,height:8,borderRadius:2,background:'#1c3858',marginRight:5,verticalAlign:'middle'}}/>Déjà apprises</span>
                  <span><span style={{display:'inline-block',width:8,height:8,borderRadius:2,background:'#ffe600',marginRight:5,verticalAlign:'middle'}}/>Prochaine touche</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
