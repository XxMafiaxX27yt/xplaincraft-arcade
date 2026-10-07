// FLOORFALL 3D - four stacked layers of hex tiles. A tile cracks and drops a moment after anyone stands on it.
// Fall through every layer and you are out. Last one standing wins.
// NOVEX twists: SURGE (every 14 s a line of tiles collapses on every layer) and rare gold BOUNCE tiles (launch you up a layer).
import { boot, V } from '../../kit3d/kit3d.js';
import { avatars } from '../../kit3d/avatar.js';
import { tpcam } from '../../kit3d/tpcam.js';
import { net3d, Interp, lerp, lerpAngle } from '../../kit3d/net3d.js';
import { onlineLobby, netBadge } from '../../kit3d/online.js';

const LAYERS = 5, GAP = 7, RING = 8, HEX = 1.0, TILE_H = 0.5, WARN_T = 1.0, SURGE_EVERY = 14, FIRST_SURGE = 25;
const LAYER_COL = ['#22e6ff', '#ff2bd6', '#ffd93a', '#3dffa0', '#8b5cf6'];
const PLAYER_COL = ['#ffffff', '#ff2bd6', '#ffd93a', '#3dffa0', '#ff8a3a', '#8b5cf6', '#ff3355', '#f4f4f4'];
const NAMES = ['YOU', 'PIP', 'ZAPPY', 'MOCHI', 'BLINK', 'NOODLE', 'TOAST', 'BOOP'];
const RUN = 7, JUMP_V = 7.6, GRAV = 22;

const K3 = await boot({ title: 'FLOORFALL', gravity: 22, actions: { jump: ['Space'] } });
const S = K3.scene;
// online (from a party): everyone runs their own character and tells the others which tiles they cracked; the host runs bots + SURGE + the result
const N = await net3d(window.XC?.net);
K3.online = !!N;
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const G = { phase: 'menu', players: [], tiles: [], byHandle: new Map(), t: 0, surgeT: SURGE_EVERY, place: [], cfg: Object.assign({ bots: 7, diff: 'normal' }, JSON.parse(localStorage.getItem('ff_cfg') || '{}')) };
window.__F = G;

// ---------- scene ----------
S.clearColor = new V.Color4(0.03, 0.02, 0.08, 1);
const hemi = new V.HemisphericLight('h', new V.Vector3(0.3, 1, -0.2), S); hemi.intensity = 0.85; hemi.groundColor = new V.Color3(0.25, 0.15, 0.4);
const sun = new V.DirectionalLight('s', new V.Vector3(-0.4, -1, 0.5), S); sun.position = new V.Vector3(10, 40, -10); sun.intensity = 0.7;
const glow = new V.GlowLayer('g', S, { mainTextureRatio: K3.quality === 'low' ? 0.25 : 0.5 }); glow.intensity = 0.45;
S.fogMode = 2; S.fogDensity = 0.012; S.fogColor = new V.Color3(0.05, 0.03, 0.12);
const cam = tpcam(K3, { dist: 7.5, height: 1.4, pitch: 0.42 });
// the void far below: a glowing grid
const voidM = V.CreateGround('void', { width: 300, height: 300 }, S); voidM.position.y = -GAP * LAYERS - 12;
voidM.material = (() => { const m = new V.StandardMaterial('vm', S); m.disableLighting = true; m.emissiveTexture = (() => { const t = new V.DynamicTexture('vt', 256, S); const c = t.getContext(); c.fillStyle = '#070414'; c.fillRect(0, 0, 256, 256); c.strokeStyle = '#ff2bd6'; c.lineWidth = 3; c.strokeRect(0, 0, 256, 256); t.update(); t.uScale = t.vScale = 30; return t; })(); return m; })();
// floating stars
const starSrc = V.CreateBox('star', { size: 0.15 }, S); starSrc.material = (() => { const m = new V.StandardMaterial('st', S); m.emissiveColor = new V.Color3(0.8, 0.8, 1); m.disableLighting = true; return m; })();
for (let i = 0; i < 160; i++) { const s = starSrc.createInstance('s'); const a = Math.random() * 6.28, r = 30 + Math.random() * 60; s.position.set(Math.cos(a) * r, -40 + Math.random() * 70, Math.sin(a) * r); s.isPickable = false; }
starSrc.isVisible = false;

