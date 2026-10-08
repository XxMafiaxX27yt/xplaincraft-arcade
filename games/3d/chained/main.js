// CHAINED - everyone is chained together, climbing a spiral tower over the void. Slip and the chain holds you
// (dangling, dragging the others toward the edge); hold JUMP while hanging to climb back up. Reach the beacon together.
import { boot, V } from '../../kit3d/kit3d.js';
import { avatars } from '../../kit3d/avatar.js';
import { tpcam } from '../../kit3d/tpcam.js';
import { net3d, Interp, lerp, lerpAngle } from '../../kit3d/net3d.js';
import { onlineLobby, netBadge } from '../../kit3d/online.js';

const RUN = 6.8, JUMP_V = 8.2, GRAV = 22, CLIMB = 3.2, LEVELS = 30, RISE = 1.1, MAX_T = 900;
const PCOL = ['#ffffff', '#ff2bd6', '#ffd93a', '#3dffa0'];
const K3 = await boot({ title: 'CHAINED', gravity: 22, actions: { jump: ['Space'] } });
const N = await net3d(window.XC?.net);
K3.online = !!N;
const S = K3.scene;
const G = { phase: 'menu', players: [], t: 0, teamCp: 0, cfg: Object.assign({ chain: 4 }, JSON.parse(localStorage.getItem('chained_cfg') || '{}')) };
window.__C = G;

// ---------- scene ----------
S.clearColor = new V.Color4(0.04, 0.03, 0.1, 1);
const hemi = new V.HemisphericLight('h', new V.Vector3(0.3, 1, -0.2), S); hemi.intensity = 0.9; hemi.groundColor = new V.Color3(0.25, 0.15, 0.4);
const sun = new V.DirectionalLight('s', new V.Vector3(-0.4, -1, 0.5), S); sun.intensity = 0.6;
const glow = new V.GlowLayer('g', S, { mainTextureRatio: K3.quality === 'low' ? 0.25 : 0.5 }); glow.intensity = 0.55;
S.fogMode = 2; S.fogDensity = 0.012; S.fogColor = new V.Color3(0.06, 0.04, 0.13);
const cam = tpcam(K3, { dist: 8, height: 1.6, pitch: 0.42 });
const matC = {}, mat = (hex, em = 0.25) => matC[hex + em] || (matC[hex + em] = (() => { const m = new V.StandardMaterial('m', S), c = V.Color3.FromHexString(hex); m.diffuseColor = c; m.emissiveColor = c.scale(em); m.specularColor = new V.Color3(0.2, 0.2, 0.2); return m; })());
// the tower: a pillar and a spiral of platforms; every 6th is a wide checkpoint
const pillar = V.CreateCylinder('pillar', { diameter: 6, height: LEVELS * RISE + 8, tessellation: 24 }, S); pillar.position.y = (LEVELS * RISE + 8) / 2 - 4; pillar.material = mat('#2a2450', 0.15); pillar.isPickable = false;
K3.world.createCollider(K3.R.ColliderDesc.cylinder((LEVELS * RISE + 8) / 2, 3).setTranslation(0, (LEVELS * RISE + 8) / 2 - 4, 0).setCollisionGroups(K3.phys.groups(K3.phys.G_WORLD, 0xffff)));
const PL = [];
function plat(x, y, z, w, d, hex) { const m = V.CreateBox('p', { width: w, height: 0.6, depth: d }, S); m.position.set(x, y - 0.3, z); m.material = mat(hex); m.isPickable = false; const c = K3.phys.box(x, y - 0.3, z, w / 2, 0.3, d / 2); return { m, c, x, y, z, w, d }; }
const ground = plat(0, 0, 0, 30, 30, '#3a3470'); ground.cp = 0; PL.push(ground);
for (let k = 1; k <= LEVELS; k++) {
  const a = k * 0.62, R = k % 2 ? 7.2 : 8.8, cp = k % 6 === 0 || k === LEVELS, sz = cp ? 5 : 2.8 - Math.min(0.35, k * 0.012);
  const p = plat(Math.cos(a) * R, k * RISE, Math.sin(a) * R, sz, sz, k === LEVELS ? '#ffd93a' : cp ? '#3dffa0' : ['#22e6ff', '#ff2bd6', '#8b5cf6'][k % 3]);
  p.k = k; if (cp) p.cp = k / 6 | 0 || 1; if (k === LEVELS) p.top = true; PL.push(p);
}
const TOP = PL[LEVELS];
const beacon = V.CreateCylinder('beacon', { diameterTop: 0.2, diameterBottom: 1.2, height: 30 }, S); beacon.position.set(TOP.x, TOP.y + 15, TOP.z); beacon.material = (() => { const m = mat('#ffd93a', 1).clone('bm'); m.alpha = 0.35; return m; })(); beacon.isPickable = false;
const CPS = [ground].concat(PL.filter((p) => p.k && (p.k % 6 === 0 || p.top)));
K3.world.updateSceneQueries();
// which platform am I on (the centre and four points round the feet: standing on an edge counts too)
const platAt = (f) => { for (const [ox, oz] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) { const h = K3.phys.ray({ x: f.x + ox, y: f.y + 0.3, z: f.z + oz }, { x: 0, y: -1, z: 0 }, 0.7); const p = h && PL.find((q) => q.c.handle === h.collider.handle); if (p) return p; } return null; };

