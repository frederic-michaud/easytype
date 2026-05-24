export function getCtx(r) {
  if (!r.current) r.current = new (window.AudioContext || window.webkitAudioContext)();
  if (r.current.state === 'suspended') r.current.resume();
  return r.current;
}

export const sfxCorrect = ctx => {
  const t = ctx.currentTime;
  [523, 659].forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.12, t + i * .065);
    g.gain.exponentialRampToValueAtTime(.001, t + i * .065 + .2);
    o.start(t + i * .065); o.stop(t + i * .065 + .22);
  });
};

export const sfxWrong = ctx => {
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(200, t);
  o.frequency.exponentialRampToValueAtTime(80, t + .18);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(.001, t + .22);
  o.start(t); o.stop(t + .24);
};

export const sfxWordDone = ctx => {
  const t = ctx.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.18, t + i * .075);
    g.gain.exponentialRampToValueAtTime(.001, t + i * .075 + .3);
    o.start(t + i * .075); o.stop(t + i * .075 + .32);
  });
};

export const sfxLaunch = ctx => {
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const fl = ctx.createBiquadFilter(); fl.type = 'lowpass';
  fl.frequency.setValueAtTime(120, t); fl.frequency.linearRampToValueAtTime(600, t + 2.8);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(.001, t + 3);
  src.connect(fl); fl.connect(g); g.connect(ctx.destination); src.start(t);
  const o = ctx.createOscillator(), og = ctx.createGain();
  o.connect(og); og.connect(ctx.destination);
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(55, t); o.frequency.exponentialRampToValueAtTime(350, t + 2.8);
  og.gain.setValueAtTime(0.22, t); og.gain.exponentialRampToValueAtTime(.001, t + 3);
  o.start(t); o.stop(t + 3);
};

export const sfxCrash = ctx => {
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), og = ctx.createGain();
  o.connect(og); og.connect(ctx.destination);
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(200, t + .9);
  o.frequency.exponentialRampToValueAtTime(25, t + 2.2);
  og.gain.setValueAtTime(0.2, t); og.gain.setValueAtTime(0.2, t + .9);
  og.gain.exponentialRampToValueAtTime(.001, t + 2.5);
  o.start(t); o.stop(t + 2.6);
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .5), ctx.sampleRate);
  const db = buf.getChannelData(0);
  for (let i = 0; i < db.length; i++) db[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 80;
  const gg = ctx.createGain();
  gg.gain.setValueAtTime(0.5, t + 2.8); gg.gain.exponentialRampToValueAtTime(.001, t + 3.4);
  src.connect(fl); fl.connect(gg); gg.connect(ctx.destination); src.start(t + 2.8);
};

export function startAmbient(ctx) {
  const m = ctx.createGain(); m.gain.value = 0.032; m.connect(ctx.destination);
  [55, 82.5, 110, 165].forEach(f => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    o.connect(m); o.start();
  });
  const lf = ctx.createOscillator(), lg = ctx.createGain();
  lf.frequency.value = 0.12; lg.gain.value = 4; lf.connect(lg);
  return { master: m };
}
