// DISASTER ISLAND - survive flood, meteors, a tornado and lightning on a small island. Last one standing (or everyone
// who lives through all six) wins. The host picks the disasters and every meteor / lightning strike; each player
// moves their own character and reports their own death.
import { boot, V } from '../../kit3d/kit3d.js';
import { avatars } from '../../kit3d/avatar.js';
import { tpcam } from '../../kit3d/tpcam.js';
import { net3d, Interp, lerp, lerpAngle } from '../../kit3d/net3d.js';
import { onlineLobby, netBadge } from '../../kit3d/online.js';

const RUN = 7, JUMP_V = 8.2, GRAV = 22, HALF = 24, ROUNDS = 6, DIS_T = 18, CALM_T = 5;
const PCOL = ['#ffffff', '#ff2bd6', '#ffd93a', '#3dffa0', '#ff8a3a', '#8b5cf6', '#ff3355', '#22e6ff'];
const NAMES = ['YOU', 'PIP', 'ZAPPY', 'MOCHI', 'BLINK', 'NOODLE', 'TOAST', 'BOOP'];
const KINDS = ['flood', 'meteors', 'tornado', 'lightning'];
const TITLE = { flood: ['FLOOD!', 'get up high - the sea is rising'], meteors: ['METEOR SHOWER!', 'run from the glowing rings'], tornado: ['TORNADO!', 'keep away from the twister'], lightning: ['LIGHTNING STORM!', 'it hits the HIGH ground first - stay low'] };

const K3 = await boot({ title: 'DISASTER ISLAND', gravity: 22, actions: { jump: ['Space'] } });
const N = await net3d(window.XC?.net);
K3.online = !!N;
const S = K3.scene;
const G = { phase: 'menu', players: [], t: 0, cfg: Object.assign({ bots: 5, diff: 'normal' }, JSON.parse(localStorage.getItem('di_cfg') || '{}')), hz: [], dz: null, round: 0 };
window.__D = G;