// ---------- the chain: links drawn between neighbours, sagging when slack ----------
const linkSrc = V.CreateSphere('link', { diameter: 0.16, segments: 4 }, S); linkSrc.material = mat('#c8c0e8', 0.35); linkSrc.isVisible = false;
let links = [];
function buildLinks() { links.forEach((l) => l.forEach((m) => m.dispose())); links = []; for (let i = 0; i < G.players.length - 1; i++) links.push(Array.from({ length: 12 }, () => { const m = linkSrc.createInstance('l'); m.isPickable = false; return m; })); }
function drawLinks() {
  links.forEach((L, i) => {
    const a = G.players[i].av.root.position, b = G.players[i + 1].av.root.position, d = V.Vector3.Distance(a, b), sag = Math.max(0, G.cfg.chain - d) * 0.5;
    L.forEach((m, j) => { const t = (j + 1) / (L.length + 1); m.position.set(a.x + (b.x - a.x) * t, a.y + 1 + (b.y - a.y) * t - sag * 4 * t * (1 - t), a.z + (b.z - a.z) * t); });
  });
}

// ---------- players ----------
let makeAvatar = null;
function makePlayer(i, bot, o = {}) {
  const ch = K3.phys.character({ x: -3 + i * 2, y: 0.1, z: 6, radius: 0.35, height: 1.5 });
  ch.collider.setCollisionGroups(K3.phys.groups(K3.phys.G_CHAR, K3.phys.G_WORLD));   // chained partners never block each other
  return { i, bot, nid: o.nid ?? i, owner: o.owner, remote: !!o.remote, name: o.name || (bot ? 'BUDDY BOT' : (K3.xc?.player?.callsign || 'YOU')), ch, av: makeAvatar(PCOL[i % 4]), vel: { x: 0, y: 0, z: 0 }, yaw: Math.PI, grounded: true, hanging: false, input: { x: 0, y: 0, jump: false, hold: false }, prev: ch.pos(), best: 0, falls: 0, landT: 0, trailI: 0 };
}
const neighbours = (P) => [G.players[P.i - 1], G.players[P.i + 1]].filter(Boolean);
function stepPlayer(P, dt) {
  P.prev = P.ch.pos();
  const live = G.phase === 'live', I = P.input;
  let wx = I.x, wz = I.y; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
  if (!live) wx = wz = 0;
  const acc = (P.grounded ? 55 : 14) * dt, tx = wx * RUN, tz = wz * RUN, dx = tx - P.vel.x, dz = tz - P.vel.z, dl = Math.hypot(dx, dz);
  if (dl <= acc) { P.vel.x = tx; P.vel.z = tz; } else { P.vel.x += (dx / dl) * acc; P.vel.z += (dz / dl) * acc; }
  if (I.jump && P.grounded && live) { P.vel.y = JUMP_V; P.grounded = false; if (P === G.me) K3.audio.tone(520, 0.08, 'triangle', 0.05, 300); }
  P.vel.y -= GRAV * dt; if (P.grounded && P.vel.y < 0) P.vel.y = -2;
  P.ch.move(P.vel.x * dt, P.vel.y * dt, P.vel.z * dt);
  for (const n of P.ch.walls) { const l = Math.hypot(n.x, n.z) || 1, d = (P.vel.x * n.x + P.vel.z * n.z) / l; if (d < 0) { P.vel.x -= (d * n.x) / l; P.vel.z -= (d * n.z) / l; } }
  if (P.vel.y > 0 && P.ch.ceiling) P.vel.y = 0;
  const was = P.grounded; P.grounded = P.ch.grounded; if (P.grounded && !was) P.landT = 0.18;
  if (Math.hypot(P.vel.x, P.vel.z) > 0.5) P.yaw = Math.atan2(P.vel.x, P.vel.z);
  // the chain: never further than its length from a neighbour; whoever stands firm holds, whoever is in the air gets pulled
  P.hanging = false;
  for (const Q of neighbours(P)) {
    const a = P.ch.pos(), b = Q.ch.pos(), d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, dist = Math.hypot(d.x, d.y, d.z), L = G.cfg.chain;
    if (dist < L - 0.45 || dist < 0.01) continue;
    const u = { x: d.x / dist, y: d.y / dist, z: d.z / dist };
    if (dist > L) {
      const share = P.grounded && !Q.grounded ? 0.12 : !P.grounded && Q.grounded ? 0.96 : 0.5, ex = (dist - L) * share;
      P.ch.move(u.x * ex, u.y * ex, u.z * ex);
      const away = -(P.vel.x * u.x + P.vel.y * u.y + P.vel.z * u.z); if (away > 0) { P.vel.x += u.x * away; P.vel.y += u.y * away; P.vel.z += u.z * away; }
    }
    // hanging stays on while the chain is (nearly) tight - so climbing it doesn't flicker on and off
    if (!P.grounded && Q.grounded && b.y > a.y + 0.4) {
      P.hanging = true;
    }
  }
  // holding JUMP while hanging reels you up the chain to the partner who holds you (past the platform's edge),
  // and keeps going while you hold it until you are standing again
  P.reel = (P.reel || P.hanging) && I.hold && !P.grounded;
  if (P.reel) {
    const me = P.ch.pos(), Q = neighbours(P).filter((q) => q.grounded && q.ch.pos().y > me.y - 0.2).sort((x, y) => y.ch.pos().y - x.ch.pos().y)[0];
    if (!Q) P.reel = false;
    else { const b = Q.ch.pos(), dx = b.x - me.x, dy = b.y + 0.1 - me.y, dz = b.z - me.z, dd = Math.hypot(dx, dy, dz); if (dd > 0.9) { const g = Math.min(CLIMB * dt, dd - 0.9); P.ch.teleport(me.x + (dx / dd) * g, me.y + (dy / dd) * g, me.z + (dz / dd) * g); P.vel = { x: 0, y: 0, z: 0 }; } P.hanging = true; }
  }
  const f = P.ch.pos();
  P.best = Math.max(P.best, f.y);
  // team checkpoint / the top
  if (P.grounded) { const p = platAt(f); if (p) P.k = p.k ?? 0; if (live && p && p.cp != null && p.cp > G.teamCp) reachCp(p.cp); if (live && p && p.top) reachTop(P); }
  // fell way below the team checkpoint: back to it
  if (f.y < CPS[G.teamCp].y - 12) { const c = CPS[G.teamCp]; P.ch.teleport(c.x + (P.i - 1) * 0.8, c.y + 0.2, c.z); P.vel = { x: 0, y: 0, z: 0 }; P.falls++; P.trailI = Math.max(0, G.trail.length - 2); if (P === G.me) hudMsg('BACK TO THE CHECKPOINT', 1.2, '#ff8a3a'); }
}
function reachCp(i) {
  if (N && !N.isHost) { N.send({ k: 'cp', i }, { to: N.hostId }); return; }
  if (i <= G.teamCp) return;
  G.teamCp = i; if (N) N.send({ k: 'tcp', i });
  hudMsg(`CHECKPOINT ${i}`, 1, '#3dffa0'); K3.audio.tone(880, 0.12, 'square', 0.04);
}
function reachTop(P) { if (G.phase !== 'live') return; if (N && !N.isHost) { N.send({ k: 'top' }, { to: N.hostId }); return; } if (N) N.send({ k: 'win', t: G.t }); results(true); }