// ---------- tiles ----------
const hexSrc = LAYER_COL.map((col, l) => {
  const m = V.CreateCylinder('hex' + l, { diameter: HEX * 2 * 0.96, height: TILE_H, tessellation: 6 }, S);
  const mat = new V.StandardMaterial('hm' + l, S); mat.diffuseColor = V.Color3.White(); mat.emissiveColor = V.Color3.FromHexString(col).scale(0.16); mat.specularColor = new V.Color3(0.3, 0.3, 0.3);
  m.material = mat; m.registerInstancedBuffer('color', 4); m.instancedBuffers.color = new V.Color4(1, 1, 1, 1); m.isVisible = false;
  return m;
});
const baseCol = (l) => { const c = V.Color3.FromHexString(LAYER_COL[l]); return new V.Color4(c.r * 0.55 + 0.1, c.g * 0.55 + 0.1, c.b * 0.55 + 0.1, 1); };
const hexPts = (() => { const p = []; for (const y of [-TILE_H / 2, TILE_H / 2]) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.push(Math.cos(a) * HEX * 0.96, y, Math.sin(a) * HEX * 0.96); } return new Float32Array(p); })();
function buildTiles(rnd = Math.random) {
  G.tiles.forEach((t) => { t.m.dispose(); if (t.c) K3.phys.remove(t.c); }); G.tiles = []; G.byHandle.clear();
  for (let l = 0; l < LAYERS; l++) {
    const y = -l * GAP;
    const RG = RING - 1 + l;   // every floor is bigger than the one above it
    for (let q = -RG; q <= RG; q++) for (let r = Math.max(-RG, -q - RG); r <= Math.min(RG, -q + RG); r++) {
      const x = HEX * 1.5 * q, z = HEX * Math.sqrt(3) * (r + q / 2);
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
      // each layer has its own holes so falling is not a straight line
      if (l === 1 && ring === 3 && (q + 2 * r) % 3 === 0) continue;
      if (l === 2 && ring >= 5 && Math.abs(q) % 4 === 0) continue;
      if (l === 3 && ring === 0) continue;
      if (l === 4 && ring === 2 && q % 2 === 0) continue;
      const m = hexSrc[l].createInstance('t'); m.position.set(x, y - TILE_H / 2, z); m.isPickable = false;
      const bounce = l > 0 && rnd() < 0.035;
      m.instancedBuffers.color = bounce ? new V.Color4(1.2, 0.95, 0.2, 1) : baseCol(l);
      const c = K3.world.createCollider(K3.R.ColliderDesc.convexHull(hexPts).setTranslation(x, y - TILE_H / 2, z).setCollisionGroups(K3.phys.groups(K3.phys.G_WORLD, 0xffff)));
      const t = { i: G.tiles.length, l, x, z, y, q, r, ring, m, c, state: 'solid', t: 0, bounce };
      G.tiles.push(t); G.byHandle.set(c.handle, t);
    }
  }
  K3.world.updateSceneQueries();
  linkTiles();
}
function crack(t, delay = WARN_T) { if (t.state !== 'solid') return; t.state = 'warn'; t.t = delay; }
function stepTiles(dt) {
  for (const t of G.tiles) {
    if (t.state === 'warn') {
      t.t -= dt;
      const k = 1 - Math.max(0, t.t) / WARN_T;
      t.m.instancedBuffers.color = new V.Color4(1.3, 0.35 + 0.4 * (1 - k), 0.6, 1);
      t.m.position.y = t.y - TILE_H / 2 - k * 0.08 + (Math.random() - 0.5) * 0.03 * k;
      if (t.t <= 0) { t.state = 'fall'; t.v = 0; K3.phys.remove(t.c); G.byHandle.delete(t.c.handle); t.c = null; if (Math.random() < 0.3) sfx('drop', t); }
    } else if (t.state === 'fall') {
      t.v += 25 * dt; t.m.position.y -= t.v * dt; t.m.rotation.x += dt * 2; t.m.scaling.setAll(Math.max(0.01, t.m.scaling.x - dt * 0.8));
      if (t.m.scaling.x <= 0.02) { t.state = 'gone'; t.m.setEnabled(false); }
    }
  }
}
const tileUnder = (p) => { const h = K3.phys.ray({ x: p.x, y: p.y + 0.3, z: p.z }, { x: 0, y: -1, z: 0 }, 0.7); return h ? G.byHandle.get(h.collider.handle) : null; };

