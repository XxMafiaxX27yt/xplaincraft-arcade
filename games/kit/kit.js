/* XC Game Kit — shared engine for every arcade game.
 *
 * K.game({
 *   title, how, bg, scoreLabel,
 *   init(s)            fresh state for each run (s is an empty object you fill)
 *   update(s, dt)      dt in seconds
 *   draw(s, c)         c = 2D context in 960x540 logical pixels
 *   ai(s, dt)          optional: autoplay for title screen / covers (use K.vhold / K.vtap / K.vmouse)
 *   noTitleSim         optional: don't run the game behind the title screen
 * })
 * End a run with K.end(s, { score, won, stats, title, text }).
 *
 * Online party games (launched from a party): K.net is set.
 *   K.net.players [{id, username, equipped}] (index 0 = host), K.net.me, K.net.index, K.net.isHost
 *   K.net.send(data, toId?)            to everyone (or one player)
 *   onNet(s, data, fromId)             K.game option: called for every message from another player
 *   onLeave(s, id)                     K.game option: a player left the game
 *   The kit waits until everyone has loaded, then the host starts the round for all (and restarts it).
 *   K.rng() is a random number generator seeded the same for every player in the round.
 * Same-screen multiplayer (launched as SAME SCREEN): K.local = number of players on this device.
 */