// ---------- the bot partner: walks the leader's trail and jumps where the leader jumped ----------
G.trail = [];
let trailT = 0;
function recordTrail(dt) {
  const L = G.players.find((P) => !P.bot) || G.players[0]; if (!L) return;
  trailT += dt; if (L.input.jump && L.grounded === false && L.vel.y > JUMP_V - 1) G.trail.jumpNext = true;
  if (trailT < 0.12) return; trailT = 0;
  const f = L.ch.pos(), last = G.trail[G.trail.length - 1];
  if (!last || Math.hypot(f.x - last.x, f.z - last.z) > 0.6 || G.trail.jumpNext) { G.trail.push({ x: f.x, y: f.y, z: f.z, jump: !!G.trail.jumpNext, g: L.grounded }); G.trail.jumpNext = false; }
  if (G.trail.length > 4000) G.trail.splice(0, 1000);
}
function botThink(P) {
  // climb platform by platform up to the one the leader stands on, then stay close to them
  const I = P.input; I.x = I.y = 0; I.jump = false; I.hold = false;
  if (G.phase !== 'live') return;
  if (P.hanging) { I.hold = true; return; }
  const L = G.players.find((Q) => !Q.bot) || G.players[0], f = P.ch.pos(), lf = L.ch.pos();
  // fallen behind / below a leader who stands firm: pull myself up the chain to them (a helper bot never holds you back)
  const far = Math.hypot(lf.x - f.x, lf.y - f.y, lf.z - f.z);
  P.behindT = L.grounded && (far > G.cfg.chain * 0.75 || lf.y - f.y > 1.5) ? (P.behindT || 0) + 1 / 60 : 0;
  if (P.behindT > 1.2 && far > 1.4) { const g = Math.min(CLIMB * 1.3 / 60, far - 1.2); P.ch.teleport(f.x + ((lf.x - f.x) / far) * g, f.y + ((lf.y - f.y) / far) * g + 0.01, f.z + ((lf.z - f.z) / far) * g); P.vel = { x: 0, y: 0, z: 0 }; P.climbing = true; return; }
  P.climbing = false;
  if (!L.grounded || L.hanging || (L.k ?? 0) < (P.k ?? 0)) return;   // they are in the air / hanging / below me: stand firm, be the anchor
  if ((P.k ?? 0) < (L.k ?? 0)) { hop(P, I, f, PL[(P.k ?? 0) + 1]); return; }
  const dx = lf.x - f.x, dz = lf.z - f.z, d = Math.hypot(dx, dz);
  if (d > 1.6) { I.x = dx / d; I.y = dz / d; }
}
function hop(P, I, f, t) {
  const dx = t.x - f.x, dz = t.z - f.z, d = Math.hypot(dx, dz) || 1;
  I.x = dx / d; I.y = dz / d;
  if (P.grounded && d < 4.2) { const ahead = K3.phys.ray({ x: f.x + I.x * 0.6, y: f.y + 0.4, z: f.z + I.y * 0.6 }, { x: 0, y: -1, z: 0 }, 1.2); if (!ahead || (t.y > f.y + 0.4 && d < 2.4)) I.jump = true; }   // jump from the edge
}