// ---------- scene ----------
S.clearColor = new V.Color4(0.42, 0.62, 0.86, 1);
const hemi = new V.HemisphericLight('h', new V.Vector3(0.3, 1, -0.2), S); hemi.intensity = 0.95; hemi.groundColor = new V.Color3(0.3, 0.3, 0.35);
const sun = new V.DirectionalLight('s', new V.Vector3(-0.4, -1, 0.5), S); sun.intensity = 0.8;
if (K3.quality === 'high') { const sg = new V.ShadowGenerator(1024, sun); sg.usePercentageCloserFiltering = true; sg.darkness = 0.35; K3.shadow = sg; }
S.fogMode = 2; S.fogDensity = 0.006; S.fogColor = new V.Color3(0.55, 0.7, 0.88);
const cam = tpcam(K3, { dist: 8, height: 1.6, pitch: 0.42 });
const matC = {}, mat = (hex, em = 0, a = 1) => matC[hex + em + a] || (matC[hex + em + a] = (() => { const m = new V.StandardMaterial('m', S), c = V.Color3.FromHexString(hex); m.diffuseColor = c; m.emissiveColor = c.scale(em); m.specularColor = new V.Color3(0.1, 0.1, 0.1); m.alpha = a; return m; })());
function block(x, y, z, w, h, d, hex) { const m = V.CreateBox('b', { width: w, height: h, depth: d }, S); m.position.set(x, y + h / 2, z); m.material = mat(hex); m.isPickable = false; m.receiveShadows = true; K3.shadow?.addShadowCaster(m); K3.phys.box(x, y + h / 2, z, w / 2, h / 2, d / 2); return m; }
block(0, -1, 0, HALF * 2, 1, HALF * 2, '#e8d49a');                                     // the island (sand)
block(0, -0.95, 0, HALF * 2 - 8, 1, HALF * 2 - 8, '#6cb04a');                         // grass
for (const [x, z, w, d] of [[0, -HALF - 0.5, HALF * 2 + 2, 1], [0, HALF + 0.5, HALF * 2 + 2, 1], [-HALF - 0.5, 0, 1, HALF * 2], [HALF + 0.5, 0, 1, HALF * 2]]) K3.phys.box(x, 2, z, w / 2, 4, d / 2);   // invisible walls round the island
// high ground: two towers with stairs (0.3 m steps) and a stepped hill (jump up each level)
const SAFE = [];
function tower(x, z, H, dir) {
  block(x, 0, z, 4, H, 4, '#b8b0a0'); block(x, H, z, 4.4, 0.2, 4.4, '#8a8070');
  const n = Math.round(H / 0.3), steps = [];
  for (let k = 1; k <= n; k++) { const off = 2 + (n - k) * 0.9 + 0.45; const sx = x + dir[0] * off, sz = z + dir[1] * off; block(sx, 0, sz, dir[0] ? 0.9 : 2, k * 0.3, dir[0] ? 2 : 0.9, k % 2 ? '#d0c8b8' : '#c0b8a8'); steps.push({ x: sx, y: k * 0.3, z: sz }); }
  SAFE.push({ x, z, top: H + 0.2, path: [{ x: x + dir[0] * (2 + n * 0.9 + 1), y: 0, z: z + dir[1] * (2 + n * 0.9 + 1) }, ...steps.reverse().slice(0).reverse().filter((_, i) => i % 3 === 0), { x, y: H + 0.2, z }] });
}
tower(-12, -10, 4.8, [1, 0]); tower(13, 9, 4.8, [-1, 0]);
for (const [s, h] of [[14, 1.1], [9, 2.2], [4, 3.3]]) block(-10, 0, 12, s, h, s, ['#5a9a3a', '#6aaa44', '#7aba4e'][Math.round(h / 1.1) - 1]);
SAFE.push({ x: -10, z: 12, top: 3.3, path: [{ x: -10, y: 0, z: 20 }, { x: -10, y: 1.1, z: 18.5 }, { x: -10, y: 2.2, z: 16 }, { x: -10, y: 3.3, z: 12 }], jumpy: true });
for (let i = 0; i < 18; i++) { const a = i * 1.7, r = 8 + (i * 7) % 12, x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x + 12, z + 10) < 8 || Math.hypot(x - 13, z - 9) < 8 || Math.hypot(x + 10, z - 12) < 9) continue; const t = V.CreateCylinder('tr', { diameter: 0.4, height: 2.2 }, S); t.position.set(x, 1.1, z); t.material = mat('#7a5230'); const c = V.CreateSphere('cr', { diameter: 2.4, segments: 8 }, S); c.position.set(x, 2.8, z); c.material = mat('#3a8a3a'); [t, c].forEach((m) => { m.isPickable = false; K3.shadow?.addShadowCaster(m); }); }
const sea = V.CreateGround('sea', { width: 400, height: 400 }, S); sea.position.y = -0.4; sea.material = mat('#2a6ad8', 0.15, 0.82); sea.isPickable = false;
K3.world.updateSceneQueries();
// hazard visuals
const ringM = mat('#ff3355', 0.8, 0.55), boltM = mat('#fff7b0', 1), rockM = mat('#5a3a2a', 0.3);
const tw = V.CreateCylinder('tw', { diameterTop: 9, diameterBottom: 1.6, height: 14, tessellation: 18 }, S); tw.material = mat('#9a9aa8', 0.2, 0.55); tw.setEnabled(false); tw.isPickable = false;