// ---------- players ----------
let makeAvatar = null;
function makePlayer(i, bot, o = {}) {
  const a = 2 * Math.PI * (i / Math.max(1, G.total || G.cfg.bots + 1)), rr = i % 2 ? 9 : 6, sp = { x: Math.cos(a) * rr, z: Math.sin(a) * rr };
  const ch = K3.phys.character({ x: sp.x, y: 0.1, z: sp.z, radius: 0.35, height: 1.5 });
  const av = makeAvatar(PLAYER_COL[i % 8]);
  const P = { i, bot, nid: o.nid ?? i, owner: o.owner, remote: !!o.remote, name: o.name || (bot ? NAMES[i % 8] : (K3.xc?.player?.callsign || 'YOU')), ch, av, vel: { x: 0, y: 0, z: 0 }, yaw: a + Math.PI, alive: true, grounded: true, input: { x: 0, y: 0, jump: false }, prev: ch.pos(), place: 0, landT: 0, think: 0, goal: null };
  if (bot) P.skill = { easy: 0.6, normal: 0.8, hard: 0.95 }[G.cfg.diff] * (0.85 + Math.random() * 0.3);
  return P;
}
function stepPlayer(P, dt) {
  P.prev = P.ch.pos();
  if (!P.alive) return;
  const I = P.input, live = G.phase === 'live';
  let wx = I.x, wz = I.y; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
  if (!live) wx = wz = 0;
  const acc = (P.grounded ? 60 : 16) * dt;
  const tx = wx * RUN, tz = wz * RUN, dx = tx - P.vel.x, dz = tz - P.vel.z, dl = Math.hypot(dx, dz);
  if (dl <= acc) { P.vel.x = tx; P.vel.z = tz; } else { P.vel.x += (dx / dl) * acc; P.vel.z += (dz / dl) * acc; }
  if (I.jump && P.grounded && live) { P.vel.y = JUMP_V; P.grounded = false; sfx('jump', P); }
  P.vel.y -= GRAV * dt;
  if (P.grounded && P.vel.y < 0) P.vel.y = -2;
  const m = P.ch.move(P.vel.x * dt, P.vel.y * dt, P.vel.z * dt);
  for (const n of P.ch.walls) { const l = Math.hypot(n.x, n.z) || 1, d = (P.vel.x * n.x + P.vel.z * n.z) / l; if (d < 0) { P.vel.x -= (d * n.x) / l; P.vel.z -= (d * n.z) / l; } }
  if (P.vel.y > 0 && P.ch.ceiling) P.vel.y = 0;
  const was = P.grounded; P.grounded = P.ch.grounded;
  if (P.grounded && !was) { P.landT = 0.18; }
  if (Math.hypot(P.vel.x, P.vel.z) > 0.5) P.yaw = Math.atan2(P.vel.x, P.vel.z);
  // standing on a tile cracks it; a gold tile bounces you up
  if (P.grounded && live) { const t = tileUnder(P.ch.pos()); if (t && t.state === 'solid') { if (t.bounce) { P.vel.y = 17; P.grounded = false; t.bounce = false; sfx('bounce', P); crack(t, 0.15); netCrack(t, 0.15, 1); } else { crack(t); netCrack(t, WARN_T, 0); } } }
  // out of the bottom
  if (P.ch.pos().y < -GAP * (LAYERS - 1) - 8) eliminate(P);
}
function eliminate(P, net = false) {
  if (!P.alive) return;
  if (N && !net && !P.remote) N.send({ k: 'out', n: P.nid });
  P.alive = false; P.ch.collider.setEnabled(false); P.av.root.setEnabled(false);
  G.place.unshift(P); P.place = G.players.filter((x) => x.alive).length + 1;
  hudMsg(P !== G.me ? `${P.name} is out · ${G.players.filter((x) => x.alive).length} left` : 'YOU FELL!', 1.6, P !== G.me ? '#c8c0e8' : '#ff3355');
  sfx('out', P);
}