// tests: an autopilot climber (platform to platform) standing in for a human leader
function climbThink(P) {
  const I = P.input; I.x = I.y = 0; I.jump = false; I.hold = P.hanging;
  if (G.phase !== 'live' || P.hanging || G.players.some((Q) => Q !== P && Q.hanging)) return;   // wait for a hanging partner
  const f = P.ch.pos(); if (G.players.some((Q) => Q !== P && (Q.k ?? 0) < (P.k ?? 0) && Math.hypot(Q.ch.pos().x - f.x, Q.ch.pos().y - f.y, Q.ch.pos().z - f.z) > G.cfg.chain * 0.7)) return;   // and for one who is behind
  hop(P, I, P.ch.pos(), PL[Math.min(LEVELS, (P.k ?? 0) + 1)]);
}
// ---------- HUD ----------
const hud = document.createElement('div');
hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;font-family:Orbitron,Segoe UI,sans-serif;color:#fff;text-shadow:0 2px 6px #000';
hud.innerHTML = `<div data-top style="position:absolute;top:12px;left:50%;transform:translateX(-50%);font-weight:900;font-size:20px;letter-spacing:2px;text-align:center"></div>
  <div data-hang style="position:absolute;bottom:22%;left:0;right:0;text-align:center;font-weight:900;font-size:22px;color:#ffd93a;letter-spacing:2px"></div>
  <div data-msg style="position:absolute;top:28%;left:0;right:0;text-align:center;font-weight:900;font-size:clamp(26px,5.6vw,56px);letter-spacing:3px;opacity:0;transition:opacity .25s"></div>`;