(function () {
  const W = 960, H = 540;
  const Q = new URLSearchParams(location.search);
  const FAST = Math.min(8, Math.max(1, +Q.get('fast') || 1)); // ?fast=4 runs game time 4x (automatic tests only)
  const ATTRACT = Q.has('attract') || Q.has('cover');
  const COVER = Q.has('cover');
  const META = (() => { try { return JSON.parse(document.getElementById('meta').textContent); } catch { return {}; } })();
  const GENRE_C = { horror: '#ff3355', fun: '#ffd93a', mind: '#22e6ff', relax: '#3dffa0', mystery: '#c45cff' };
  const C = { bg: '#05040c', mag: '#ff2bd6', cyan: '#22e6ff', yel: '#f6ff3a', vio: '#8b5cf6', red: '#ff3355', green: '#3dffa0', gold: '#ffc93a', white: '#ece9ff', dim: '#8e88b8', orange: '#ff8a3a', blue: '#4f8bff', pink: '#ff9bc8' };
  const FONT = { d: "'Orbitron', sans-serif", u: "'Rajdhani', sans-serif", m: "'Share Tech Mono', monospace" };

  let cfg = null, s = null, state = 'boot', stateT = 0, result = null, reward = null, best = null;
  let canvas, ctx, scale = 1, ox = 0, oy = 0, dpr = 1, last = 0, time = 0;
  let shakeA = 0, flashC = null, flashT = 0;
  let NET = null, readySet = new Set(), lobbyT = 0;
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let rng = Math.random;
  const parts = [];
  const keys = new Set(), tapped = new Set(), vkeys = new Set(), vtapped = new Set();
  const mouse = { x: W / 2, y: H / 2, down: false, clicked: false, released: false, right: false, wheel: 0, moved: false };
  let swipeDir = null, tStart = null;

  // ---------- setup ----------
  function setup() {
    document.body.innerHTML = '';
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    window.addEventListener('resize', resize);
    resize();
    if (!ATTRACT) bindInput();
  }
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const vw = window.innerWidth, vh = window.innerHeight;
    canvas.width = vw * dpr; canvas.height = vh * dpr;
    canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
    scale = Math.min(vw / W, vh / H);
    ox = (vw - W * scale) / 2; oy = (vh - H * scale) / 2;
  }
  const toLocal = (cx, cy) => ({ x: (cx - ox) / scale, y: (cy - oy) / scale });

  function bindInput() {
    const block = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);
    addEventListener('keydown', (e) => {
      if (e.target?.classList?.contains('xt-type')) return;
      if (block.has(e.code)) e.preventDefault();
      if (!keys.has(e.code)) tapped.add(e.code);
      keys.add(e.code);
      audio();
    });
    addEventListener('keyup', (e) => keys.delete(e.code));
    addEventListener('blur', () => keys.clear());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointermove', (e) => { const p = toLocal(e.clientX, e.clientY); mouse.x = p.x; mouse.y = p.y; mouse.moved = true; });
    canvas.addEventListener('pointerdown', (e) => {
      const p = toLocal(e.clientX, e.clientY); mouse.x = p.x; mouse.y = p.y;
      if (e.button === 2) { mouse.right = true; return; }
      mouse.down = true; mouse.clicked = true; tStart = { x: e.clientX, y: e.clientY, t: performance.now() };
      audio();
    });
    addEventListener('pointerup', (e) => {
      if (e.button === 2) return;
      mouse.down = false; mouse.released = true;
      if (tStart) {
        const dx = e.clientX - tStart.x, dy = e.clientY - tStart.y;
        if (Math.hypot(dx, dy) > 30 && performance.now() - tStart.t < 600) swipeDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        tStart = null;
      }
    });
    canvas.addEventListener('wheel', (e) => { mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }

  // ---------- input API ----------
  const anyOf = (set, codes) => codes.some((c) => set.has(c));
  const K = {};
  K.W = W; K.H = H; K.C = C; K.FONT = FONT; K.attract = ATTRACT; K.meta = META;
  // remember which keys the game reads while playing -> the phone controls show exactly those
  const usedKeys = new Set();
  let usedDir = false, usedTyping = false;
  const typeQ = []; // letters from the phone's own keyboard, fed in one per frame
  const note = (codes) => { if (state === 'play') codes.forEach((c) => usedKeys.add(c)); };
  K.down = (...codes) => (note(codes), anyOf(keys, codes) || anyOf(vkeys, codes));
  K.tap = (...codes) => (note(codes), anyOf(tapped, codes) || anyOf(vtapped, codes));
  K.mouse = mouse;
  K.swipe = () => { const d = swipeDir; swipeDir = null; return d; };
  K.dir = () => (state === 'play' && (usedDir = true), {
    x: (K.down('ArrowRight', 'KeyD') ? 1 : 0) - (K.down('ArrowLeft', 'KeyA') ? 1 : 0),
    y: (K.down('ArrowDown', 'KeyS') ? 1 : 0) - (K.down('ArrowUp', 'KeyW') ? 1 : 0),
  });
  K.tapDir = () => {
    if (state === 'play') usedDir = 'tap';
    if (K.tap('ArrowUp', 'KeyW')) return 'up';
    if (K.tap('ArrowDown', 'KeyS')) return 'down';
    if (K.tap('ArrowLeft', 'KeyA')) return 'left';
    if (K.tap('ArrowRight', 'KeyD')) return 'right';
    return swipeDir ? K.swipe() : null;
  };
  K.action = () => K.tap('Space', 'Enter') || mouse.clicked;
  // virtual input for ai()
  K.vhold = (code, on = true) => (on ? vkeys.add(code) : vkeys.delete(code));
  K.vtap = (code) => vtapped.add(code);
  K.vmouse = (x, y, click = false, down = click) => { mouse.x = x; mouse.y = y; mouse.down = down; if (click) mouse.clicked = true; };
  K.typed = () => ((state === 'play' && (usedTyping = true)), [...tapped, ...vtapped].filter((c) => /^Key[A-Z]$/.test(c)).map((c) => c[3]));


  // ---------- multiplayer helpers for arena games ----------
  // K.seats(fill)  everyone in the game: online players, same-screen players, or just you, plus bots up to `fill`
  //                [{ id, name, me, bot, local (same-screen index) }]
  // K.pad(n)       controls of same-screen player n (or of you): { x, y, a, b } with x/y in -1..1, a/b = held
  //                P1: WASD + Space / Shift · P2: arrows + Enter / Right-Shift · alone: arrows or WASD + Space or click / Shift
  // K.isHost()     true when this device runs the game world (solo, same screen, or the online host)
  K.seats = (fill = 2, botName = 'BOT') => {
    let list;
    if (K.net) list = K.net.players.map((p) => ({ id: p.id, name: p.username, me: p.id === K.net.me, bot: false }));
    else if (K.local) list = Array.from({ length: K.local }, (_, i) => ({ id: 'p' + i, name: 'P' + (i + 1), me: true, bot: false, local: i }));
    else list = [{ id: 'p0', name: 'YOU', me: true, bot: false, local: 0 }];
    while (list.length < fill) list.push({ id: 'bot' + list.length, name: botName + ' ' + (list.length + 1), me: false, bot: true });
    return list;
  };
  K.isHost = () => !K.net || K.net.isHost;
  K.pad = (n = 0) => {
    // read keys without noting them all: the phone controls get one button per action (Space = A, Shift = B)
    const k = (...c) => (anyOf(keys, c) || anyOf(vkeys, c) ? 1 : 0);
    if (K.local) {
      if (n === 0) return note(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft']), { x: k('KeyD') - k('KeyA'), y: k('KeyS') - k('KeyW'), a: !!k('Space', 'KeyF'), b: !!k('ShiftLeft', 'KeyG') };
      return note(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'ShiftRight']), { x: k('ArrowRight') - k('ArrowLeft'), y: k('ArrowDown') - k('ArrowUp'), a: !!k('Enter', 'KeyL'), b: !!k('ShiftRight', 'KeyK') };
    }
    const d = K.dir();
    note(['Space', 'ShiftLeft']);
    return { x: d.x, y: d.y, a: !!k('Space') || mouse.down, b: !!k('ShiftLeft', 'ShiftRight', 'KeyE') };
  };
  K.mouse2 = () => mouse;

  // ---------- math ----------
  K.rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  K.irand = (a, b) => Math.floor(K.rand(a, b + 1));
  K.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  K.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  K.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  K.lerp = (a, b, t) => a + (b - a) * t;
  K.dist = (a, b, c, d) => (typeof a === 'object' ? Math.hypot(a.x - b.x, a.y - b.y) : Math.hypot(a - c, b - d));
  K.rectHit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  K.inRect = (px, py, r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  K.circHit = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < (a.r || 0) + (b.r || 0);
  K.angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  K.wrap = (v, n) => ((v % n) + n) % n;
  K.time = () => time;
  K.rng = () => rng();
  K.rpick = (arr) => arr[Math.floor(rng() * arr.length)];
  K.rint = (a, b) => a + Math.floor(rng() * (b - a + 1));
  K.local = Number(Q.get('local')) || 0;

  // ---------- drawing ----------
  K.ctx = () => ctx;
  K.font = (size, f = 'u', weight = 700) => `${weight} ${size}px ${FONT[f] || f}`;
  K.text = (str, x, y, size = 20, color = C.white, align = 'center', f = 'u', glow = 0) => {
    ctx.font = K.font(size, f, f === 'm' ? 400 : 700);
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  };
  K.wrapText = (str, x, y, maxW, size = 18, color = C.white, lh = 1.3, align = 'center', f = 'u') => {
    ctx.font = K.font(size, f); const words = String(str).split(' '); let line = ''; const lines = [];
    words.forEach((w) => { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line);
    lines.forEach((l, i) => K.text(l, x, y + i * size * lh, size, color, align, f));
    return lines.length * size * lh;
  };
  K.rect = (x, y, w, h, color, r = 0) => { ctx.fillStyle = color; if (r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); } else ctx.fillRect(x, y, w, h); };
  K.stroke = (x, y, w, h, color, lw = 2, r = 0) => { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); r ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.stroke(); };
  K.circle = (x, y, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fill(); };
  K.ring = (x, y, r, color, lw = 2) => { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.stroke(); };
  K.line = (x1, y1, x2, y2, color, lw = 2) => { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  K.poly = (pts, color, fill = true, lw = 2) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); if (fill) { ctx.fillStyle = color; ctx.fill(); } else { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke(); } };
  K.glow = (color, blur = 14) => { ctx.shadowColor = color; ctx.shadowBlur = blur; };
  K.noGlow = () => { ctx.shadowBlur = 0; };
  K.alpha = (a) => { ctx.globalAlpha = a; };
  K.save = () => ctx.save();
  K.restore = () => ctx.restore();
  K.grad = (x1, y1, x2, y2, stops) => { const g = ctx.createLinearGradient(x1, y1, x2, y2); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
  K.rgrad = (x, y, r, stops) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; };
  K.bg = (color) => K.rect(0, 0, W, H, color);
  K.grid = (size, color, alpha = 0.15) => { K.alpha(alpha); for (let x = 0; x <= W; x += size) K.line(x, 0, x, H, color, 1); for (let y = 0; y <= H; y += size) K.line(0, y, W, y, color, 1); K.alpha(1); };
  K.vignette = (strength = 0.7) => { ctx.fillStyle = K.rgrad(W / 2, H / 2, W * 0.7, ['rgba(0,0,0,0)', `rgba(0,0,0,${strength})`]); ctx.fillRect(0, 0, W, H); };
  // darkness with a light hole (horror flashlight)
  // (drawn on its own layer so overlapping lights add up instead of cancelling out)
  let dk = null;
  K.darkness = (lights, alpha = 0.96) => {
    if (!dk) { dk = document.createElement('canvas'); dk.width = W; dk.height = H; }
    const d = dk.getContext('2d');
    d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, W, H);
    d.fillStyle = `rgba(0,0,0,${alpha})`; d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    lights.forEach((l) => {
      if (!(l.r > 0)) return;
      const g = d.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g; d.beginPath(); d.arc(l.x, l.y, l.r, 0, Math.PI * 2); d.fill();
    });
    d.globalCompositeOperation = 'source-over';
    ctx.drawImage(dk, 0, 0, W, H);
  };

  // immediate-mode button: draws and returns true when clicked
  K.button = (x, y, w, h, label, opt = {}) => {
    const hover = K.inRect(mouse.x, mouse.y, { x, y, w, h });
    const col = opt.color || C.cyan;
    K.rect(x, y, w, h, hover ? col : 'rgba(255,255,255,0.05)', 8);
    K.stroke(x, y, w, h, col, 2, 8);
    K.text(label, x + w / 2, y + h / 2 + 1, opt.size || 18, hover ? '#05040c' : col, 'center', opt.font || 'd');
    return hover && mouse.clicked;
  };


  // on-screen keyboard for word games (works with mouse + touch). Returns 'A'..'Z', 'ENTER', 'BACK' or null.
  // colors: optional { A: '#color', ... } to tint keys (Wordle-style)
  K.keyboard = (x, y, w, colors = {}, opt = {}) => {
    if (state === 'play') usedTyping = true;
    if (IS_TOUCH) {
      const cs = Object.keys(colors).length, kw = w / 26;
      if (cs) for (let i = 0; i < 26; i++) { const ch = String.fromCharCode(65 + i); K.rect(x + i * kw + 1, y, kw - 2, 24, colors[ch] || '#24203f', 4); K.text(ch, x + i * kw + kw / 2, y + 13, 12, '#fff', 'center', 'd'); }
      if (document.activeElement !== typeIn) { K.alpha(0.6 + 0.4 * Math.sin(time * 5)); K.text('⌨  TAP HERE TO TYPE', x + w / 2, y + (cs ? 60 : 30), 20, C.cyan || '#22e6ff', 'center', 'd', 10); K.alpha(1); }
      const t = K.typed();
      return t.length ? t[0] : K.tap('Enter', 'NumpadEnter') ? 'ENTER' : K.tap('Backspace') ? 'BACK' : null;
    }
    const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    const kw = w / 10, kh = opt.h || 44, gap = 5;
    let out = null;
    rows.forEach((r, ri) => {
      const extra = ri === 2 ? 1.5 : 0;
      const rowW = r.length * kw + extra * 2 * kw;
      let cx = x + (w - rowW) / 2;
      const ky = y + ri * (kh + gap);
      const key = (label, val, kwid) => {
        const hov = K.inRect(mouse.x, mouse.y, { x: cx, y: ky, w: kwid - gap, h: kh });
        const col = colors[val] || (hov ? '#3a3570' : '#24203f');
        K.rect(cx, ky, kwid - gap, kh, col, 6);
        K.text(label, cx + (kwid - gap) / 2, ky + kh / 2 + 1, label.length > 1 ? 13 : 18, '#fff', 'center', 'd');
        if (hov && mouse.clicked) out = val;
        cx += kwid;
      };
      if (ri === 2) key('ENTER', 'ENTER', kw * 1.5);
      for (const ch of r) key(ch, ch, kw);
      if (ri === 2) key('⌫', 'BACK', kw * 1.5);
    });
    if (!out) {
      const t = K.typed(); if (t.length) out = t[0];
      else if (K.tap('Enter', 'NumpadEnter')) out = 'ENTER';
      else if (K.tap('Backspace')) out = 'BACK';
    }
    return out;
  };

  // ---------- fx ----------
  K.shake = (a = 8) => { shakeA = Math.max(shakeA, a); };
  K.flash = (color = '#fff', t = 0.15) => { flashC = color; flashT = t; };
  K.burst = (x, y, color = C.cyan, n = 14, speed = 220, life = 0.6, size = 3) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color: Array.isArray(color) ? K.pick(color) : color, size: size * (0.6 + Math.random() * 0.8), g: 0 });
    }
  };
  K.particle = (p) => parts.push({ g: 0, size: 3, life: 0.6, max: p.life || 0.6, ...p });
  K.floatText = (str, x, y, color = C.gold, size = 20) => parts.push({ x, y, vx: 0, vy: -50, life: 0.9, max: 0.9, text: str, color, size, g: 0 });
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  function drawParts() {
    parts.forEach((p) => {
      K.alpha(Math.max(0, p.life / p.max));
      if (p.text) K.text(p.text, p.x, p.y, p.size, p.color, 'center', 'd', 8);
      else { K.glow(p.color, 8); K.rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, p.color); K.noGlow(); }
    });
    K.alpha(1);
  }

  // ---------- sound (synth) ----------
  let ac = null, master = null;
  function audio(play) {
    if (ATTRACT || (play && state !== 'play' && state !== 'over')) return null;
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.connect(ac.destination); } catch { return null; } }
    if (ac.state === 'suspended') ac.resume();
    master.gain.value = (window.XC ? XC.volume : 0.6) * 0.9;
    return ac;
  }
  K.tone = (freq, dur = 0.1, type = 'square', vol = 0.06, slide = 0, delay = 0) => {
    const a = audio(true); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  };
  K.noise = (dur = 0.2, vol = 0.08, freq = 1200, delay = 0, q = 0.7) => {
    const a = audio(true); if (!a) return;
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + delay;
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master); src.start(t);
  };
  const SFX = {
    blip: () => K.tone(880, 0.06, 'square', 0.04),
    click: () => K.tone(1200, 0.03, 'square', 0.03),
    select: () => K.tone(660, 0.08, 'triangle', 0.05, 220),
    coin: () => { K.tone(988, 0.07, 'square', 0.04); K.tone(1319, 0.16, 'square', 0.04, 0, 0.07); },
    jump: () => K.tone(300, 0.15, 'square', 0.05, 500),
    hit: () => { K.noise(0.12, 0.12, 900); K.tone(140, 0.12, 'sawtooth', 0.05, -60); },
    boom: () => { K.noise(0.5, 0.2, 300, 0, 0.5); K.tone(80, 0.4, 'sawtooth', 0.08, -50); },
    laser: () => K.tone(1400, 0.12, 'sawtooth', 0.04, -1100),
    power: () => [523, 659, 784, 1046].forEach((f, i) => K.tone(f, 0.1, 'triangle', 0.05, 0, i * 0.06)),
    win: () => [523, 659, 784, 1046, 1319].forEach((f, i) => K.tone(f, 0.16, 'triangle', 0.06, 0, i * 0.09)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => K.tone(f, 0.22, 'square', 0.05, 0, i * 0.14)),
    step: () => K.noise(0.05, 0.05, 400),
    creak: () => K.tone(90, 0.6, 'sawtooth', 0.03, 40),
    knock: () => { K.noise(0.06, 0.18, 250); K.noise(0.06, 0.18, 250, 0.18); },
    whisper: () => K.noise(0.8, 0.04, 3000, 0, 3),
    scare: () => { K.noise(0.6, 0.25, 1800, 0, 0.4); K.tone(220, 0.6, 'sawtooth', 0.09, 300); K.tone(233, 0.6, 'sawtooth', 0.09, 280); },
    heart: () => { K.tone(55, 0.12, 'sine', 0.2); K.tone(50, 0.12, 'sine', 0.16, 0, 0.18); },
    drip: () => K.tone(1200, 0.08, 'sine', 0.05, -700),
    whoosh: () => K.noise(0.35, 0.08, 700, 0, 0.3),
    pop: () => K.tone(500, 0.07, 'sine', 0.07, 700),
    splash: () => K.noise(0.4, 0.1, 1500, 0, 0.4),
    chime: () => [1046, 1568].forEach((f, i) => K.tone(f, 0.5, 'sine', 0.04, 0, i * 0.08)),
    wrong: () => K.tone(150, 0.25, 'square', 0.05, -40),
    tick: () => K.tone(2000, 0.02, 'square', 0.02),
  };
  K.sfx = (name) => SFX[name]?.();
  // looping drone for ambience; returns stop()
  K.drone = (freq = 55, vol = 0.03, type = 'sawtooth') => {
    const a = audio(true); if (!a) return () => {};
    const o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter();
    o.type = type; o2.type = type; o.frequency.value = freq; o2.frequency.value = freq * 1.01; f.type = 'lowpass'; f.frequency.value = 400;
    g.gain.value = vol; o.connect(f); o2.connect(f); f.connect(g).connect(master); o.start(); o2.start();
    let stopped = false;
    const stop = () => { if (stopped) return; stopped = true; g.gain.setTargetAtTime(0, a.currentTime, 0.2); o.stop(a.currentTime + 1); o2.stop(a.currentTime + 1); };
    drones.push(stop);
    return stop;
  };
  const drones = [];
  const stopDrones = () => { drones.splice(0).forEach((d) => d()); };

  // ---------- per-game storage ----------
  const SK = 'xcg_' + (META.id || location.pathname);
  K.load = (key, def) => { try { const v = JSON.parse(localStorage.getItem(SK + '_' + key)); return v ?? def; } catch { return def; } };
  K.store = (key, v) => { try { localStorage.setItem(SK + '_' + key, JSON.stringify(v)); } catch {} };

  // ---------- flow ----------
  K.end = (st, r = {}) => {
    if ((state !== 'play' && !(NET && state === 'pause')) || ATTRACT) { if (ATTRACT) restartAttract(); return; }
    stopDrones();
    result = { score: Math.round(r.score || 0), won: r.won ?? null, stats: r.stats || {}, title: r.title || (r.won === true ? 'YOU WIN' : r.won === false ? 'GAME OVER' : 'RUN OVER'), text: r.text || '' };
    reward = null;
    state = 'over'; stateT = 0;
    const prev = best;
    if (result.score > 0 && (best == null || (cfg.lowerIsBetter ? result.score < best : result.score > best))) best = result.score;
    result.newBest = best !== prev;
    if (window.XC) XC.end({ score: result.score, won: result.won, stats: result.stats, lowerIsBetter: cfg.lowerIsBetter });
    K.sfx(result.won === false ? 'lose' : 'win');
  };
  function restartAttract() { s = {}; cfg.init(s); }
  function phoneFullscreen() {
    if (!K.isTouch || document.fullscreenElement) return;
    try {
      const el = document.documentElement;
      const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
      if (p) p.then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
    } catch {}
  }
  function startRun(seed) {
    phoneFullscreen();
    rng = mulberry(seed ?? Math.floor(Math.random() * 1e9));
    stopDrones(); parts.length = 0;
    s = {}; cfg.init(s);
    state = 'play'; stateT = 0;
    if (window.XC) XC.start();
  }


  // ---------- online party games ----------
  function setupNet(n) {
    NET = n;
    K.net = {
      get players() { return NET.players; },
      me: NET.me,
      get index() { return NET.players.findIndex((p) => p.id === NET.me); },
      isHost: NET.host,
      send: (d, to) => NET.send(d, to),
      name: (id) => (NET.players.find((p) => p.id === id) || {}).username || 'PLAYER',
    };
    readySet.add(NET.me);
    NET.on((d, from) => {
      if (d && d.__k) {
        if (d.__k === 'hello' && !NET.host) NET.send({ __k: 'ready' });
        if (d.__k === 'ready' && NET.host) { readySet.add(from); maybeGo(); }
        if (d.__k === 'go' && !NET.host) { clearInput(); startRun(d.seed); }
        return;
      }
      if (s && cfg.onNet) cfg.onNet(s, d, from);
    });
    NET.onLeave((id) => { readySet.delete(id); if (s && cfg.onLeave) cfg.onLeave(s, id); if (NET.host) maybeGo(); });
    if (NET.host) NET.send({ __k: 'hello' }); else NET.send({ __k: 'ready' });
  }
  function maybeGo() {
    if (state !== 'lobby' || !NET.host) return;
    if (NET.players.every((p) => readySet.has(p.id)) || lobbyT > 8) hostGo();
  }
  function hostGo() {
    const seed = Math.floor(Math.random() * 1e9);
    NET.send({ __k: 'go', seed });
    clearInput();
    startRun(seed);
  }

  K.game = (c) => {
    cfg = { bg: C.bg, how: META.controls || '', title: META.title || 'GAME', ...c };
    setup();
    const go = async () => {
      try { await Promise.race([document.fonts.load('700 20px Orbitron'), new Promise((r) => setTimeout(r, 1500))]); } catch {}
      if (window.XC && !ATTRACT) {
        const ctxXC = await XC.ready();
        best = ctxXC.best;
        XC.onResult((r) => { reward = r; if (r.best != null) best = r.best; });
        if (XC.net) setupNet(XC.net);
        if (XC.local) K.local = XC.local;
      }
      if (cfg.typing) usedTyping = true;
      s = {}; cfg.init(s);
      state = ATTRACT ? 'attract' : NET ? 'lobby' : 'title';
      last = performance.now();
      requestAnimationFrame(frame);
    };
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', go); else go();
  };

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016) * FAST;
    last = now; time += dt; stateT += dt;
    if (typeQ.length) tapped.add(typeQ.shift());
    try {
      if (state === 'attract') {
        cfg.ai?.(s, dt); cfg.update(s, dt);
      } else if (state === 'lobby') {
        lobbyT += dt;
        if (NET.host) { if (lobbyT > 8) hostGo(); else if (Math.floor(lobbyT * 2) !== Math.floor((lobbyT - dt) * 2)) NET.send({ __k: 'hello' }); }
      } else if (state === 'title') {
        const want = stateT > 0.3 && (tapped.has('Space') || tapped.has('Enter') || mouse.clicked);
        if (want) { clearInput(); startRun(); }
        else if (!cfg.noTitleSim && cfg.ai) { cfg.ai(s, dt); cfg.update(s, dt); vkeys.clear(); }
      } else if (state === 'play') {
        if (K.tap('Escape') || (!usedTyping && K.tap('KeyP'))) { state = 'pause'; stateT = 0; }
        else cfg.update(s, dt);
      } else if (state === 'pause') {
        if (NET) cfg.update(s, dt);
        if (K.tap('Escape', 'Space') || (!usedTyping && K.tap('KeyP'))) state = 'play';
      } else if (state === 'over') {
        if (stateT > 0.7 && K.tap('Space', 'Enter', 'KeyR') && (!NET || NET.host)) NET ? hostGo() : startRun();
        else if (stateT > 0.3 && K.tap('Escape')) K.exit();
      }
      stepParts(dt);
      render(dt);
      touchUI();
    } catch (err) {
      console.error(err);
      throw err;
    }
    clearInput();
    requestAnimationFrame(frame);
  }
  function clearInput() {
    tapped.clear(); vtapped.clear(); mouse.clicked = false; mouse.released = false; mouse.right = false; mouse.wheel = 0; swipeDir = null;
    if (ATTRACT || state === 'title') mouse.down = false;
  }
  K.exit = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    window.XC ? XC.exit() : history.back();
  };

  function render(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    let sx = 0, sy = 0;
    if (shakeA > 0.1) { sx = K.rand(-shakeA, shakeA); sy = K.rand(-shakeA, shakeA); shakeA *= Math.pow(0.002, dt); } else shakeA = 0;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, (ox + sx * scale) * dpr, (oy + sy * scale) * dpr);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    K.bg(cfg.bg);
    cfg.draw(s, ctx);
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    drawParts();
    if (flashT > 0) { K.alpha(Math.min(1, flashT * 5)); K.bg(flashC); K.alpha(1); flashT -= dt; }
    overlay();
    ctx.restore();
  }

  const gc = () => GENRE_C[META.genre] || C.cyan;
  function panel(alpha = 0.78) { K.rect(0, 0, W, H, `rgba(3,2,10,${alpha})`); }
  function overlay() {
    if (state === 'attract') {
      if (COVER) {
        K.rect(0, H - 120, W, 120, 'rgba(3,2,10,0.72)');
        K.rect(0, H - 120, W, 3, gc());
        K.text(cfg.title, W / 2, H - 62, cfg.title.length > 16 ? 46 : 58, '#fff', 'center', 'd', 18);
      }
      return;
    }
    if (state === 'lobby') {
      panel(0.75);
      K.text(cfg.title, W / 2, 150, cfg.title.length > 16 ? 46 : 58, '#fff', 'center', 'd', 20);
      K.text('WAITING FOR EVERYONE TO LOAD…', W / 2, 250, 22, gc(), 'center', 'd', 10);
      NET.players.forEach((p, i) => K.text((readySet.has(p.id) || !NET.host ? '● ' : '○ ') + p.username + (i === 0 ? '  (LEADER)' : ''), W / 2, 300 + i * 26, 18, readySet.has(p.id) ? C.green : C.dim, 'center', 'd'));
      return;
    }
    if (state === 'title') {
      panel(cfg.ai && !cfg.noTitleSim ? 0.55 : 0.7);
      K.text(cfg.title, W / 2, 150, cfg.title.length > 16 ? 50 : 64, '#fff', 'center', 'd', 22);
      K.rect(W / 2 - 160, 200, 320, 3, gc());
      if (cfg.how) K.wrapText(cfg.how, W / 2, 250, 700, 22, '#d6d2f5');
      if (best != null) K.text(`BEST ${best}${META.scoreLabel ? ' ' + META.scoreLabel : ''}`, W / 2, 360, 20, C.gold, 'center', 'm');
      K.alpha(0.6 + 0.4 * Math.sin(time * 5));
      K.text('PRESS SPACE OR CLICK TO PLAY', W / 2, 430, 24, gc(), 'center', 'd', 12);
      K.alpha(1);
      K.text('P / ESC = PAUSE', W / 2, 500, 14, C.dim, 'center', 'm');
    } else if (state === 'pause') {
      panel(0.8);
      K.text('PAUSED', W / 2, 180, 56, '#fff', 'center', 'd', 18);
      if (K.button(W / 2 - 120, 260, 240, 50, 'RESUME', { color: gc() })) state = 'play';
      if (!NET && K.button(W / 2 - 120, 325, 240, 50, 'RESTART', { color: C.white })) startRun();
      if (NET) K.text('the game keeps running while this menu is open', W / 2, 350, 14, C.dim, 'center', 'm');
      if (K.button(W / 2 - 120, 390, 240, 50, 'EXIT', { color: C.red })) K.exit();
    } else if (state === 'over') {
      panel(Math.min(0.82, stateT * 2));
      const col = result.won === false ? C.red : result.won ? C.green : gc();
      K.text(result.title, W / 2, 140, 60, col, 'center', 'd', 22);
      if (result.text) K.wrapText(result.text, W / 2, 200, 720, 20, '#d6d2f5');
      K.text(`${result.score}`, W / 2, 268, 64, '#fff', 'center', 'd', 10);
      K.text(META.scoreLabel || 'SCORE', W / 2, 312, 16, C.dim, 'center', 'm');
      if (result.newBest) K.text('NEW BEST!', W / 2, 345, 22, C.gold, 'center', 'd', 12);
      else if (best != null) K.text(`BEST ${best}`, W / 2, 345, 18, C.gold, 'center', 'm');
      if (reward && (reward.xp || reward.coins)) K.text(`+${reward.xp} XP   +${reward.coins} COINS`, W / 2, 378, 20, C.cyan, 'center', 'd');
      if (stateT > 0.7) {
        if (NET && !NET.host) K.text('WAITING FOR THE LEADER…', W / 2 - 135, 447, 16, C.dim, 'center', 'd');
        else if (K.button(W / 2 - 250, 420, 230, 54, 'PLAY AGAIN', { color: col })) NET ? hostGo() : startRun();
        if (K.button(W / 2 + 20, 420, 230, 54, 'EXIT', { color: C.white })) K.exit();
        K.text(NET ? 'ESC = leave the game' : 'SPACE = again · ESC = exit', W / 2, 500, 14, C.dim, 'center', 'm');
      }
    }
  }

  // ---------- phone / tablet controls ----------
  // A joystick (if the game reads arrows / WASD / K.dir) and one button per other key the game reads.
  // A game can set its own with K.game({ touch: { stick: true|'tap'|false, buttons: [['Space', 'JUMP'], ...] } }).
  // Same screen (K.local) on a phone: two sticks - left = P1 (WASD), right = P2 (arrows) - each with its own buttons
  // (touch.buttons2 sets P2's buttons).
  const IS_TOUCH = !ATTRACT && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || Q.has('touch'));
  const DIR_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const WASD = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
  const SKIP = new Set(['Escape', 'KeyP', 'Tab', 'NumpadEnter']);
  const P2KEYS = new Set(['Enter', 'ShiftRight', 'KeyL', 'KeyK', 'KeyJ', 'KeyI', 'KeyO', 'KeyU', 'Slash', 'Period', 'Comma', 'Semicolon', 'Quote', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3']);
  const LABEL = { Space: 'A', Enter: 'OK', ShiftLeft: 'B', ShiftRight: 'B', ControlLeft: 'CTRL', Backspace: '⌫' };
  const label = (c) => LABEL[c] || (c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : c.startsWith('Numpad') ? c.slice(6) : c.replace(/Left|Right/, '').slice(0, 4).toUpperCase());
  // which key codes a stick direction presses: a solo stick drives arrows AND WASD; same-screen sticks drive one player each
  const STICK = {
    any: { up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'] },
    p1: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'] },
    p2: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'] },
  };
  let tui = null, tuiSig = '', typeIn = null, focusType = null;
  // the phone's own keyboard: a hidden text box; whatever it receives is turned into key taps (letters, space, backspace, enter)
  const SENT = '\u200b\u200b\u200b\u200b';
  function typeBox() {
    typeIn = document.createElement('input');
    typeIn.className = 'xt-type';
    Object.assign(typeIn, { type: 'text', value: SENT, autocomplete: 'off', spellcheck: false, enterKeyHint: 'enter' });
    if (cfg.typing === 'numeric') typeIn.inputMode = 'numeric';
    typeIn.setAttribute('autocorrect', 'off'); typeIn.setAttribute('autocapitalize', 'characters'); typeIn.setAttribute('aria-label', 'Type here');
    let lastV = SENT, composing = false;
    const reset = () => { typeIn.value = SENT; lastV = SENT; try { typeIn.setSelectionRange(SENT.length, SENT.length); } catch (e) {} };
    const code = (ch) => (/[a-z]/i.test(ch) ? 'Key' + ch.toUpperCase() : ch === ' ' ? 'Space' : ch === '\n' ? 'Enter' : /[0-9]/.test(ch) ? 'Digit' + ch : null);
    typeIn.addEventListener('compositionstart', () => (composing = true));
    typeIn.addEventListener('compositionend', () => { composing = false; setTimeout(reset, 0); });
    typeIn.addEventListener('input', () => {
      const v = typeIn.value;
      let i = 0; while (i < v.length && i < lastV.length && v[i] === lastV[i]) i++;
      for (let k = 0; k < lastV.length - i; k++) typeQ.push('Backspace');
      for (const ch of v.slice(i)) { const c = code(ch); if (c) typeQ.push(c); }
      lastV = v;
      if (!composing || v.length < 2 || v.length > 40) reset();
      audio();
    });
    typeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); typeQ.push('Enter'); reset(); } });
    document.body.appendChild(typeIn);
    // focusing has to happen inside the tap itself or the phone will not open its keyboard
    // (on click, after the tap's own mouse events, which would otherwise take the focus straight back)
    focusType = () => { typeIn.focus({ preventScroll: true }); reset(); };
    canvas.addEventListener('click', () => { if (usedTyping && state === 'play') focusType(); });
  }
  const press = (code) => { if (!keys.has(code)) tapped.add(code); keys.add(code); audio(); };
  const release = (code) => keys.delete(code);
  function fillButtons(box, btns) {
    box.innerHTML = '';
    btns.forEach(([code, text]) => {
      const b = document.createElement('button');
      const n = String(text).length;
      b.className = 'xt-b' + (n > 2 ? ' wide' : '') + (n > 5 ? ' wider' : '');
      b.textContent = text;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); b.setPointerCapture(e.pointerId); b.classList.add('down'); press(code); });
      const up = (e) => { e.preventDefault(); b.classList.remove('down'); release(code); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      box.appendChild(b);
    });
  }
  function touchUI() {
    if (!IS_TOUCH || !canvas) return;
    if (!tui) {
      tui = document.createElement('div');
      tui.className = 'xt';
      tui.innerHTML = '<button class="xt-pause" aria-label="Pause">II</button><div class="xt-stick"><i></i></div><div class="xt-stick r"><i></i></div><div class="xt-btns l"></div><div class="xt-btns"></div><div class="xt-rot">↻ Turn your phone sideways</div><button class="xt-kb">⌨ TYPE</button>';
      document.body.appendChild(tui);
      const pb = tui.querySelector('.xt-pause');
      pb.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); tapped.add('Escape'); });
      tui.querySelectorAll('.xt-stick').forEach(stickInput);
      typeBox();
      tui.querySelector('.xt-kb').addEventListener('click', (e) => { e.preventDefault(); focusType(); });
    }
    tui.classList.toggle('kb', usedTyping && state === 'play' && document.activeElement !== typeIn);
    if (state !== 'play' && document.activeElement === typeIn) typeIn.blur();
    const playing = state === 'play';
    tui.classList.toggle('on', playing || state === 'pause');
    tui.classList.toggle('paused', state === 'pause');
    if (!playing) return;
    const own = cfg.touch || {};
    const duo = (K.local || 0) >= 2;
    const stick = own.stick ?? (usedDir || [...usedKeys].some((c) => DIR_KEYS.has(c) || WASD.has(c)) ? (usedDir === 'tap' ? 'tap' : true) : false);
    const auto = [...usedKeys].filter((c) => !SKIP.has(c) && !DIR_KEYS.has(c) && !(stick && WASD.has(c)) && !/^(Digit|Numpad)/.test(c));
    let btns, btns2 = [];
    if (duo) {
      btns = (own.buttons || auto.filter((c) => !P2KEYS.has(c)).map((c) => [c, label(c)])).slice(0, 3);
      btns2 = (own.buttons2 || auto.filter((c) => P2KEYS.has(c)).map((c) => [c, c === 'Enter' ? 'A' : label(c)])).slice(0, 3);
    } else {
      btns = own.buttons || auto.filter((c) => c !== 'ShiftRight').map((c) => [c, label(c)]);
      if (!own.buttons) {
        if (btns.some(([c]) => c === 'Space')) btns = btns.filter(([c]) => c !== 'Enter');
        btns = btns.slice(0, 6);
      }
    }
    const sig = duo + '|' + stick + '|' + btns.map((b) => b.join(':')).join(',') + '|' + btns2.map((b) => b.join(':')).join(',');
    if (sig === tuiSig) return;
    tuiSig = sig;
    tui.classList.toggle('duo', duo);
    const [st, st2] = tui.querySelectorAll('.xt-stick');
    st.style.display = stick ? '' : 'none';
    st.dataset.mode = stick === 'tap' ? 'tap' : 'hold';
    st.dataset.who = duo ? 'p1' : 'any';
    st2.style.display = stick && duo ? '' : 'none';
    st2.dataset.mode = st.dataset.mode;
    st2.dataset.who = 'p2';
    fillButtons(tui.querySelector('.xt-btns:not(.l)'), duo ? btns2 : btns);
    fillButtons(tui.querySelector('.xt-btns.l'), duo ? btns : []);
  }
  function stickInput(el) {
    const knob = el.querySelector('i');
    let id = null, cx = 0, cy = 0, held = new Set(), rep = null;
    const set = (want) => {
      held.forEach((k) => { if (!want.has(k)) release(k); });
      want.forEach((k) => { if (!held.has(k)) press(k); });
      held = want;
    };
    const move = (e) => {
      const r = el.getBoundingClientRect(), R = r.width / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy), m = Math.min(d, R * 0.8);
      if (d > 0) { dx = (dx / d) * m; dy = (dy / d) * m; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      const want = new Set(), map = STICK[el.dataset.who] || STICK.any;
      if (d > R * 0.28) {
        const a = Math.atan2(dy, dx), th = el.dataset.mode === 'tap' ? 0.7071 : 0.42;
        const sx = Math.cos(a), sy = Math.sin(a), dirs = [];
        if (sx > th) dirs.push('right'); else if (sx < -th) dirs.push('left');
        if (sy > th) dirs.push('down'); else if (sy < -th) dirs.push('up');
        dirs.forEach((dn) => map[dn].forEach((c) => want.add(c)));
      }
      set(want);
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      id = e.pointerId; el.setPointerCapture(id); el.classList.add('act');
      const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(e);
      clearInterval(rep);
      // grid games read single taps: repeat the tap while the stick is held
      rep = setInterval(() => { if (el.dataset.mode === 'tap') held.forEach((k) => tapped.add(k)); }, 190);
    });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; clearInterval(rep); el.classList.remove('act'); knob.style.transform = ''; set(new Set()); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  K.isTouch = IS_TOUCH;

  window.K = K;
})();