// ---------- the disasters: flood level and the tornado's path come from the clock; strikes come from the host ----------
const flood = (dt) => { const D = G.dz; if (!D || D.kind !== 'flood') return -0.4; const k = (G.t - D.t0) / DIS_T; return k < 0.75 ? -0.4 + (D.max + 0.4) * Math.min(1, k / 0.6) : -0.4 + (D.max + 0.4) * Math.max(0, 1 - (k - 0.75) / 0.25); };
const twister = () => { const D = G.dz, t = G.t - D.t0, s = D.seed; return { x: Math.sin(t * 0.37 + s) * 13 + Math.sin(t * 0.91 + s * 2) * 5, z: Math.cos(t * 0.29 + s * 3) * 13 + Math.cos(t * 0.77 + s) * 5 }; };
function hazardFx(h) {
  h.ring = V.CreateTorus('ring', { diameter: h.r * 2, thickness: 0.15, tessellation: 28 }, S); h.ring.position.set(h.x, h.y + 0.08, h.z); h.ring.material = ringM; h.ring.isPickable = false;
  if (h.kind === 'meteor') { h.rock = V.CreateSphere('rock', { diameter: 1.4, segments: 6 }, S); h.rock.material = rockM; h.rock.isPickable = false; }
}
function stepHazards(dt) {
  for (const h of G.hz) {
    const left = h.at - G.t;
    if (h.rock) { const k = Math.max(0, left / h.warn); h.rock.position.set(h.x + k * 14, h.y + k * 40, h.z - k * 6); }
    if (left <= 0 && !h.hit) {
      h.hit = true; h.ring.dispose(); h.rock?.dispose();
      if (h.kind === 'bolt') { const b = V.CreateCylinder('bolt', { diameter: 0.35, height: 60 }, S); b.position.set(h.x, h.y + 30, h.z); b.material = boltM; b.isPickable = false; setTimeout(() => b.dispose(), 160); K3.audio.tone(90, 0.35, 'sawtooth', 0.05, -40); }
      else { K3.audio.tone(70, 0.3, 'square', 0.05, -30); cam.shake = Math.max(cam.shake, 0.25); }
      for (const P of G.players) { if (P.remote || !P.alive) continue; const f = P.ch.pos(), d = Math.hypot(f.x - h.x, f.z - h.z); if (d < h.r && Math.abs(f.y - h.y) < 2.5) die(P, h.kind === 'bolt' ? 'struck by lightning' : 'hit by a meteor'); else if (h.kind === 'meteor' && d < h.r + 2.5) { P.vel.x += ((f.x - h.x) / (d || 1)) * 8; P.vel.z += ((f.z - h.z) / (d || 1)) * 8; P.vel.y = 6; P.grounded = false; } }
    }
  }
  G.hz = G.hz.filter((h) => !h.hit);
}
// the host: what happens next
function hostDisasters(dt) {
  if (G.phase !== 'live') return;
  const D = G.dz;
  if (!D) { G.calm -= dt; if (G.calm <= 0) { if (G.round >= ROUNDS) return finish(); G.round++; const kind = G.order[(G.round - 1) % 4]; startDisaster({ kind, t0: G.t, seed: Math.random() * 100, max: 2.2 + G.round * 0.25, round: G.round }); } return; }
  if (G.t - D.t0 > DIS_T) { endDisaster(); return; }
  const inten = 1 + G.round * 0.18;
  D.acc = (D.acc || 0) + dt * inten;
  const every = D.kind === 'meteors' ? 0.55 : D.kind === 'lightning' ? 0.42 : 99;
  while (D.acc >= every) {
    D.acc -= every;
    const alive = G.players.filter((P) => P.alive);
    let x, z;
    if (D.kind === 'lightning' && Math.random() < 0.6) { const hi = alive.slice().sort((a, b) => b.ch.pos().y - a.ch.pos().y)[0]; const f = hi ? hi.ch.pos() : { x: 0, z: 0 }; x = f.x + (Math.random() - 0.5) * 3; z = f.z + (Math.random() - 0.5) * 3; }   // high ground first
    else if (alive.length && Math.random() < 0.45) { const f = alive[Math.floor(Math.random() * alive.length)].ch.pos(); x = f.x + (Math.random() - 0.5) * 6; z = f.z + (Math.random() - 0.5) * 6; }
    else { x = (Math.random() - 0.5) * (HALF * 2 - 4); z = (Math.random() - 0.5) * (HALF * 2 - 4); }
    const h = { kind: D.kind === 'meteors' ? 'meteor' : 'bolt', x, z, y: groundY(x, z), r: D.kind === 'meteors' ? 2.4 : 1.8, warn: D.kind === 'meteors' ? 1.3 : 0.9 };
    h.at = G.t + h.warn;
    addHazard(h); if (N) N.send({ k: 'hz', h: { kind: h.kind, x: +x.toFixed(2), z: +z.toFixed(2), y: h.y, r: h.r, warn: h.warn } });
  }
}
const groundY = (x, z) => { const h = K3.phys.ray({ x, y: 30, z }, { x: 0, y: -1, z: 0 }, 40); return h ? h.point.y : 0; };
function addHazard(h) { h.at = h.at ?? G.t + h.warn; hazardFx(h); G.hz.push(h); }
function startDisaster(D) { G.dz = D; const [a, b] = TITLE[D.kind]; hudMsg(a, 2.2, '#ff8a3a', b); K3.audio.tone(220, 0.5, 'sawtooth', 0.05, 220); if (N && N.isHost) N.send({ k: 'dz', d: { kind: D.kind, seed: D.seed, max: D.max, round: D.round } }); }
function endDisaster() { G.dz = null; G.calm = CALM_T; G.hz.forEach((h) => { h.ring?.dispose(); h.rock?.dispose(); }); G.hz = []; const alive = G.players.filter((P) => P.alive).length; hudMsg('SURVIVED!', 1.4, '#3dffa0', `${alive} left · ${ROUNDS - G.round} to go`); if (N && N.isHost) N.send({ k: 'dzend' }); for (const P of G.players) if (P.alive) P.survived = G.round; }

