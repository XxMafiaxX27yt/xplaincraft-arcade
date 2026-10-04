// Tiny synthesized UI sounds (no audio files needed). Sound packs change the voice.

let ctx = null;
let enabled = true;
let volume = 0.6;
let pack = 'synth';

// type = oscillator wave, m = pitch multiplier, len = length multiplier, slide = pitch bend
const PACKS = {
  synth: { type: 'square', m: 1, len: 1 },
  '8bit': { type: 'square', m: 1.5, len: 0.7, steps: true },
  bubbles: { type: 'sine', m: 1.2, len: 1.3, bubble: true },
  keys: { type: 'triangle', m: 2.6, len: 0.35 },
  glass: { type: 'sine', m: 2.2, len: 1.8 },
  scifi: { type: 'sawtooth', m: 0.9, len: 1.1, bubble: true },
  horror: { type: 'sawtooth', m: 0.45, len: 1.6, detune: true },
  piano: { type: 'triangle', m: 1, len: 2.2 },
};

export function configureSfx({ sfx = true, volume: v = 0.6 } = {}) {
  enabled = sfx;
  volume = v;
}
export function setSoundPack(id) {
  pack = PACKS[id] ? id : 'synth';
}

function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type, gain = 0.05, slide = 0, delay = 0, raw = false, usePack = pack } = {}) {
  if (!enabled || volume <= 0) return;
  const c = ac();
  if (!c) return;
  const P = raw ? { type: type || 'square', m: 1, len: 1 } : PACKS[usePack];
  const f = freq * P.m;
  const d = dur * P.len;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = raw ? type || 'square' : P.type;
  if (P.detune) o.detune.setValueAtTime(-30 + Math.random() * 60, t);
  o.frequency.setValueAtTime(f, t);
  const sl = P.bubble ? Math.abs(slide || f * 0.8) : slide;
  if (sl) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + sl), t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain * volume, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + d + 0.02);
}

export const sfx = {
  unlock: () => ac(),
  hover: () => tone(2200, 0.025, { gain: 0.02 }),
  click: () => tone(720, 0.06, { gain: 0.04, slide: 300 }),
  back: () => tone(520, 0.07, { gain: 0.035, slide: -200 }),
  type: () => tone(1400 + Math.random() * 400, 0.015, { raw: true, gain: 0.012 }),
  ok: () => [523, 784, 1046].forEach((f, i) => tone(f, 0.09, { gain: 0.05, delay: i * 0.06 })),
  err: () => tone(160, 0.22, { raw: true, type: 'sawtooth', gain: 0.05, slide: -60 }),
  coin: () => {
    tone(988, 0.07, { gain: 0.035 });
    tone(1319, 0.18, { gain: 0.035, delay: 0.07 });
  },
  level: () => [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, { raw: true, type: 'triangle', gain: 0.06, delay: i * 0.08 })),
  boot: () => {
    tone(80, 0.6, { raw: true, type: 'sawtooth', gain: 0.05, slide: 600 });
    tone(1600, 0.05, { raw: true, type: 'sine', gain: 0.03, delay: 0.55 });
  },
  whoosh: () => tone(200, 0.35, { raw: true, type: 'sine', gain: 0.05, slide: 900 }),
  reel: () => tone(1800, 0.02, { raw: true, type: 'square', gain: 0.015 }),
  rare: (w = 0) => [523, 659, 784, 1046, 1319, 1568, 2093].slice(0, 3 + w).forEach((f, i) => tone(f, 0.12, { raw: true, type: 'triangle', gain: 0.05, delay: i * 0.07 })),
  demo: (id) => {
    const keep = pack;
    pack = PACKS[id] ? id : 'synth';
    sfx.click();
    setTimeout(() => sfx.ok(), 140);
    pack = keep;
  },
};

// Sound pack previews in the shop
document.addEventListener('pointerdown', (e) => {
  const d = e.target.closest?.('[data-sound-demo]');
  if (d) {
    sfx.unlock();
    const keep = pack;
    pack = PACKS[d.dataset.soundDemo] ? d.dataset.soundDemo : 'synth';
    sfx.click();
    setTimeout(() => {
      const k2 = pack;
      pack = d.dataset.soundDemo;
      sfx.ok();
      pack = k2;
    }, 140);
    pack = keep;
  }
});
