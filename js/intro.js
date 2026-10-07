// NOVEXYT intro: the full 10-panel cinematic (first visit, ~10 s, skippable) and the 2-3 s sting (every visit after).
//   await cinematic(root, { onSkipButton })   -> resolves when done or skipped
//   await sting(root, name)                     -> the short version with "WELCOME BACK, NAME"
import { GAMES, GENRES } from './games.js';

const LOGO = 'assets/brand/novexyt-logo.png', MARK = 'assets/brand/novexyt-mark.png';
const CSS = `
.nx-intro{position:fixed;inset:0;z-index:520;background:#020108;overflow:hidden;font-family:Orbitron,var(--f-d,sans-serif);color:#fff;cursor:default}
.nx-intro canvas{position:absolute;inset:0;width:100%;height:100%}
.nx-layer{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;text-align:center}
.nx-scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 1px,transparent 1px 3px);pointer-events:none;mix-blend-mode:overlay}
.nx-vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.85));pointer-events:none}
.nx-sys{font-family:var(--f-m,monospace);font-size:clamp(12px,1.6vw,16px);letter-spacing:4px;color:#7ff0ff;opacity:0}
.nx-mark{width:min(46vmin,360px);filter:drop-shadow(0 0 28px rgba(140,90,255,.75));opacity:0;transform:scale(2.6)}
.nx-mark.in{animation:nxSlam .55s cubic-bezier(.2,1.4,.4,1) forwards}
.nx-mark.glitch{animation:nxGlitch .25s steps(2) 3;opacity:1;transform:none}
@keyframes nxSlam{0%{opacity:0;transform:scale(2.6);filter:blur(12px) drop-shadow(0 0 28px #8c5aff)}60%{opacity:1;filter:blur(0) drop-shadow(0 0 40px #ff2bd6)}100%{opacity:1;transform:scale(1);filter:drop-shadow(0 0 28px rgba(140,90,255,.75))}}
@keyframes nxGlitch{0%{transform:translate(-6px,2px);filter:drop-shadow(-6px 0 #22e6ff) drop-shadow(6px 0 #ff2bd6)}50%{transform:translate(5px,-2px)}100%{transform:none}}
.nx-word{display:flex;gap:.06em;font-weight:900;font-size:clamp(36px,9vw,110px);letter-spacing:.08em;margin-top:2vmin}
.nx-word span{opacity:0;color:#fff;text-shadow:0 0 18px #8c5aff,0 0 42px #ff2bd6;transform:translateY(20px)}
.nx-word span.on{opacity:1;transform:none;transition:all .18s ease-out}
.nx-word span.cy{background:linear-gradient(180deg,#9ff6ff,#22b8ff);-webkit-background-clip:text;background-clip:text;color:transparent}
.nx-word span.pk{background:linear-gradient(180deg,#ff9af0,#c13bff);-webkit-background-clip:text;background-clip:text;color:transparent}
.nx-sub{display:flex;align-items:center;gap:18px;font-size:clamp(14px,2.4vw,24px);letter-spacing:.9em;color:#d8d0ff;margin-top:1vmin;opacity:0}
.nx-sub i{display:block;height:2px;width:0;background:linear-gradient(90deg,transparent,#22e6ff,#ff2bd6,transparent);transition:width .6s ease-out}
.nx-count{margin-top:3vmin;font-size:clamp(12px,1.8vw,18px);letter-spacing:6px;color:#7ff0ff;opacity:0}
.nx-wall{position:absolute;inset:-10% -20%;display:flex;flex-direction:column;justify-content:center;gap:2vmin;transform:rotate(-8deg);opacity:0}
.nx-row{display:flex;gap:2vmin;white-space:nowrap}
.nx-row img{height:15vmin;border-radius:1.2vmin;box-shadow:0 0 18px rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.12)}
.nx-genre{font-weight:900;font-size:clamp(46px,12vw,150px);letter-spacing:.06em;opacity:0}
.nx-three{display:flex;gap:4vw;opacity:0}
.nx-three div{display:flex;flex-direction:column;align-items:center;gap:1.4vmin;font-size:clamp(13px,2vw,20px);letter-spacing:4px;transform:scale(.6);opacity:0;transition:all .35s cubic-bezier(.2,1.5,.4,1)}
.nx-three div.on{transform:none;opacity:1}
.nx-three b{font-size:clamp(40px,8vmin,80px);filter:drop-shadow(0 0 16px #8c5aff)}
.nx-logo{width:min(56vmin,440px);border-radius:12%;opacity:0;position:relative;box-shadow:0 0 60px rgba(140,90,255,.5),0 0 120px rgba(255,43,214,.3)}
.nx-sweep{position:absolute;inset:0;border-radius:12%;overflow:hidden;pointer-events:none}
.nx-sweep::after{content:'';position:absolute;top:-20%;bottom:-20%;width:30%;left:-40%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-18deg)}
.nx-sweep.go::after{animation:nxSweep .9s ease-in-out forwards}
@keyframes nxSweep{to{left:120%}}
.nx-ready{font-weight:900;font-size:clamp(26px,6vw,64px);letter-spacing:.12em;opacity:0}
.nx-skip{position:fixed;right:18px;bottom:18px;z-index:530;background:rgba(10,8,24,.6);border:1px solid rgba(255,255,255,.25);color:#d8d0ff;font-family:var(--f-m,monospace);letter-spacing:3px;padding:10px 16px;border-radius:8px;cursor:pointer}
.nx-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
`;
let cssDone = false;
const css = () => { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- background: a neon grid floor rushing toward you + sparks ----------
function background(cv) {
  const c = cv.getContext('2d'); let W = 0, H = 0, t0 = performance.now(), run = true;
  const st = { speed: 0, grid: 0, glow: 0, hue: 0 };
  const sparks = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random(), s: 0.3 + Math.random() }));
  const resize = () => { W = cv.width = innerWidth * Math.min(2, devicePixelRatio || 1); H = cv.height = innerHeight * Math.min(2, devicePixelRatio || 1); };
  resize(); addEventListener('resize', resize);
  const frame = () => {
    if (!run) return;
    const t = (performance.now() - t0) / 1000;
    c.fillStyle = '#020108'; c.fillRect(0, 0, W, H);
    // horizon glow
    const hz = H * 0.58, g = c.createRadialGradient(W / 2, hz, 0, W / 2, hz, W * 0.7);
    g.addColorStop(0, `rgba(140,90,255,${0.28 * st.glow})`); g.addColorStop(0.5, `rgba(255,43,214,${0.1 * st.glow})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (st.grid > 0) {
      c.save(); c.globalAlpha = st.grid; c.lineWidth = Math.max(1, H / 600);
      // receding horizontal lines
      for (let i = 0; i < 24; i++) {
        const z = ((i + (t * st.speed * 2) % 1) / 24), y = hz + (H - hz) * Math.pow(z, 2.2);
        c.strokeStyle = `rgba(${34 + 200 * z},${230 - 140 * z},255,${0.15 + 0.6 * z})`; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      }
      // vertical lines to the vanishing point
      for (let k = -16; k <= 16; k++) { c.strokeStyle = `rgba(160,110,255,${0.35 - Math.abs(k) * 0.012})`; c.beginPath(); c.moveTo(W / 2 + k * W * 0.012, hz); c.lineTo(W / 2 + k * W * 0.16, H); c.stroke(); }
      c.restore();
    }
    // sparks flying out of the centre
    for (const p of sparks) {
      p.z -= 0.004 * (0.3 + st.speed * 2) * p.s; if (p.z <= 0.02) { p.z = 1; p.x = Math.random(); p.y = Math.random(); }
      const x = W / 2 + (p.x - 0.5) * W / p.z * 0.35, y = H * 0.5 + (p.y - 0.5) * H / p.z * 0.35, r = (1 - p.z) * 3 * (H / 800);
      if (x < 0 || x > W || y < 0 || y > H) continue;
      c.fillStyle = p.s > 0.9 ? '#ff9af0' : '#9ff6ff'; c.globalAlpha = Math.min(1, (1 - p.z) * 1.4) * (0.3 + st.glow * 0.7); c.fillRect(x, y, r, r); c.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  };
  frame();
  return { st, stop: () => { run = false; removeEventListener('resize', resize); } };
}

// ---------- soundtrack: 120 bpm synth, a riser, and a big chord when the logo lands ----------
function music() {
  let ac;
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return { stop() {}, hit() {} }; }
  const out = ac.createGain(); out.gain.value = 0.55; out.connect(ac.destination);
  const now = ac.currentTime + 0.05, beat = 0.5;
  const note = (f, t, d, type = 'sawtooth', v = 0.08, cut = 2200) => { const o = ac.createOscillator(), g = ac.createGain(), fl = ac.createBiquadFilter(); o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cut; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(fl).connect(g).connect(out); o.start(t); o.stop(t + d + 0.05); };
  const kick = (t) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g).connect(out); o.start(t); o.stop(t + 0.3); };
  const A = [55, 55, 65.4, 49], arp = [440, 523.3, 659.3, 880, 659.3, 523.3];
  for (let i = 0; i < 20; i++) {
    const t = now + i * beat;
    if (i >= 2) kick(t);
    note(A[Math.floor(i / 4) % 4] * 2, t, 0.45, 'sawtooth', 0.07, 600);
    if (i >= 4) for (let k = 0; k < 4; k++) note(arp[(i * 4 + k) % arp.length] * (i >= 12 ? 2 : 1), t + k * beat / 4, 0.12, 'square', 0.025, 3000);
  }
  // riser into the logo
  const r = ac.createOscillator(), rg = ac.createGain(); r.type = 'sawtooth'; r.frequency.setValueAtTime(200, now + 6); r.frequency.exponentialRampToValueAtTime(1600, now + 8.1); rg.gain.setValueAtTime(0, now + 6); rg.gain.linearRampToValueAtTime(0.04, now + 8); rg.gain.linearRampToValueAtTime(0, now + 8.15); r.connect(rg).connect(out); r.start(now + 6); r.stop(now + 8.3);
  return {
    hit(at = 0) { const t = ac.currentTime + at; [110, 164.8, 220, 277.2, 329.6].forEach((f) => note(f, t, 2.2, 'sawtooth', 0.06, 1800)); kick(t); },
    stop(fade = 0.6) { try { out.gain.setTargetAtTime(0, ac.currentTime, fade / 3); setTimeout(() => ac.close(), fade * 1000 + 200); } catch (e) {} },
  };
}

// ---------- the 10-panel cinematic ----------
export async function cinematic(root) {
  css();
  const el = document.createElement('div'); el.className = 'nx-intro';
  el.innerHTML = `<canvas></canvas><div class="nx-layer" data-l></div><div class="nx-scan"></div><div class="nx-vig"></div><div class="nx-flash"></div>`;
  root.appendChild(el);
  const bg = background(el.querySelector('canvas')), L = el.querySelector('[data-l]'), flash = el.querySelector('.nx-flash');
  const snd = music();
  let skipped = false, done;
  const finished = new Promise((r) => (done = r));
  const skip = document.createElement('button'); skip.className = 'nx-skip'; skip.textContent = 'SKIP ▸▸'; document.body.appendChild(skip);
  const end = () => { if (skipped) return; skipped = true; done(); };
  skip.onclick = end; const key = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') end(); }; addEventListener('keydown', key);
  const w = (ms) => Promise.race([sleep(ms), finished]);
  const flashIt = (o = 0.8) => { flash.style.transition = 'none'; flash.style.opacity = o; requestAnimationFrame(() => { flash.style.transition = 'opacity .45s'; flash.style.opacity = 0; }); };
  const name = 'NOVEXYT';
  (async () => {
    // (the N mark shrinks a little when the name appears under it)
    // 1. system flicker
    L.innerHTML = `<div class="nx-sys">NOVEXYT SYSTEMS · BOOTING</div>`;
    const sys = L.firstChild; for (let k = 0; k < 4 && !skipped; k++) { sys.style.opacity = k % 2 ? 0.2 : 1; await w(110); } sys.style.opacity = 1; await w(350);
    // 2. the grid rushes in
    sys.style.transition = 'opacity .3s'; sys.style.opacity = 0;
    bg.st.grid = 0.0; for (let k = 0; k <= 20 && !skipped; k++) { bg.st.grid = k / 20; bg.st.glow = k / 20; bg.st.speed = k / 20; await w(35); }
    await w(200);
    // 3. the mark slams in
    L.innerHTML = `<img class="nx-mark" src="${MARK}" alt="">`;
    const mark = L.firstChild; await w(30); mark.classList.add('in'); await w(330); flashIt(0.5); await w(450);
    mark.style.opacity = 1; mark.style.transform = 'none'; mark.classList.remove('in'); mark.classList.add('glitch'); await w(500);   // keep it visible once landed
    // 4. NOVEXYT ignites letter by letter
    L.insertAdjacentHTML('beforeend', `<div class="nx-word">${name.split('').map((c, i) => `<span class="${i < 5 ? 'cy' : 'pk'}">${c}</span>`).join('')}</div>`);
    mark.style.transition = 'width .4s'; mark.style.width = 'min(30vmin,240px)';
    for (const s of L.querySelectorAll('.nx-word span')) { if (skipped) break; s.classList.add('on'); await w(95); }
    // 5. ARCADE + the count
    L.insertAdjacentHTML('beforeend', `<div class="nx-sub"><i></i><span>ARCADE</span><i></i></div><div class="nx-count">${GAMES.length}+ GAMES · SOLO · PARTY · 3D</div>`);
    const sub = L.querySelector('.nx-sub'); sub.style.transition = 'opacity .3s'; sub.style.opacity = 1; await w(40); sub.querySelectorAll('i').forEach((i) => (i.style.width = 'min(18vw,160px)'));
    await w(380); const cnt = L.querySelector('.nx-count'); cnt.style.transition = 'opacity .3s'; cnt.style.opacity = 1; await w(650);
    // 6. a wall of real game covers flies past
    const covers = GAMES.filter((g) => g.cover).sort(() => Math.random() - 0.5).slice(0, 27).map((g) => g.cover);
    L.innerHTML = `<div class="nx-wall">${[0, 1, 2].map((r) => `<div class="nx-row" style="transform:translateX(${r % 2 ? -30 : 10}%)">${covers.slice(r * 9, r * 9 + 9).concat(covers.slice(r * 9, r * 9 + 9)).map((c) => `<img src="${c}" alt="">`).join('')}</div>`).join('')}</div>`;
    const wall = L.firstChild; wall.style.transition = 'opacity .25s'; requestAnimationFrame(() => (wall.style.opacity = 1));
    wall.querySelectorAll('.nx-row').forEach((row, r) => { row.style.transition = 'transform 1.6s linear'; requestAnimationFrame(() => (row.style.transform = `translateX(${r % 2 ? 10 : -30}%)`)); });
    bg.st.speed = 1.6; await w(1350);
    // 7. genres flash
    wall.style.opacity = 0; await w(150);
    for (const g of GENRES.slice(0, 5).concat([{ name: '3D', color: '#ffffff' }])) {
      if (skipped) break;
      L.innerHTML = `<div class="nx-genre" style="color:${g.color};text-shadow:0 0 30px ${g.color}">${g.name}</div>`; const x = L.firstChild; x.style.opacity = 1; x.style.transform = 'scale(1.15)'; x.style.transition = 'transform .17s'; requestAnimationFrame(() => (x.style.transform = 'scale(1)'));
      await w(185);
    }
    // 8. solo / party / 3D
    L.innerHTML = `<div class="nx-three"><div><b>🎮</b>PLAY SOLO</div><div><b>👥</b>PARTY UP</div><div><b>🧊</b>GO 3D</div></div>`;
    const three = L.firstChild; three.style.opacity = 1; bg.st.speed = 0.8;
    for (const d of three.children) { if (skipped) break; d.classList.add('on'); await w(260); } await w(450);
    // 9. the full logo with a light sweep + the chord
    L.innerHTML = `<div style="position:relative"><img class="nx-logo" src="${LOGO}" alt="NOVEXYT ARCADE"><div class="nx-sweep"></div></div>`;
    const logo = L.querySelector('.nx-logo'); logo.style.transition = 'opacity .35s, transform .6s cubic-bezier(.2,1.3,.4,1)'; logo.style.transform = 'scale(.85)';
    snd.hit(0.05); flashIt(0.9); await w(60); logo.style.opacity = 1; logo.style.transform = 'scale(1)'; await w(250); L.querySelector('.nx-sweep').classList.add('go'); bg.st.glow = 1.4; await w(1300);
    // 10. ready?
    L.insertAdjacentHTML('beforeend', `<div class="nx-ready" style="margin-top:3vmin">READY, PLAYER?</div>`);
    const rd = L.querySelector('.nx-ready'); rd.style.transition = 'opacity .3s'; rd.style.opacity = 1; await w(900);
    end();
  })();
  await finished;
  removeEventListener('keydown', key); skip.remove(); snd.stop(skipped ? 0.3 : 0.9);
  el.style.transition = 'opacity .45s'; el.style.opacity = 0; await sleep(450); bg.stop(); el.remove();
}

// ---------- the short sting: logo flash + welcome back ----------
export async function sting(root, name) {
  css();
  const el = document.createElement('div'); el.className = 'nx-intro';
  el.innerHTML = `<canvas></canvas><div class="nx-layer"><img class="nx-mark" src="${MARK}" alt="" style="width:min(30vmin,220px)"><div class="nx-ready" style="margin-top:3vmin;font-size:clamp(14px,2.4vw,22px);letter-spacing:.4em;color:#d8d0ff">WELCOME BACK</div><div class="nx-ready" data-n style="font-size:clamp(28px,6vw,60px)"></div></div><div class="nx-scan"></div><div class="nx-vig"></div>`;
  root.appendChild(el);
  const bg = background(el.querySelector('canvas')); bg.st.grid = 1; bg.st.glow = 1; bg.st.speed = 0.7;
  const mark = el.querySelector('.nx-mark'), rows = el.querySelectorAll('.nx-ready'), n = el.querySelector('[data-n]');
  await sleep(30); mark.classList.add('in'); await sleep(450);
  rows.forEach((r) => { r.style.transition = 'opacity .3s'; r.style.opacity = 1; });
  for (let i = 0; i < name.length; i++) { n.textContent = name.slice(0, i + 1); await sleep(Math.max(25, 500 / name.length)); }
  await sleep(1000);
  el.style.transition = 'opacity .4s'; el.style.opacity = 0; await sleep(400); bg.stop(); el.remove();
}