// ---------- bots: plan a route over solid tiles, hop tile to tile, jump only short gaps ----------
function linkTiles() {
  for (const t of G.tiles) {
    t.nb = []; t.jn = [];
    for (const u of G.tiles) { if (u === t || u.l !== t.l) continue; const d = Math.hypot(u.x - t.x, u.z - t.z); if (d < 1.9) t.nb.push(u); else if (d < 3.7) t.jn.push(u); }
  }
}
const nearestSolid = (p, l, max = 2.6) => { let b = null, bd = max; for (const t of G.tiles) { if (t.l !== l || t.state !== 'solid') continue; const d = Math.hypot(t.x - p.x, t.z - p.z); if (d < bd) { bd = d; b = t; } } return b; };
function planRoute(P, p, here, myL) {
  // cheapest routes over solid tiles from where I stand: walking costs 1 a tile, hopping a hole costs 4
  const start = here && here.state !== 'gone' ? here : nearestSolid(p, myL);
  P.route = null;
  if (!start) return;
  const cost = new Map([[start, 0]]), prev = new Map([[start, null]]), open = [start], done = [];
  while (open.length && done.length < 70) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (cost.get(open[i]) < cost.get(open[bi])) bi = i;
    const t = open.splice(bi, 1)[0]; done.push(t);
    for (const [list, c, jump] of [[t.nb, 1, false], [t.jn, 4, true]]) for (const u of list) {
      if (u.state !== 'solid') continue; const nc = cost.get(t) + c;
      if (nc < (cost.get(u) ?? 1e9)) { cost.set(u, nc); prev.set(u, { from: t, jump }); open.push(u); }
    }
  }
  let best = null, bs = -1e9;
  for (const t of done) {
    if (t === start) continue;
    let n = 0; for (const u of t.nb) if (u.state === 'solid') n++;
    const d = Math.hypot(t.x - p.x, t.z - p.z);
    const vl = Math.hypot(P.vel.x, P.vel.z) || 1, ahead = ((t.x - p.x) * P.vel.x + (t.z - p.z) * P.vel.z) / (vl * (d || 1));   // keep going the way I am going
    const sc = n * 1.2 * P.skill - Math.abs(d - 3.5) * 0.4 - cost.get(t) * 0.35 - t.ring * 0.12 + ahead * 1.2 + Math.random() * 2 * (1.1 - P.skill);
    if (sc > bs) { bs = sc; best = t; }
  }
  if (best) { const r = []; for (let t = best; t && t !== start; t = prev.get(t).from) r.unshift({ t, jump: prev.get(t).jump }); P.route = r; }
}
function botThink(P, dt) {
  const I = P.input; I.jump = false;
  if (!P.alive || G.phase !== 'live') { I.x = I.y = 0; return; }
  const p = P.ch.pos(), myL = Math.max(0, Math.min(LAYERS - 1, Math.round(-p.y / GAP)));
  if (!P.grounded) {
    // in the air: aim for the tile I jumped to, else the best solid tile I can still land on
    let b = P.aim && P.aim.state === 'solid' ? P.aim : null;
    if (!b) { let bs = 1e9; for (const t of G.tiles) { if (t.state !== 'solid' || t.y > p.y + 0.2) continue; const d = Math.hypot(t.x - p.x, t.z - p.z); if (d > 5) continue; const sc = d + (p.y - t.y) * 0.4; if (sc < bs) { bs = sc; b = t; } } }
    if (b) { const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz); I.x = d > 0.25 ? dx / d : 0; I.y = d > 0.25 ? dz / d : 0; }
    P.route = null; return;
  }
  P.aim = null;
  const here = tileUnder(p) || nearestSolid(p, myL, 1.2);
  P.think -= dt;
  const stale = !P.route || !P.route.length || P.route.slice(0, 2).some((s) => s.t.state !== 'solid');
  if (P.think <= 0 || stale) { P.think = 1.6 + Math.random() * 1.2; planRoute(P, p, here, myL); }
  let step = P.route && P.route[0];
  if (step && Math.hypot(step.t.x - p.x, step.t.z - p.z) < 0.55) { P.route.shift(); step = P.route[0]; if (!step) { planRoute(P, p, here, myL); step = P.route && P.route[0]; } }
  if (!step) { I.x = Math.sin(G.t * 2 + P.i) * 0.5; I.y = Math.cos(G.t * 1.7 + P.i) * 0.5; return; }   // nothing reachable: wander, and drop a floor
  const wp = step.t, dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz) || 1;
  const hurry = step.jump || !here || here.state !== 'solid';
  const sp = hurry ? 1 : 0.6 + 0.15 * Math.random();
  I.x = (dx / d) * sp; I.y = (dz / d) * sp;
  if (step.jump && d < 2.6 && Math.random() < 0.6 + 0.4 * P.skill) { I.jump = true; P.aim = wp; }
}

// ---------- sound ----------
const sfx = (k, at) => {
  const A = K3.audio, me = at === G.me || (at && at.l === undefined && at === G.me);
  if (k === 'jump') A.tone(520, 0.08, 'triangle', at === G.me ? 0.05 : 0.015, 300);
  if (k === 'bounce') A.tone(300, 0.25, 'sine', 0.06, 700);
  if (k === 'drop') A.tone(140 + Math.random() * 60, 0.12, 'square', 0.012, -80);
  if (k === 'out') A.tone(400, 0.5, 'sawtooth', at === G.me ? 0.06 : 0.02, -320);
  if (k === 'surge') { A.tone(90, 0.6, 'sawtooth', 0.05, 40); A.tone(180, 0.6, 'square', 0.03, 60); }
  if (k === 'win') [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => A.tone(f, 0.18, 'square', 0.05), i * 120));
};