// ---------- players ----------
let makeAvatar = null;
function makePlayer(i, bot, o = {}) {
  const a = (i / 8) * Math.PI * 2, ch = K3.phys.character({ x: Math.cos(a) * 5, y: 0.1, z: Math.sin(a) * 5, radius: 0.35, height: 1.5 });
  const P = { i, bot, nid: o.nid ?? i, owner: o.owner, remote: !!o.remote, name: o.name || (bot ? NAMES[i % 8] : (K3.xc?.player?.callsign || 'YOU')), ch, av: makeAvatar(PCOL[i % 8]), vel: { x: 0, y: 0, z: 0 }, yaw: a + Math.PI, alive: true, grounded: true, input: { x: 0, y: 0, jump: false }, prev: ch.pos(), under: 0, survived: 0, landT: 0, place: 0 };
  if (bot) P.skill = { easy: 0.55, normal: 0.75, hard: 0.92 }[G.cfg.diff] * (0.85 + Math.random() * 0.3);
  return P;
}
function stepPlayer(P, dt) {
  P.prev = P.ch.pos();
  if (!P.alive) return;
  const I = P.input; let wx = I.x, wz = I.y; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
  const acc = (P.grounded ? 55 : 16) * dt, tx = wx * RUN, tz = wz * RUN, dx = tx - P.vel.x, dz = tz - P.vel.z, dl = Math.hypot(dx, dz);
  if (dl <= acc) { P.vel.x = tx; P.vel.z = tz; } else { P.vel.x += (dx / dl) * acc; P.vel.z += (dz / dl) * acc; }
  if (I.jump && P.grounded) { P.vel.y = JUMP_V; P.grounded = false; }
  // the tornado pulls you in and throws you round
  if (G.dz && G.dz.kind === 'tornado') { const T = twister(), f = P.ch.pos(), ddx = T.x - f.x, ddz = T.z - f.z, d = Math.hypot(ddx, ddz); if (d < 8) { const pull = (1 - d / 8) * 26 * dt; P.vel.x += (ddx / d) * pull - (ddz / d) * pull * 0.8; P.vel.z += (ddz / d) * pull + (ddx / d) * pull * 0.8; if (d < 2.2) { P.vel.y = Math.max(P.vel.y, 10); P.grounded = false; P.spun = (P.spun || 0) + dt; if (P.spun > 1.2) die(P, 'taken by the tornado'); } else P.spun = 0; } }
  P.vel.y -= GRAV * dt; if (P.grounded && P.vel.y < 0) P.vel.y = -2;
  const swim = flood() > P.ch.pos().y + 0.3;
  if (swim) { P.vel.y = Math.max(P.vel.y, -1.5); P.vel.x *= 1 - dt * 2; P.vel.z *= 1 - dt * 2; }
  P.ch.move(P.vel.x * dt, P.vel.y * dt, P.vel.z * dt);
  for (const n of P.ch.walls || []) { const l = Math.hypot(n.x, n.z) || 1, d = (P.vel.x * n.x + P.vel.z * n.z) / l; if (d < 0) { P.vel.x -= (d * n.x) / l; P.vel.z -= (d * n.z) / l; } }
  if (P.vel.y > 0 && P.ch.ceiling) P.vel.y = 0;
  const was = P.grounded; P.grounded = P.ch.grounded; if (P.grounded && !was) P.landT = 0.18;
  if (Math.hypot(P.vel.x, P.vel.z) > 0.5) P.yaw = Math.atan2(P.vel.x, P.vel.z);
  // drowning: the water over your head for 2 s
  const head = P.ch.pos().y + 1.25;
  P.under = flood() > head ? P.under + dt : Math.max(0, P.under - dt * 2);
  if (P.under > 2) die(P, 'drowned');
}
function die(P, why) {
  if (!P.alive) return;
  P.alive = false; P.why = why; P.ch.collider.setEnabled(false); P.av.root.setEnabled(false);
  P.place = G.players.filter((x) => x.alive).length + 1;
  if (N && !P.remote) N.send({ k: 'out', n: P.nid, why });
  hudMsg(P === G.me ? 'YOU ARE OUT' : `${P.name} is out`, 1.4, P === G.me ? '#ff3355' : '#fff', P === G.me ? why : `${G.players.filter((x) => x.alive).length} left`);
  K3.audio.tone(300, 0.4, 'sawtooth', P === G.me ? 0.06 : 0.02, -200);
  if ((!N || N.isHost) && G.players.filter((x) => x.alive).length <= (G.players.length > 1 && G.startN > 1 ? 1 : 0) && G.phase === 'live') setTimeout(finish, 1200);
}