K3.hud.appendChild(hud); hud.style.display = 'none';
let msgT = 0;
const hudMsg = (t, s = 1.4, c = '#fff') => { const e = hud.querySelector('[data-msg]'); e.textContent = t; e.style.color = c; e.style.opacity = 1; msgT = s; };
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ---------- flow ----------
function clearPlayers() { G.players.forEach((P) => { P.ch.destroy(); P.av.dispose(); }); G.players = []; G.me = null; buildLinks(); }
function menu() {
  G.phase = 'menu'; K3.playing = false; K3.setTouchButtons([]); hud.style.display = 'none'; document.exitPointerLock?.();
  if (N) return lobby.show();
  const b = (k, opts) => opts.map(([v, l]) => `<button class="k3-btn ${G.cfg[k] == v ? 'sel' : ''}" data-k="${k}" data-v="${v}">${l}</button>`).join('');
  const el = K3.shell.screen(`<div class="k3-title">CHAINED</div>
    <div class="k3-sub">You and your partner are chained together. Climb the spiral tower to the beacon. If one of you slips, the chain holds them - dangling, dragging the other toward the edge. Hold JUMP while hanging to climb back up the chain.</div>
    <div class="k3-label">CHAIN LENGTH</div><div class="k3-row">${b('chain', [[3, 'SHORT · 3 m'], [4, 'NORMAL · 4 m'], [6, 'LONG · 6 m']])}</div>
    <div class="k3-row"><button class="k3-btn primary" data-play style="min-width:220px;font-size:18px">▶ CLIMB</button><button class="k3-btn" data-set>SETTINGS</button></div>
    <div class="k3-sub" style="font-size:13px">solo: a bot partner follows your path · online: your whole party in one chain</div>`);
  el.querySelectorAll('[data-k]').forEach((x) => (x.onclick = () => { G.cfg[x.dataset.k] = Number(x.dataset.v); localStorage.setItem('chained_cfg', JSON.stringify(G.cfg)); menu(); }));
  el.querySelector('[data-set]').onclick = () => K3.shell.settings(menu);
  el.querySelector('[data-play]').onclick = () => { K3.audio.unlock(); start(); };
}
function start(go = null) {
  clearPlayers();
  G.spectator = false;
  if (go) {
    G.spectator = !go.ids.includes(N.me) || !!go.late; G.cfg.chain = go.cfg.chain;
    go.ids.slice(0, 4).forEach((id, i) => G.players.push(makePlayer(i, false, { nid: id, owner: id, remote: id !== N.me || G.spectator, name: N.name(id) })));
    if (G.players.length < 2) G.players.push(makePlayer(1, true, { nid: 'b0', owner: N.hostId, remote: !N.isHost }));
    G.players.forEach((P) => { if (P.remote) P.interp = new Interp(0.1); });
    G.me = G.players.find((P) => P.nid === N.me && !G.spectator) || G.players[0];
  } else { G.players.push(makePlayer(0, false), makePlayer(1, true)); G.me = G.players[0]; }
  buildLinks();
  G.trail = []; G.teamCp = 0; G.t = 0; G.phase = 'count'; G.phaseT = 3; cam.yaw = Math.PI; cam.ready = false;
  K3.shell.screen(''); hud.style.display = '';
  K3.setTouchButtons([{ a: 'jump', label: 'JUMP', right: 30, bottom: 40, size: 90, big: true }]);
  K3.playing = true; K3.paused = false; K3.menuOpen = false; if (!K3.isTouch && !K3.test) K3.canvas.requestPointerLock?.(); K3.canvas.focus();
  if (!G.spectator) window.XC?.start();
  hudMsg(G.spectator ? 'WATCHING' : '3', 0.9);
}
function results(win) {
  if (G.phase === 'over') return;
  G.phase = 'over'; K3.playing = false; K3.menuOpen = false; document.exitPointerLock?.(); K3.setTouchButtons([]);
  const h = Math.max(...G.players.map((P) => P.best)), score = G.spectator ? 0 : win ? 1000 + Math.max(0, Math.round(900 - G.t)) : Math.round(h * 20);
  if (!G.spectator) window.XC?.end({ score, won: win, stats: { won: win ? 1 : 0 } });
  if (win) [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => K3.audio.tone(f, 0.18, 'square', 0.05), i * 120));
  const el = K3.shell.screen(`<div class="k3-title" style="font-size:46px">${win ? 'TOP OF THE TOWER!' : 'OUT OF TIME'}</div>
    <div class="k3-sub">${win ? `together in ${fmt(G.t)}` : `best height ${Math.round(h)} m of ${Math.round(TOP.y)} m`} · ${G.players.map((P) => `${P === G.me ? 'YOU' : P.name} ${P.falls} falls`).join(' · ')}</div>
    <div class="k3-sub">${score} points</div>
    <div class="k3-row">${!N ? '<button class="k3-btn primary" data-a>CLIMB AGAIN</button><button class="k3-btn" data-m>MENU</button>' : N.isHost ? '<button class="k3-btn primary" data-lobby>BACK TO LOBBY</button><button class="k3-btn" data-leave>LEAVE</button>' : `<div class="k3-sub">waiting for <b>${N.name(N.hostId)}</b>...</div><button class="k3-btn" data-leave>LEAVE</button>`}</div>`);
  el.querySelector('[data-a]')?.addEventListener('click', () => start());
  el.querySelector('[data-m]')?.addEventListener('click', () => menu());
  el.querySelector('[data-lobby]')?.addEventListener('click', () => lobby.backToLobby());
  el.querySelector('[data-leave]')?.addEventListener('click', () => (window.XC ? XC.exit() : history.back()));
}
function update(dt) {
  if (G.phase === 'menu' || G.phase === 'over' || !G.me) return;
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) hud.querySelector('[data-msg]').style.opacity = 0; }
  if (G.phase === 'count') { const b = Math.ceil(G.phaseT); G.phaseT -= dt; const n = Math.ceil(G.phaseT); if (n !== b && n > 0) { hudMsg(String(n), 0.9); K3.audio.tone(440, 0.1, 'square', 0.04); } if (G.phaseT <= 0) { G.phase = 'live'; hudMsg('CLIMB!', 0.7, '#3dffa0'); K3.audio.tone(880, 0.15, 'square', 0.05); } }
  if (G.phase === 'live') G.t += dt;
  const mv = K3.input.move, s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
  if (!G.spectator && !G.me.remote && !G.me.auto && !G.__noInput) { const I = G.me.input; I.x = mv.x * c + mv.y * s; I.y = -mv.x * s + mv.y * c; I.jump = K3.input.tap('jump'); I.hold = K3.input.down('jump'); }
  recordTrail(dt);
  for (const P of G.players) if (!P.remote) { if (P.auto) climbThink(P); else if (P.bot) botThink(P); }
  for (const P of G.players) { if (P.remote) followNet(P); else stepPlayer(P, dt); }
  if (N) netTick(dt);
  if (G.phase === 'live' && G.t > MAX_T && (!N || N.isHost)) { if (N) N.send({ k: 'lose' }); results(false); }
}
function render(alpha, dt) {
  for (const P of G.players) {
    const p0 = P.prev, p1 = P.ch.pos(); P.av.root.position.set(p0.x + (p1.x - p0.x) * alpha, p0.y + (p1.y - p0.y) * alpha, p0.z + (p1.z - p0.z) * alpha);
    const cur = P.av.root.rotation.y, d = Math.atan2(Math.sin(P.yaw - cur), Math.cos(P.yaw - cur)); P.av.root.rotation.y = cur + d * Math.min(1, dt * 14);
    const sp = Math.hypot(P.vel.x, P.vel.z);
    if (G.phase === 'over') P.av.play('Wave');
    else if (P.hanging) P.av.play('Jump_Idle');
    else if (!P.grounded) P.av.play(P.vel.y > 1 ? 'Jump' : 'Jump_Idle', { loop: P.vel.y <= 1 });
    else if (P.landT > 0) { P.landT -= dt; P.av.play('Jump_Land', { loop: false }); }
    else if (sp > 0.6) P.av.play('Run', { speed: Math.max(0.7, sp / RUN) * 1.1 });
    else P.av.play('Idle');
  }
  drawLinks();
  if (G.debugCam) { cam.cam.position.set(...G.debugCam.pos); cam.cam.setTarget(new V.Vector3(...G.debugCam.at)); return; }
  if (G.phase === 'menu' || !G.me) { const t = performance.now() / 9000; cam.cam.position.set(Math.sin(t) * 30, 18, Math.cos(t) * 30); cam.cam.setTarget(new V.Vector3(0, 14, 0)); return; }
  cam.update(G.me.ch.pos(), dt);
  const h = G.me.ch.pos().y;
  hud.querySelector('[data-top]').innerHTML = G.phase === 'live' || G.phase === 'count' ? `${Math.max(0, Math.round(h))} m <small style="font-size:12px;color:#c8c0e8">/ ${Math.round(TOP.y)} m</small><br><small style="font-size:12px;letter-spacing:1px;color:#c8c0e8">${fmt(G.t)} · CHECKPOINT ${G.teamCp} / ${CPS.length - 1}</small>` : '';
  hud.querySelector('[data-hang]').textContent = G.me.hanging ? 'HANGING! hold JUMP to climb the chain' : G.players.some((P) => P !== G.me && P.hanging) ? 'your partner is hanging - stand firm!' : '';
}