// ---------- HUD ----------
const hud = document.createElement('div');
hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;font-family:Orbitron,Segoe UI,sans-serif;color:#fff;text-shadow:0 2px 6px #000';
hud.innerHTML = `<div data-left style="position:absolute;top:12px;left:50%;transform:translateX(-50%);font-weight:900;font-size:22px;letter-spacing:2px"></div>
  <div data-msg style="position:absolute;top:28%;left:0;right:0;text-align:center;font-weight:900;font-size:clamp(28px,6vw,60px);letter-spacing:3px;opacity:0;transition:opacity .25s"></div>
  <div data-surge style="position:absolute;top:44px;left:50%;transform:translateX(-50%);font-size:12px;letter-spacing:2px;color:#ff2bd6"></div>`;
K3.hud.appendChild(hud);
let msgT = 0;
const hudMsg = (t, s = 1.4, c = '#fff') => { const e = hud.querySelector('[data-msg]'); e.textContent = t; e.style.color = c; e.style.opacity = 1; msgT = s; };

// ---------- flow ----------
function menu() {
  G.phase = 'menu'; K3.playing = false; K3.setTouchButtons([]); hud.style.display = 'none'; document.exitPointerLock?.();
  if (N) return lobby.show();
  const b = (k, opts) => opts.map(([v, l]) => `<button class="k3-btn ${G.cfg[k] == v ? 'sel' : ''}" data-k="${k}" data-v="${v}">${l}</button>`).join('');
  const el = K3.shell.screen(`<div class="k3-title">FLOORFALL</div>
    <div class="k3-sub">Five floors of glowing hex tiles. Every tile you stand on cracks and drops. Keep moving, jump the holes, land on the floor below - fall out of the bottom and you are out. Gold tiles bounce you up a floor. Every 14 s a SURGE rips a line through every floor. Last one standing wins.</div>
    <div class="k3-label">PLAYERS</div><div class="k3-row">${b('bots', [[3, 'YOU + 3'], [5, 'YOU + 5'], [7, 'YOU + 7']])}</div>
    <div class="k3-label">BOTS</div><div class="k3-row">${b('diff', [['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']])}</div>
    <div class="k3-row"><button class="k3-btn primary" data-play style="min-width:220px;font-size:18px">▶ PLAY</button><button class="k3-btn" data-set>SETTINGS</button></div>
    <div class="k3-sub" style="font-size:13px">${K3.isTouch ? 'left side: run · right side: turn the camera · JUMP button' : 'WASD / arrows run · mouse turns the camera · SPACE jump'}</div>`);
  el.querySelectorAll('[data-k]').forEach((x) => (x.onclick = () => { G.cfg[x.dataset.k] = isNaN(x.dataset.v) ? x.dataset.v : Number(x.dataset.v); localStorage.setItem('ff_cfg', JSON.stringify(G.cfg)); menu(); }));
  el.querySelector('[data-set]').onclick = () => K3.shell.settings(menu);
  el.querySelector('[data-play]').onclick = () => { K3.audio.unlock(); start(); };
}
function clearPlayers() { G.players.forEach((P) => { P.ch.destroy(); P.av.dispose(); }); G.players = []; G.place = []; G.me = null; }
function start(go = null) {
  clearPlayers();
  if (go) {
    // online: the party first (in party order), then bots up to the chosen size; the same tiles for everyone
    const rnd = mulberry(go.seed);
    buildTiles(rnd);
    G.spectator = !go.ids.includes(N.me) || !!go.late;
    G.total = Math.max(go.ids.length, go.cfg.size); G.cfg.diff = go.cfg.diff;
    go.ids.forEach((id, i) => G.players.push(makePlayer(i, false, { nid: id, owner: id, remote: id !== N.me || G.spectator, name: N.name(id) })));
    for (let i = go.ids.length, b = 0; i < G.total; i++, b++) { const P = makePlayer(i, true, { nid: 'b' + b, owner: N.hostId, remote: !N.isHost, name: NAMES[1 + (b % 7)] }); P.skill = { easy: 0.6, normal: 0.8, hard: 0.95 }[go.cfg.diff] * (0.85 + rnd() * 0.3); G.players.push(P); }
    G.players.forEach((P) => { if (P.remote) P.interp = new Interp(0.1); });
    G.me = G.players.find((P) => P.nid === N.me && !G.spectator) || null;
  } else {
    G.total = G.cfg.bots + 1;
    buildTiles();
    for (let i = 0; i <= G.cfg.bots; i++) G.players.push(makePlayer(i, i > 0));
    G.me = G.players[0];
  }
  if (!G.me) {
    // watching (arrived late): follow the others
    G.me = { ghost: true, alive: false, ch: { pos: () => ({ x: 0, y: 0, z: 0 }) }, input: { x: 0, y: 0 }, yaw: 0, place: 0, bot: false, name: 'YOU' };
  } else {
    const arrow = V.CreateCylinder('me', { diameterTop: 0, diameterBottom: 0.36, height: 0.32, tessellation: 3 }, S); arrow.rotation.x = Math.PI; arrow.parent = G.me.av.root; arrow.position.y = 2.05; arrow.isPickable = false;
    arrow.material = (() => { const m = new V.StandardMaterial('arr', S); m.emissiveColor = V.Color3.FromHexString('#ffd93a'); m.disableLighting = true; return m; })();
  }
  cam.yaw = G.me.yaw; cam.ready = false;
  G.phase = 'count'; G.phaseT = 3; G.t = 0; G.surgeT = FIRST_SURGE;
  K3.shell.screen(''); hud.style.display = '';
  K3.setTouchButtons([{ a: 'jump', label: 'JUMP', right: 30, bottom: 40, size: 90, big: true }]);
  K3.playing = true; K3.paused = false; K3.menuOpen = false; if (!K3.isTouch && !K3.test) K3.canvas.requestPointerLock?.(); K3.canvas.focus();
  if (!G.me.ghost) window.XC?.start();
  hudMsg(G.me.ghost ? 'WATCHING' : '3', 0.9);
}
function finish(places = null) {
  if (G.phase === 'over') return;
  // online: the host's places (it saw every fall) win over my own guess
  if (N && N.isHost && !places) places = G.players.map((P) => [P.nid, P.alive ? 1 : P.place]);
  if (N && N.isHost) N.send({ k: 'fin', places, t: G.t });
  G.phase = 'over'; K3.playing = false; K3.menuOpen = false; document.exitPointerLock?.(); K3.setTouchButtons([]);
  if (places) for (const [nid, pl] of places) { const P = G.players.find((x) => x.nid === nid); if (P) P.place = pl; }
  else { const alive = G.players.filter((P) => P.alive); alive.forEach((P) => { P.place = 1; G.place.unshift(P); }); }
  const won = G.me.place === 1, n = G.players.length;
  if (won) sfx('win');
  const score = (n - G.me.place) * 100 + (won ? 500 : 0) + Math.round(G.t) * 2;
  if (!G.me.ghost) window.XC?.end({ score, won, stats: { won: won ? 1 : 0 } });
  const order = G.players.slice().sort((a, b) => a.place - b.place);
  const el = K3.shell.screen(`<div class="k3-title" style="font-size:48px">${G.me.ghost ? 'GAME OVER' : won ? 'LAST ONE STANDING!' : `#${G.me.place} OF ${n}`}</div>
    <div class="k3-sub">${order.map((P) => `<span style="color:${PLAYER_COL[P.i % 8]}">#${P.place} ${P === G.me ? 'YOU' : P.name}</span>`).join(' · ')}</div>
    <div class="k3-sub">${G.me.ghost ? '' : `${score} points · `}survived ${Math.round(G.t)} s</div>
    <div class="k3-row">${!N ? '<button class="k3-btn primary" data-a>PLAY AGAIN</button><button class="k3-btn" data-m>MENU</button>' : N.isHost ? '<button class="k3-btn primary" data-lobby>BACK TO LOBBY</button><button class="k3-btn" data-leave>LEAVE</button>' : `<div class="k3-sub">waiting for <b>${N.name(N.hostId)}</b>...</div><button class="k3-btn" data-leave>LEAVE</button>`}</div>`);
  el.querySelector('[data-a]')?.addEventListener('click', () => start());
  el.querySelector('[data-m]')?.addEventListener('click', () => menu());
  el.querySelector('[data-lobby]')?.addEventListener('click', () => lobby.backToLobby());
  el.querySelector('[data-leave]')?.addEventListener('click', () => (window.XC ? XC.exit() : history.back()));
}

// SURGE: a straight line of tiles through every floor starts cracking (the host picks the line, everyone cracks the same tiles)
function surge(a, off, seed) {
  if (N && N.isHost) N.send({ k: 'sg', a, off, seed });
  G.surgeT = SURGE_EVERY; const nx = Math.cos(a), nz = Math.sin(a), rnd = mulberry(seed);
  for (const t of G.tiles) if (t.state === 'solid' && t.l < LAYERS - 1 && Math.abs(t.x * nz - t.z * nx - off) < 1.2) crack(t, 0.9 + rnd() * 0.3);   // never the last floor
  hudMsg('SURGE!', 1.1, '#ff2bd6'); sfx('surge'); cam.shake = 0.4;
}
function update(dt) {
  if (G.phase === 'menu' || G.phase === 'over' || !G.me) return;
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) hud.querySelector('[data-msg]').style.opacity = 0; }
  if (G.phase === 'count') { const before = Math.ceil(G.phaseT); G.phaseT -= dt; const now = Math.ceil(G.phaseT); if (now !== before && now > 0) { hudMsg(String(now), 0.9); K3.audio.tone(440, 0.1, 'square', 0.04); } if (G.phaseT <= 0) { G.phase = 'live'; hudMsg('GO!', 0.7, '#3dffa0'); K3.audio.tone(880, 0.15, 'square', 0.05); } }
  // my input, relative to the camera
  const mv = K3.input.move, s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
  if (G.me.alive) { G.me.input.x = mv.x * c + mv.y * s; G.me.input.y = -mv.x * s + mv.y * c; G.me.input.jump = K3.input.tap('jump'); }
  for (const P of G.players) if (P.bot && !P.remote) botThink(P, dt);
  for (const P of G.players) { if (P.remote) followNet(P, dt); else stepPlayer(P, dt); }
  if (N) netTick(dt);
  if (G.phase === 'live') {
    G.t += dt;
    stepTiles(dt);
    G.surgeT -= dt;
    if (G.surgeT <= 0 && (!N || N.isHost)) surge(Math.random() * Math.PI, (Math.random() - 0.5) * 6, Math.floor(Math.random() * 1e9));
    const alive = G.players.filter((P) => P.alive);
    if ((!N || N.isHost) && (alive.length <= 1 || (!G.me.alive && G.cfg.endOnOut && !N))) finish();
  }
}
let specI = 0;
function render(alpha, dt) {
  for (const P of G.players) {
    const p0 = P.prev, p1 = P.ch.pos(), x = p0.x + (p1.x - p0.x) * alpha, y = p0.y + (p1.y - p0.y) * alpha, z = p0.z + (p1.z - p0.z) * alpha;
    P.av.root.position.set(x, y, z);
    const cur = P.av.root.rotation.y, d = Math.atan2(Math.sin(P.yaw - cur), Math.cos(P.yaw - cur)); P.av.root.rotation.y = cur + d * Math.min(1, dt * 14);
    if (!P.alive) continue;
    const sp = Math.hypot(P.vel.x, P.vel.z);
    if (G.phase === 'over' && P.place === 1) P.av.play('Wave');
    else if (!P.grounded) P.av.play(P.vel.y > 1 ? 'Jump' : 'Jump_Idle', { loop: P.vel.y <= 1 });
    else if (P.landT > 0) { P.landT -= dt; P.av.play('Jump_Land', { loop: false }); }
    else if (sp > 0.6) P.av.play('Run', { speed: Math.max(0.7, sp / RUN) * 1.1 });
    else P.av.play('Idle');
  }
  if (G.debugCam) { cam.cam.position.set(...G.debugCam.pos); cam.cam.setTarget(new V.Vector3(...G.debugCam.at)); return; }
  if (G.phase === 'menu' || !G.me) { const t = performance.now() / 8000; cam.yaw = t; cam.update({ x: 0, y: -4, z: 0 }, dt, false); cam.cam.position.set(Math.sin(t) * 22, 8, Math.cos(t) * 22); cam.cam.setTarget(new V.Vector3(0, -8, 0)); return; }
  // follow me, or a survivor once I am out
  let who = G.me;
  if (!G.me.alive) { const alive = G.players.filter((P) => P.alive); if (alive.length) { if (K3.input.tap('jump')) specI++; who = alive[specI % alive.length]; } }
  if (who.ghost) return;
  cam.update(who.ch.pos(), dt);
  // floors above the one you are on fade out so they never block the view
  const myL = Math.round(-who.ch.pos().y / GAP);
  hexSrc.forEach((h, l) => { const want = l < myL ? 0.12 : 1; h.material.alpha += (want - h.material.alpha) * Math.min(1, dt * 6); h.material.needDepthPrePass = h.material.alpha < 1; });
  hud.querySelector('[data-left]').textContent = G.phase === 'live' || G.phase === 'count' ? `${G.players.filter((P) => P.alive).length} LEFT${G.me.alive ? '' : ` · watching ${who === G.me ? 'you' : who.name}`}` : '';
  hud.querySelector('[data-surge]').textContent = G.phase === 'live' ? `SURGE IN ${Math.max(0, Math.ceil(G.surgeT))}` : '';
}


// ================= ONLINE =================
const lobby = N && onlineLobby(K3, N, {
  title: 'FLOORFALL',
  sub: 'ONLINE · last one standing · bots fill the floor up to the size you pick',
  hostOpts: [
    { key: 'size', label: 'PLAYERS ON THE FLOOR', opts: [[4, '4'], [6, '6'], [8, '8']], ok: (v, n) => v >= n },
    { key: 'diff', label: 'BOTS', opts: [['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']] },
  ],
  myOpts: [],
  cfg: { size: 8, diff: G.cfg.diff },
  mine: {},
  onStart: (go) => start(go),
  onShow: () => { clearPlayers(); G.phase = 'menu'; hud.style.display = 'none'; },
});
if (N) netBadge(K3, N, { left: 12, top: 12 });
const r2 = (v) => Math.round(v * 100) / 100;
let sendAcc = 0, crackQ = [];
// the tiles I (or my bots) cracked go out in small batches
function netCrack(t, d, b) { if (N) crackQ.push([t.i, d, b]); }
function netTick(dt) {
  sendAcc += dt;
  if (crackQ.length && (sendAcc >= 1 / 30 || crackQ.length > 8)) { N.send({ k: 'c', l: crackQ }); crackQ = []; }
  if (sendAcc < 1 / 30) return;
  sendAcc = 0;
  const mine = G.players.filter((P) => !P.remote && P.alive);
  if (mine.length) N.send({ k: 's', t: N.now(), p: mine.map((P) => { const q = P.ch.pos(); return [P.nid, r2(q.x), r2(q.y), r2(q.z), r2(P.vel.x), r2(P.vel.y), r2(P.vel.z), r2(P.yaw), P.grounded ? 1 : 0]; }) }, { fast: true });
}
function followNet(P, dt) {
  P.prev = P.ch.pos();
  const s = P.alive && P.interp && P.interp.sample(); if (!s) return;
  const { a, b, k } = s, kk = Math.min(1.25, k);
  const x = lerp(a[1], b[1], kk), y = lerp(a[2], b[2], kk), z = lerp(a[3], b[3], kk), h = P.ch.height / 2;
  P.ch.body.setTranslation({ x, y: y + h, z }, true); P.ch.body.setNextKinematicTranslation({ x, y: y + h, z });
  P.vel = { x: b[4], y: b[5], z: b[6] }; P.yaw = lerpAngle(a[7], b[7], kk);
  const was = P.grounded; P.grounded = !!b[8]; if (P.grounded && !was) P.landT = 0.18;
}
// a player left / the host changed: their character is now a bot run by the host
function reassign() {
  for (const P of G.players) {
    if (N.players.some((p) => p.id === P.owner)) continue;
    P.owner = N.hostId;
    if (!P.bot && !N.players.some((p) => p.id === P.nid)) { P.bot = true; P.name += ' (BOT)'; P.skill = 0.8; }
    if (P.owner === N.me && P.remote) { P.remote = false; P.interp = null; P.route = null; if (P.alive) P.ch.collider.setEnabled(true); }
  }
}
if (N) {
  N.on((d, from) => {
    if (!d || !d.k || d.k[0] === 'L' || !G.players.length) return;
    const P = (nid) => G.players.find((x) => x.nid === nid);
    if (d.k === 's') { for (const st of d.p) { const Q = P(st[0]); if (Q && Q.remote && Q.owner === from) Q.interp.push(st, d.t); } return; }
    if (d.k === 'c') { for (const [i, dl, b] of d.l) { const t = G.tiles[i]; if (!t || t.state !== 'solid') continue; if (b) t.bounce = false; crack(t, dl); } return; }
    if (d.k === 'out') { const Q = P(d.n); if (Q && Q.owner === from) eliminate(Q, true); return; }
    if (from !== N.hostId || N.isHost) return;
    if (d.k === 'sg') surge(d.a, d.off, d.seed);
    if (d.k === 'fin') { G.t = d.t; finish(d.places); }
  });
  N.onLeave(() => { if (G.players.length) { reassign(); hudMsg('a player left · a bot takes over', 1.6, '#c8c0e8'); } });
  N.onHost((id) => { if (G.players.length) reassign(); });
}

K3.shell.loading(0.3);
makeAvatar = await avatars(K3, 'assets/common/buddy.glb', { height: 1.5 });
buildTiles();
K3.shell.loading(1);
K3.loop(update, render);
menu();
G.simulate = (n) => { for (let i = 0; i < n; i++) { update(1 / 60); K3.world.step(); } };
const Q = new URLSearchParams(location.search);
if (Q.has('auto')) start();