// ---------- bots: get high for the flood, low for lightning, out of the rings, away from the twister ----------
function botThink(P, dt) {
  const I = P.input; I.x = I.y = 0; I.jump = false;
  if (!P.alive || G.phase !== 'live') return;
  const f = P.ch.pos(), D = G.dz;
  let tx = null, tz = null;
  if (D && D.kind === 'flood') {
    if (!P.safe) { P.safe = SAFE.slice().sort((a, b) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z))[Math.random() < P.skill ? 0 : 1]; P.si = 0; }
    const w = P.safe.path[Math.min(P.si, P.safe.path.length - 1)]; tx = w.x; tz = w.z;
    if (Math.hypot(w.x - f.x, w.z - f.z) < 0.8 && Math.abs(w.y - f.y) < 0.8) P.si++;
    if (P.safe.jumpy && P.grounded && w.y > f.y + 0.5 && Math.hypot(w.x - f.x, w.z - f.z) < 2.5) I.jump = true;
    if (P.si >= P.safe.path.length) { tx = P.safe.x; tz = P.safe.z; }
  } else {
    P.safe = null;
    // wander, but stay off the high ground in a lightning storm
    if (!P.goal || Math.hypot(P.goal.x - f.x, P.goal.z - f.z) < 1.5 || Math.random() < 0.004) P.goal = { x: (Math.random() - 0.5) * 36, z: (Math.random() - 0.5) * 36 };
    tx = P.goal.x; tz = P.goal.z;
    let fx = 0, fz = 0;
    for (const h of G.hz) { const d = Math.hypot(f.x - h.x, f.z - h.z); if (d < h.r + 2.5) { fx += (f.x - h.x) / (d || 1); fz += (f.z - h.z) / (d || 1); } }
    if (D && D.kind === 'tornado') { const T = twister(), d = Math.hypot(f.x - T.x, f.z - T.z); if (d < 14) { fx += ((f.x - T.x) / d) * 2; fz += ((f.z - T.z) / d) * 2; } }
    if ((fx || fz) && Math.random() < 0.3 + 0.7 * P.skill) { tx = f.x + fx * 5; tz = f.z + fz * 5; }
  }
  const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz);
  if (d > 0.3) { I.x = dx / d; I.y = dz / d; }
  if (P.grounded && (P.ch.walls || []).length && Math.random() < 0.3) I.jump = true;
}

// ---------- HUD ----------
const hud = document.createElement('div');
hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;font-family:Orbitron,Segoe UI,sans-serif;color:#fff;text-shadow:0 2px 6px #000';
hud.innerHTML = `<div data-top style="position:absolute;top:12px;left:50%;transform:translateX(-50%);font-weight:900;font-size:18px;letter-spacing:2px;text-align:center"></div>
  <div data-msg style="position:absolute;top:24%;left:0;right:0;text-align:center;font-weight:900;font-size:clamp(26px,5.6vw,56px);letter-spacing:3px;opacity:0;transition:opacity .25s"></div>
  <div data-sub style="position:absolute;top:calc(24% + 64px);left:0;right:0;text-align:center;font-size:16px;opacity:0;transition:opacity .25s"></div>
  <div data-air style="position:absolute;bottom:20%;left:50%;transform:translateX(-50%);font-weight:900;color:#22e6ff"></div>`;
K3.hud.appendChild(hud); hud.style.display = 'none';
let msgT = 0;
const hudMsg = (t, s = 1.4, c = '#fff', sub = '') => { const e = hud.querySelector('[data-msg]'), b = hud.querySelector('[data-sub]'); e.textContent = t; e.style.color = c; e.style.opacity = 1; b.textContent = sub; b.style.opacity = sub ? 1 : 0; msgT = s; };