// ================= ONLINE =================
const lobby = N && onlineLobby(K3, N, {
  title: 'CHAINED', sub: 'ONLINE · the whole party in one chain (up to 4) · climb to the beacon together',
  hostOpts: [{ key: 'chain', label: 'CHAIN LENGTH', opts: [[3, 'SHORT'], [4, 'NORMAL'], [6, 'LONG']] }],
  myOpts: [], cfg: { chain: G.cfg.chain }, mine: {},
  onStart: (go) => start(go),
  onShow: () => { clearPlayers(); G.phase = 'menu'; hud.style.display = 'none'; },
});
if (N) netBadge(K3, N, { left: 12, top: 12 });
const r2 = (v) => Math.round(v * 100) / 100;
let sendAcc = 0;
function netTick(dt) {
  sendAcc += dt; if (sendAcc < 1 / 30) return; sendAcc = 0;
  const mine = G.players.filter((P) => !P.remote);
  if (mine.length) N.send({ k: 's', t: N.now(), p: mine.map((P) => { const q = P.ch.pos(); return [P.nid, r2(q.x), r2(q.y), r2(q.z), r2(P.vel.x), r2(P.vel.y), r2(P.vel.z), r2(P.yaw), (P.grounded ? 1 : 0) | (P.hanging ? 2 : 0), r2(P.best), P.falls]; }) }, { fast: true });
}
function followNet(P) {
  P.prev = P.ch.pos();
  const s = P.interp && P.interp.sample(); if (!s) return;
  const { a, b, k } = s, kk = Math.min(1.25, k), h = P.ch.height / 2;
  const x = lerp(a[1], b[1], kk), y = lerp(a[2], b[2], kk), z = lerp(a[3], b[3], kk);
  P.ch.body.setTranslation({ x, y: y + h, z }, true); P.ch.body.setNextKinematicTranslation({ x, y: y + h, z });
  P.vel = { x: b[4], y: b[5], z: b[6] }; P.yaw = lerpAngle(a[7], b[7], kk);
  const was = P.grounded; P.grounded = !!(b[8] & 1); P.hanging = !!(b[8] & 2); if (P.grounded && !was) P.landT = 0.18; P.best = b[9]; P.falls = b[10];
}
if (N) {
  N.on((d, from) => {
    if (!d || !d.k || d.k[0] === 'L' || !G.players.length) return;
    if (d.k === 's') { for (const st of d.p) { const Q = G.players.find((x) => x.nid === st[0]); if (Q && Q.remote && Q.owner === from) Q.interp.push(st, d.t); } return; }
    if (N.isHost && d.k === 'cp') return reachCp(d.i);
    if (N.isHost && d.k === 'top') return reachTop(null);
    if (from !== N.hostId || N.isHost) return;
    if (d.k === 'tcp' && d.i > G.teamCp) { G.teamCp = d.i; hudMsg(`CHECKPOINT ${d.i}`, 1, '#3dffa0'); }
    if (d.k === 'win') { G.t = d.t; results(true); }
    if (d.k === 'lose') results(false);
  });
  // someone left: their spot in the chain becomes a bot partner run by the host
  const reassign = () => { for (const P of G.players) { if (N.players.some((p) => p.id === P.owner)) continue; P.owner = N.hostId; if (!P.bot) { P.bot = true; P.name += ' (BOT)'; } if (P.owner === N.me && P.remote) { P.remote = false; P.interp = null; P.trailI = Math.max(0, G.trail.length - 5); } } };
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