// ---------- flow ----------
function clearPlayers() { G.players.forEach((P) => { P.ch.destroy(); P.av.dispose(); }); G.players = []; G.me = null; G.hz.forEach((h) => { h.ring?.dispose(); h.rock?.dispose(); }); G.hz = []; G.dz = null; }
function menu() {
  G.phase = 'menu'; K3.playing = false; K3.setTouchButtons([]); hud.style.display = 'none'; document.exitPointerLock?.();
  if (N) return lobby.show();
  const b = (k, opts) => opts.map(([v, l]) => `<button class="k3-btn ${G.cfg[k] == v ? 'sel' : ''}" data-k="${k}" data-v="${v}">${l}</button>`).join('');
  const el = K3.shell.screen(`<div class="k3-title">DISASTER ISLAND</div>
    <div class="k3-sub">FLOOD: get up high · METEORS: run from the glowing rings · TORNADO: keep away from the twister · LIGHTNING: it hits the high ground first. Six disasters, each one worse. Survive them all or be the last one standing.</div>
    <div class="k3-label">PLAYERS</div><div class="k3-row">${b('bots', [[3, 'YOU + 3'], [5, 'YOU + 5'], [7, 'YOU + 7']])}</div>
    <div class="k3-label">BOTS</div><div class="k3-row">${b('diff', [['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']])}</div>
    <div class="k3-row"><button class="k3-btn primary" data-play style="min-width:220px;font-size:18px">▶ SURVIVE</button><button class="k3-btn" data-set>SETTINGS</button></div>`);
  el.querySelectorAll('[data-k]').forEach((x) => (x.onclick = () => { G.cfg[x.dataset.k] = isNaN(x.dataset.v) ? x.dataset.v : Number(x.dataset.v); localStorage.setItem('di_cfg', JSON.stringify(G.cfg)); menu(); }));
  el.querySelector('[data-set]').onclick = () => K3.shell.settings(menu);
  el.querySelector('[data-play]').onclick = () => { K3.audio.unlock(); start(); };
}
function start(go = null) {
  clearPlayers();
  G.spectator = false;
  if (go) {
    G.spectator = !go.ids.includes(N.me) || !!go.late; G.cfg.diff = go.cfg.diff;
    const total = Math.max(go.ids.length, go.cfg.size);
    go.ids.forEach((id, i) => G.players.push(makePlayer(i, false, { nid: id, owner: id, remote: id !== N.me || G.spectator, name: N.name(id) })));
    for (let i = go.ids.length, b = 0; i < total; i++, b++) G.players.push(makePlayer(i, true, { nid: 'b' + b, owner: N.hostId, remote: !N.isHost, name: NAMES[1 + (b % 7)] }));
    G.players.forEach((P) => { if (P.remote) P.interp = new Interp(0.1); });
    G.me = G.players.find((P) => P.nid === N.me && !G.spectator) || G.players[0];
    G.order = go.order;
  } else { for (let i = 0; i <= G.cfg.bots; i++) G.players.push(makePlayer(i, i > 0)); G.me = G.players[0]; G.order = KINDS.slice().sort(() => Math.random() - 0.5); }
  G.startN = G.players.length; G.round = 0; G.calm = 4; G.t = 0; G.phase = 'live';
  cam.yaw = G.me.yaw; cam.ready = false;
  K3.shell.screen(''); hud.style.display = '';
  K3.setTouchButtons([{ a: 'jump', label: 'JUMP', right: 30, bottom: 40, size: 90, big: true }]);
  K3.playing = true; K3.paused = false; K3.menuOpen = false; if (!K3.isTouch && !K3.test) K3.canvas.requestPointerLock?.(); K3.canvas.focus();
  if (!G.spectator) window.XC?.start();
  hudMsg('GET READY', 2, '#fff', 'the first disaster is coming…');
}
function finish(places = null) {
  if (G.phase === 'over') return;
  if (N && N.isHost && !places) { places = G.players.map((P) => [P.nid, P.alive ? 1 : P.place]); N.send({ k: 'fin', places }); }
  G.phase = 'over'; K3.playing = false; K3.menuOpen = false; document.exitPointerLock?.(); K3.setTouchButtons([]);
  if (places) for (const [nid, pl] of places) { const P = G.players.find((x) => x.nid === nid); if (P) P.place = pl; }
  else G.players.forEach((P) => { if (P.alive) P.place = 1; });
  const me = G.me, won = !G.spectator && me.place === 1, n = G.players.length;
  const score = G.spectator ? 0 : (n - me.place) * 80 + (me.alive ? 300 : 0) + me.survived * 60;
  if (!G.spectator) window.XC?.end({ score, won, stats: { won: won ? 1 : 0 } });
  const order = G.players.slice().sort((a, b) => a.place - b.place);
  const el = K3.shell.screen(`<div class="k3-title" style="font-size:44px">${G.spectator ? 'GAME OVER' : me.alive ? 'YOU SURVIVED!' : won ? 'LAST ONE STANDING!' : `#${me.place} OF ${n}`}</div>
    <div class="k3-sub">${order.map((P) => `<span style="color:${PCOL[P.i % 8]}">#${P.place} ${P === me && !G.spectator ? 'YOU' : P.name}${P.alive ? ' ✓' : ''}</span>`).join(' · ')}</div>
    <div class="k3-sub">${me.alive ? 'survived all six disasters' : `out in disaster ${me.survived + 1}: ${me.why || ''}`} · ${score} points</div>
    <div class="k3-row">${!N ? '<button class="k3-btn primary" data-a>PLAY AGAIN</button><button class="k3-btn" data-m>MENU</button>' : N.isHost ? '<button class="k3-btn primary" data-lobby>BACK TO LOBBY</button><button class="k3-btn" data-leave>LEAVE</button>' : `<div class="k3-sub">waiting for <b>${N.name(N.hostId)}</b>...</div><button class="k3-btn" data-leave>LEAVE</button>`}</div>`);
  el.querySelector('[data-a]')?.addEventListener('click', () => start());
  el.querySelector('[data-m]')?.addEventListener('click', () => menu());
  el.querySelector('[data-lobby]')?.addEventListener('click', () => lobby.backToLobby());
  el.querySelector('[data-leave]')?.addEventListener('click', () => (window.XC ? XC.exit() : history.back()));
}
function update(dt) {
  if (G.phase !== 'live' || !G.me) return;
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) { hud.querySelector('[data-msg]').style.opacity = 0; hud.querySelector('[data-sub]').style.opacity = 0; } }
  G.t += dt;
  const mv = K3.input.move, s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
  if (!G.spectator && !G.me.remote && !G.me.auto) { G.me.input.x = mv.x * c + mv.y * s; G.me.input.y = -mv.x * s + mv.y * c; G.me.input.jump = K3.input.tap('jump'); }
  if (!N || N.isHost) hostDisasters(dt);
  stepHazards(dt);
  for (const P of G.players) if ((P.bot || P.auto) && !P.remote) botThink(P, dt);
  for (const P of G.players) { if (P.remote) followNet(P); else stepPlayer(P, dt); }
  if (N) netTick(dt);
}
let specI = 0;
function render(alpha, dt) {
  for (const P of G.players) {
    const p0 = P.prev, p1 = P.ch.pos(); P.av.root.position.set(p0.x + (p1.x - p0.x) * alpha, p0.y + (p1.y - p0.y) * alpha, p0.z + (p1.z - p0.z) * alpha);
    const cur = P.av.root.rotation.y, d = Math.atan2(Math.sin(P.yaw - cur), Math.cos(P.yaw - cur)); P.av.root.rotation.y = cur + d * Math.min(1, dt * 14);
    if (!P.alive) continue;
    const sp = Math.hypot(P.vel.x, P.vel.z);
    if (G.phase === 'over') P.av.play('Wave');
    else if (!P.grounded) P.av.play(P.vel.y > 1 ? 'Jump' : 'Jump_Idle', { loop: P.vel.y <= 1 });
    else if (P.landT > 0) { P.landT -= dt; P.av.play('Jump_Land', { loop: false }); }
    else if (sp > 0.6) P.av.play('Run', { speed: Math.max(0.7, sp / RUN) * 1.1 });
    else P.av.play('Idle');
  }
  sea.position.y = flood();
  if (G.dz && G.dz.kind === 'tornado') { const T = twister(); tw.setEnabled(true); tw.position.set(T.x, 7, T.z); tw.rotation.y += dt * 9; } else tw.setEnabled(false);
  S.clearColor = G.dz && (G.dz.kind === 'lightning' || G.dz.kind === 'tornado') ? new V.Color4(0.22, 0.24, 0.32, 1) : new V.Color4(0.42, 0.62, 0.86, 1);
  if (G.debugCam) { cam.cam.position.set(...G.debugCam.pos); cam.cam.setTarget(new V.Vector3(...G.debugCam.at)); return; }
  if (G.phase === 'menu' || !G.me) { const t = performance.now() / 9000; cam.cam.position.set(Math.sin(t) * 40, 22, Math.cos(t) * 40); cam.cam.setTarget(new V.Vector3(0, 0, 0)); return; }
  let who = G.me;
  if (!G.me.alive || G.spectator) { const alive = G.players.filter((P) => P.alive); if (alive.length) { if (K3.input.tap('jump')) specI++; who = alive[specI % alive.length]; } }
  cam.update(who.ch.pos(), dt);
  const D = G.dz, alive = G.players.filter((P) => P.alive).length;
  hud.querySelector('[data-top]').innerHTML = G.phase === 'live' ? `${D ? TITLE[D.kind][0] : 'CALM'} <small style="font-size:12px;color:#e8e6ff">· disaster ${G.round} / ${ROUNDS} · ${alive} alive${D ? ` · ${Math.max(0, Math.ceil(DIS_T - (G.t - D.t0)))}s` : ''}${who !== G.me ? ` · watching ${who.name}` : ''}</small>` : '';
  hud.querySelector('[data-air]').textContent = G.me.alive && G.me.under > 0.1 ? `AIR ${'▮'.repeat(Math.max(0, Math.ceil((2 - G.me.under) * 4)))}` : '';
}

// ================= ONLINE =================
const lobby = N && onlineLobby(K3, N, {
  title: 'DISASTER ISLAND', sub: 'ONLINE · survive six disasters · bots fill the island up to the size you pick',
  hostOpts: [{ key: 'size', label: 'PLAYERS ON THE ISLAND', opts: [[4, '4'], [6, '6'], [8, '8']], ok: (v, n) => v >= n }, { key: 'diff', label: 'BOTS', opts: [['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']] }],
  myOpts: [], cfg: { size: 6, diff: G.cfg.diff }, mine: {},
  onStart: (go) => { if (!go.order) go.order = KINDS.slice(); start(go); },
  onShow: () => { clearPlayers(); G.phase = 'menu'; hud.style.display = 'none'; },
});
if (N) netBadge(K3, N, { left: 12, top: 12 });
const r2 = (v) => Math.round(v * 100) / 100;
let sendAcc = 0;
function netTick(dt) {
  sendAcc += dt; if (sendAcc < 1 / 30) return; sendAcc = 0;
  const mine = G.players.filter((P) => !P.remote && P.alive);
  if (mine.length) N.send({ k: 's', t: N.now(), p: mine.map((P) => { const q = P.ch.pos(); return [P.nid, r2(q.x), r2(q.y), r2(q.z), r2(P.vel.x), r2(P.vel.y), r2(P.vel.z), r2(P.yaw), P.grounded ? 1 : 0, P.survived]; }) }, { fast: true });
}
function followNet(P) {
  P.prev = P.ch.pos();
  const s = P.alive && P.interp && P.interp.sample(); if (!s) return;
  const { a, b, k } = s, kk = Math.min(1.25, k), h = P.ch.height / 2;
  const x = lerp(a[1], b[1], kk), y = lerp(a[2], b[2], kk), z = lerp(a[3], b[3], kk);
  P.ch.body.setTranslation({ x, y: y + h, z }, true); P.ch.body.setNextKinematicTranslation({ x, y: y + h, z });
  P.vel = { x: b[4], y: b[5], z: b[6] }; P.yaw = lerpAngle(a[7], b[7], kk);
  const was = P.grounded; P.grounded = !!b[8]; if (P.grounded && !was) P.landT = 0.18; P.survived = b[9];
}
if (N) {
  N.on((d, from) => {
    if (!d || !d.k || d.k[0] === 'L' || !G.players.length) return;
    const P = (nid) => G.players.find((x) => x.nid === nid);
    if (d.k === 's') { for (const st of d.p) { const Q = P(st[0]); if (Q && Q.remote && Q.owner === from) Q.interp.push(st, d.t); } return; }
    if (d.k === 'out') { const Q = P(d.n); if (Q && Q.owner === from) die(Q, d.why); return; }
    if (from !== N.hostId || N.isHost) return;
    if (d.k === 'dz') { G.round = d.d.round; startDisaster({ ...d.d, t0: G.t }); }
    if (d.k === 'dzend') endDisaster();
    if (d.k === 'hz') addHazard({ ...d.h });
    if (d.k === 'fin') finish(d.places);
  });
  const reassign = () => { for (const P of G.players) { if (N.players.some((p) => p.id === P.owner)) continue; P.owner = N.hostId; if (!P.bot && !N.players.some((p) => p.id === P.nid)) { P.bot = true; P.name += ' (BOT)'; P.skill = 0.75; } if (P.owner === N.me && P.remote) { P.remote = false; P.interp = null; } } };
  N.onLeave(() => { if (G.players.length) reassign(); });
  N.onHost(() => { if (G.players.length) reassign(); });
}

K3.shell.loading(0.3);
makeAvatar = await avatars(K3, 'assets/common/buddy.glb', { height: 1.5 });
K3.shell.loading(1);
K3.loop(update, render);
menu();
G.simulate = (n) => { for (let i = 0; i < n; i++) { update(1 / 60); K3.world.step(); } };
const Q = new URLSearchParams(location.search);
if (Q.has('auto')) start();
