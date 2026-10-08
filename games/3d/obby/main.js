// OBBY RACE - a neon obstacle course over the void: gaps, sliding platforms, spinning sweepers, blinking tiles,
// a narrow beam and stairs to the finish. Fall = back to your last checkpoint. First to the top wins.
import { boot, V } from '../../kit3d/kit3d.js';
import { avatars } from '../../kit3d/avatar.js';
import { tpcam } from '../../kit3d/tpcam.js';
import { net3d, Interp, lerp, lerpAngle } from '../../kit3d/net3d.js';
import { onlineLobby, netBadge } from '../../kit3d/online.js';

const RUN = 7.4, JUMP_V = 8.2, GRAV = 22, KILL_Y = -10, FIN_Z = 141, AFTER_FIRST = 45, MAX_T = 240;
const PCOL = ['#ffffff', '#ff2bd6', '#ffd93a', '#3dffa0', '#ff8a3a', '#8b5cf6', '#ff3355', '#22e6ff'];
const NAMES = ['YOU', 'PIP', 'ZAPPY', 'MOCHI', 'BLINK', 'NOODLE', 'TOAST', 'BOOP'];

const K3 = await boot({ title: 'OBBY RACE', gravity: 22, actions: { jump: ['Space'] } });
const N = await net3d(window.XC?.net);
K3.online = !!N;
const S = K3.scene;
const G = { phase: 'menu', players: [], t: 0, finish: [], cfg: Object.assign({ bots: 3, diff: 'normal' }, JSON.parse(localStorage.getItem('obby_cfg') || '{}')) };
window.__O = G;

// ---------- scene ----------
S.clearColor = new V.Color4(0.03, 0.02, 0.09, 1);
const hemi = new V.HemisphericLight('h', new V.Vector3(0.3, 1, -0.2), S); hemi.intensity = 0.9; hemi.groundColor = new V.Color3(0.25, 0.15, 0.4);
const sun = new V.DirectionalLight('s', new V.Vector3(-0.4, -1, 0.5), S); sun.position = new V.Vector3(10, 40, -10); sun.intensity = 0.6;
const glow = new V.GlowLayer('g', S, { mainTextureRatio: K3.quality === 'low' ? 0.25 : 0.5 }); glow.intensity = 0.5;
S.fogMode = 2; S.fogDensity = 0.01; S.fogColor = new V.Color3(0.05, 0.03, 0.12);
const cam = tpcam(K3, { dist: 7, height: 1.5, pitch: 0.38 });
const voidM = V.CreateGround('void', { width: 400, height: 400 }, S); voidM.position.set(0, -22, 70);
voidM.material = (() => { const m = new V.StandardMaterial('vm', S); m.disableLighting = true; m.emissiveTexture = (() => { const t = new V.DynamicTexture('vt', 256, S); const c = t.getContext(); c.fillStyle = '#070414'; c.fillRect(0, 0, 256, 256); c.strokeStyle = '#1a2c5a'; c.lineWidth = 2; c.strokeRect(0, 0, 256, 256); t.update(); t.uScale = t.vScale = 40; return t; })(); return m; })();
glow.addExcludedMesh(voidM);
const matCache = {};
const mat = (hex, em = 0.25) => { const k = hex + em; if (matCache[k]) return matCache[k]; const m = new V.StandardMaterial('m' + k, S); const c = V.Color3.FromHexString(hex); m.diffuseColor = c; m.emissiveColor = c.scale(em); m.specularColor = new V.Color3(0.2, 0.2, 0.2); return (matCache[k] = m); };

// ---------- the course (top of every platform at y) ----------
const moving = [], blinks = [], sweepers = [], pads = [];
function plat(x, y, z, w, d, hex, h = 0.6) {
  const m = V.CreateBox('p', { width: w, height: h, depth: d }, S); m.position.set(x, y - h / 2, z); m.material = mat(hex); m.isPickable = false; m.receiveShadows = true;
  const c = K3.phys.box(x, y - h / 2, z, w / 2, h / 2, d / 2);
  return { m, c, x, y, z, w, d, h, dx: 0 };
}
function pad(z0, z1, y, w, hex, i) { const p = plat(0, y, (z0 + z1) / 2, w, z1 - z0, hex); p.cp = i; pads.push(p); return p; }
pad(-2, 10, 0, 12, '#3a3470', 0);                                                            // start
[[0, 0, 14], [1.5, 0.5, 19], [-1.5, 1, 24.5], [0, 1.5, 30]].forEach(([x, y, z]) => plat(x, y, z, 3.6, 3.6, '#22e6ff'));   // jump gaps
pad(33, 40, 1.5, 7, '#3a3470', 1);
[[44, 3.4, 0], [49, 2.8, 1.6], [54, 3.1, 3.1]].forEach(([z, per, ph]) => { const p = plat(0, 1.5, z, 3.2, 3.2, '#ff2bd6'); Object.assign(p, { per, ph, amp: 3.6 }); moving.push(p); });   // sliding
pad(57, 63, 1.5, 7, '#3a3470', 2);
const floor3 = plat(0, 1.5, 73, 10, 20, '#2a2a58');                                           // sweeper floor
for (const x of [-5.2, 5.2]) plat(x, 2.0, 73, 0.4, 20, '#ff2bd6', 0.5);                       // low side rails (under the bars' reach)
[[68, 1.5], [78, -1.9]].forEach(([z, w]) => { const m = V.CreateBox('sw', { width: 9.4, height: 0.5, depth: 0.45 }, S); m.material = mat('#ff3355', 0.9); m.position.set(0, 1.85, z); m.isPickable = false; const hub = V.CreateCylinder('hub', { diameter: 0.7, height: 1.2 }, S); hub.position.set(0, 2.0, z); hub.material = mat('#ffd93a', 0.6); sweepers.push({ m, z, w, a: 0 }); });
pad(83, 89, 1.5, 7, '#3a3470', 3);
for (let k = 0; k < 5; k++) for (const x of [-2, 2]) { const p = plat(x, 1.5, 92.5 + k * 4, 3, 3, '#ffd93a'); Object.assign(p, { per: 3.2, off: (k * 0.9 + (x > 0 ? 1.6 : 0)) % 3.2 }); blinks.push(p); }   // blinking tiles
pad(110, 117, 1.5, 7, '#3a3470', 4);
plat(0, 1.5, 124, 0.9, 14, '#3dffa0');                                                         // narrow beam
for (let k = 0; k < 6; k++) plat(0, 2 + k * 0.5, 131.75 + k * 1.5, 3, 1.5, '#8b5cf6');         // stairs
pad(140, 150, 4.5, 10, '#ffd93a', 5);                                                          // finish
const gate = V.CreateTorus('gate', { diameter: 7, thickness: 0.35, tessellation: 40 }, S); gate.rotation.x = Math.PI / 2; gate.position.set(0, 7.5, FIN_Z + 1); gate.material = mat('#ffd93a', 1); gate.isPickable = false;
const CP = [{ z: 4, y: 0 }, { z: 36.5, y: 1.5 }, { z: 60, y: 1.5 }, { z: 86, y: 1.5 }, { z: 113.5, y: 1.5 }];
K3.world.updateSceneQueries();
// the course clock: everything moves with G.t (race time), the same for everyone
function stepCourse(dt) {
  for (const p of moving) { const nx = Math.sin((G.t * 2 * Math.PI) / p.per + p.ph) * p.amp; p.dx = nx - p.x; p.x = nx; p.c.setTranslation({ x: nx, y: p.y - p.h / 2, z: p.z }); p.m.position.x = nx; }
  for (const s of sweepers) { s.a = G.t * s.w; s.m.rotation.y = s.a; }
  for (const b of blinks) {
    const ph = (G.t + b.off) % b.per, on = ph < b.per * 0.62, warn = on && ph > b.per * 0.62 - 0.6;
    if (on !== b.on) { b.on = on; b.c.setEnabled(on); }
    b.m.visibility = on ? 1 : 0.12; b.m.material = mat(warn && Math.floor(G.t * 8) % 2 ? '#ff3355' : '#ffd93a');
  }
}
const blinkLeft = (b) => { const ph = (G.t + b.off) % b.per; return ph < b.per * 0.62 ? b.per * 0.62 - ph : -1; };

// ---------- players ----------
let makeAvatar = null;
function makePlayer(i, bot, o = {}) {
  const sp = { x: -4.5 + (i % 4) * 3, z: 1.5 + Math.floor(i / 4) * 3 };
  const ch = K3.phys.character({ x: sp.x, y: 0.1, z: sp.z, radius: 0.35, height: 1.5 });
  const P = { i, bot, nid: o.nid ?? i, owner: o.owner, remote: !!o.remote, name: o.name || (bot ? NAMES[i % 8] : (K3.xc?.player?.callsign || 'YOU')), ch, av: makeAvatar(PCOL[i % 8]), vel: { x: 0, y: 0, z: 0 }, yaw: 0, grounded: true, input: { x: 0, y: 0, jump: false }, prev: ch.pos(), cp: 0, best: 0, fin: null, falls: 0, stun: 0, landT: 0, wp: 0 };
  if (bot) P.skill = { easy: 0.7, normal: 0.85, hard: 0.96 }[G.cfg.diff] * (0.9 + Math.random() * 0.15);
  return P;
}
function respawn(P) {
  const c = CP[P.cp]; P.ch.teleport((Math.random() - 0.5) * 3, c.y + 0.1, c.z); P.vel = { x: 0, y: 0, z: 0 }; P.falls++; P.stun = 0; P.wp = WPCP[P.cp];
  if (P === G.me) { hudMsg('BACK TO CHECKPOINT', 1, '#ff8a3a'); K3.audio.tone(200, 0.3, 'sawtooth', 0.04, -120); }
}
function stepPlayer(P, dt) {
  P.prev = P.ch.pos();
  if (P.fin != null) { P.input.x = P.input.y = 0; }
  const live = G.phase === 'live';
  let wx = P.input.x, wz = P.input.y; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
  if (!live || P.stun > 0) wx = wz = 0;
  P.stun = Math.max(0, P.stun - dt);
  const acc = (P.grounded ? 60 : 22) * dt, tx = wx * RUN, tz = wz * RUN;
  if (P.stun <= 0) { const dx = tx - P.vel.x, dz = tz - P.vel.z, dl = Math.hypot(dx, dz); if (dl <= acc) { P.vel.x = tx; P.vel.z = tz; } else { P.vel.x += (dx / dl) * acc; P.vel.z += (dz / dl) * acc; } }
  if (P.input.jump && P.grounded && live && P.stun <= 0) { P.vel.y = JUMP_V; P.grounded = false; if (P === G.me) K3.audio.tone(520, 0.08, 'triangle', 0.05, 300); }
  P.vel.y -= GRAV * dt; if (P.grounded && P.vel.y < 0) P.vel.y = -2;
  P.ch.move(P.vel.x * dt, P.vel.y * dt, P.vel.z * dt);
  for (const n of P.ch.walls) { const l = Math.hypot(n.x, n.z) || 1, d = (P.vel.x * n.x + P.vel.z * n.z) / l; if (d < 0) { P.vel.x -= (d * n.x) / l; P.vel.z -= (d * n.z) / l; } }
  if (P.vel.y > 0 && P.ch.ceiling) P.vel.y = 0;
  const was = P.grounded; P.grounded = P.ch.grounded; if (P.grounded && !was) P.landT = 0.18;
  if (Math.hypot(P.vel.x, P.vel.z) > 0.5) P.yaw = Math.atan2(P.vel.x, P.vel.z);
  const f = P.ch.pos();
  // riding a sliding platform
  if (P.grounded) { const h = K3.phys.ray({ x: f.x, y: f.y + 0.3, z: f.z }, { x: 0, y: -1, z: 0 }, 0.7); const mp = h && moving.find((p) => p.c.handle === h.collider.handle); if (mp && mp.dx) P.ch.move(mp.dx, 0, 0); const pd = h && pads.find((p) => p.c.handle === h.collider.handle); if (pd && pd.cp > P.cp && pd.cp < 5) { P.cp = pd.cp; P.wp = Math.max(P.wp, WPCP[pd.cp]); if (P === G.me) { hudMsg(`CHECKPOINT ${pd.cp}`, 0.9, '#3dffa0'); K3.audio.tone(880, 0.12, 'square', 0.04); } } }
  // the sweepers knock you off unless you jump them
  for (const s of sweepers) {
    if (Math.abs(f.z - s.z) > 5 || f.y > 2.45) continue;
    const ux = Math.sin(s.a + Math.PI / 2), uz = Math.cos(s.a + Math.PI / 2), rx = f.x, rz = f.z - s.z, along = Math.max(-4.7, Math.min(4.7, rx * ux + rz * uz)), px = ux * along, pz = uz * along;
    if (Math.hypot(rx - px, rz - pz) < 0.62 && f.y < 2.15) { const tvx = -uz * along * s.w, tvz = ux * along * s.w, l = Math.hypot(tvx, tvz) || 1; P.vel.x = (tvx / l) * 8; P.vel.z = (tvz / l) * 8; P.vel.y = 5.5; P.grounded = false; P.stun = 0.45; if (P === G.me) { cam.shake = 0.3; K3.audio.tone(140, 0.2, 'square', 0.05, -60); } }
  }
  P.best = Math.max(P.best, f.z);
  if (f.y < KILL_Y) respawn(P);
  if (P.fin == null && f.z > FIN_Z && f.y > 4 && live) { P.fin = G.t; finished(P); }
}

// ---------- bots: a route of points through the course, jump at edges, wait for platforms and tiles ----------
const WP = [], WPCP = [0];
const wpAt = (x, y, z, o = {}) => WP.push({ x, y, z, ...o });
wpAt(0, 0, 9); [[0, 0, 14], [1.5, 0.5, 19], [-1.5, 1, 24.5], [0, 1.5, 30]].forEach(([x, y, z]) => wpAt(x, y, z, { jump: true })); wpAt(0, 1.5, 34.5, { jump: true }); WPCP[1] = WP.length; wpAt(0, 1.5, 39);
moving.forEach((p) => wpAt(0, 1.5, p.z, { jump: true, plat: p })); wpAt(0, 1.5, 58, { jump: true }); WPCP[2] = WP.length; wpAt(0, 1.5, 62);
wpAt(0, 1.5, 72); wpAt(0, 1.5, 82); WPCP[3] = WP.length; wpAt(0, 1.5, 88);
for (let k = 0; k < 5; k++) wpAt(null, 1.5, 92.5 + k * 4, { jump: true, tile: k }); wpAt(0, 1.5, 111, { jump: true }); WPCP[4] = WP.length; wpAt(0, 1.5, 116.5);
wpAt(0, 1.5, 124); wpAt(0, 1.5, 130.5); for (let k = 0; k < 6; k++) wpAt(0, 2 + k * 0.5, 131.75 + k * 1.5, { jump: true }); wpAt(0, 4.5, 146);
function botThink(P, dt) {
  const I = P.input; I.jump = false; I.x = I.y = 0;
  if (G.phase !== 'live' || P.fin != null) return;
  const f = P.ch.pos(), w = WP[Math.min(P.wp, WP.length - 1)];
  let tx = w.x, tz = w.z;
  if (w.plat) tx = w.plat.x;
  if (w.tile != null) { const opts = blinks.filter((b) => Math.abs(b.z - w.z) < 1); const ok = opts.filter((b) => blinkLeft(b) > 0.9); const pick = (ok.length ? ok : opts).sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x))[0]; tx = pick.x; if (!ok.length && P.grounded) return; }
  const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz);
  if (d < 0.7 && Math.abs(f.y - w.y) < 0.8) { P.wp++; return; }
  // wait on the edge for the sliding platform to come close
  if (w.plat && P.grounded && Math.abs(w.plat.x - f.x) > 1.6 && Math.abs(dz) < 4.5) return;
  I.x = dx / (d || 1); I.y = dz / (d || 1);
  // sweepers: hop when a bar is about to reach me
  for (const s of sweepers) { if (Math.abs(f.z - s.z) < 2.2 && P.grounded) { const ux = Math.sin(s.a + Math.PI / 2), uz = Math.cos(s.a + Math.PI / 2), cross = Math.abs(f.x * uz - (f.z - s.z) * ux); if (cross < 1.4 && Math.random() < P.skill) I.jump = true; } }
  if (w.jump && P.grounded) { const ahead = K3.phys.ray({ x: f.x + I.x * 0.7, y: f.y + 0.4, z: f.z + I.y * 0.7 }, { x: 0, y: -1, z: 0 }, 1.4); if ((!ahead || w.y > f.y + 0.3) && d < 4.6 && Math.random() < 0.5 + 0.5 * P.skill) I.jump = true; }
}

// ---------- sound + HUD ----------
const hud = document.createElement('div');
hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;font-family:Orbitron,Segoe UI,sans-serif;color:#fff;text-shadow:0 2px 6px #000';
hud.innerHTML = `<div data-top style="position:absolute;top:12px;left:50%;transform:translateX(-50%);font-weight:900;font-size:20px;letter-spacing:2px;text-align:center"></div>
  <div data-pos style="position:absolute;top:10px;right:16px;font-weight:900;font-size:40px"></div>
  <div data-msg style="position:absolute;top:28%;left:0;right:0;text-align:center;font-weight:900;font-size:clamp(26px,5.6vw,56px);letter-spacing:3px;opacity:0;transition:opacity .25s"></div>`;
K3.hud.appendChild(hud); hud.style.display = 'none';
let msgT = 0;
const hudMsg = (t, s = 1.4, c = '#fff') => { const e = hud.querySelector('[data-msg]'); e.textContent = t; e.style.color = c; e.style.opacity = 1; msgT = s; };
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;

// ---------- flow ----------
function clearPlayers() { G.players.forEach((P) => { P.ch.destroy(); P.av.dispose(); }); G.players = []; G.me = null; }
function menu() {
  G.phase = 'menu'; K3.playing = false; K3.setTouchButtons([]); hud.style.display = 'none'; document.exitPointerLock?.();
  if (N) return lobby.show();
  const b = (k, opts) => opts.map(([v, l]) => `<button class="k3-btn ${G.cfg[k] == v ? 'sel' : ''}" data-k="${k}" data-v="${v}">${l}</button>`).join('');
  const el = K3.shell.screen(`<div class="k3-title">OBBY RACE</div>
    <div class="k3-sub">Jump the gaps, ride the sliding platforms, leap the spinning bars, time the blinking tiles, walk the beam, climb to the gold finish. Fall and you go back to your last checkpoint. First to the top wins.</div>
    <div class="k3-label">RIVALS</div><div class="k3-row">${b('bots', [[0, 'NONE (time trial)'], [3, '3 BOTS'], [5, '5 BOTS']])}</div>
    <div class="k3-label">BOTS</div><div class="k3-row">${b('diff', [['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']])}</div>
    <div class="k3-row"><button class="k3-btn primary" data-play style="min-width:220px;font-size:18px">▶ RACE</button><button class="k3-btn" data-set>SETTINGS</button></div>
    <div class="k3-sub" style="font-size:13px">${K3.isTouch ? 'left side: run · right side: turn the camera · JUMP button' : 'WASD / arrows run · mouse turns the camera · SPACE jump'}</div>`);
  el.querySelectorAll('[data-k]').forEach((x) => (x.onclick = () => { G.cfg[x.dataset.k] = isNaN(x.dataset.v) ? x.dataset.v : Number(x.dataset.v); localStorage.setItem('obby_cfg', JSON.stringify(G.cfg)); menu(); }));
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
  } else {
    for (let i = 0; i <= G.cfg.bots; i++) G.players.push(makePlayer(i, i > 0));
    G.me = G.players[0];
  }
  if (!G.spectator) { const ar = V.CreateCylinder('me', { diameterTop: 0, diameterBottom: 0.36, height: 0.32, tessellation: 3 }, S); ar.rotation.x = Math.PI; ar.parent = G.me.av.root; ar.position.y = 2.0; ar.isPickable = false; ar.material = mat('#ffd93a', 1); }
  cam.yaw = 0; cam.ready = false;
  G.phase = 'count'; G.phaseT = 3; G.t = 0; G.finish = []; G.firstFin = null; G.endT = null;
  K3.shell.screen(''); hud.style.display = '';
  K3.setTouchButtons([{ a: 'jump', label: 'JUMP', right: 30, bottom: 40, size: 90, big: true }]);
  K3.playing = true; K3.paused = false; K3.menuOpen = false; if (!K3.isTouch && !K3.test) K3.canvas.requestPointerLock?.(); K3.canvas.focus();
  if (!G.spectator) window.XC?.start();
  hudMsg(G.spectator ? 'WATCHING' : '3', 0.9);
}
function finished(P) {
  if (!G.finish.includes(P)) G.finish.push(P);
  if (P === G.me) { hudMsg(G.finish.length === 1 ? 'FIRST TO THE TOP!' : `FINISHED #${G.finish.length}`, 2.5, '#3dffa0'); [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => K3.audio.tone(f, 0.18, 'square', 0.05), i * 120)); }
  if (N && !P.remote) N.send({ k: 'fin', n: P.nid, t: P.fin });
  if (N && N.isHost) N.send({ k: 'fo', o: G.finish.map((x) => x.nid) });
  if (G.firstFin == null && (!P.bot || !N)) G.firstFin = G.t;
}
function results(order = null) {
  if (G.phase === 'over') return;
  G.phase = 'over'; K3.playing = false; K3.menuOpen = false; document.exitPointerLock?.(); K3.setTouchButtons([]);
  const rest = G.players.filter((P) => !G.finish.includes(P)).sort((a, b) => b.best - a.best);
  const list = order ? order.map((n) => G.players.find((P) => P.nid === n)).filter(Boolean) : G.finish.concat(rest);
  const place = list.indexOf(G.me) + 1, n = list.length, won = place === 1 && !G.spectator;
  const score = G.spectator ? 0 : (n - place) * 100 + (won ? 500 : 0) + (G.me.fin != null ? Math.max(0, Math.round(300 - G.me.fin * 2)) : 0);
  if (!G.spectator) window.XC?.end({ score, won, stats: { won: won ? 1 : 0 } });
  const el = K3.shell.screen(`<div class="k3-title" style="font-size:46px">${G.spectator ? 'RACE OVER' : won ? 'FIRST TO THE TOP!' : `#${place} OF ${n}`}</div>
    <div class="k3-sub">${list.map((P, i) => `<span style="color:${PCOL[P.i % 8]}">#${i + 1} ${P === G.me && !G.spectator ? 'YOU' : P.name}${P.fin != null ? ' ' + fmt(P.fin) : ''}</span>`).join(' · ')}</div>
    <div class="k3-sub">${G.me.fin != null ? `your time ${fmt(G.me.fin)} · ` : ''}${G.me.falls} falls · ${score} points</div>
    <div class="k3-row">${!N ? '<button class="k3-btn primary" data-a>RACE AGAIN</button><button class="k3-btn" data-m>MENU</button>' : N.isHost ? '<button class="k3-btn primary" data-lobby>BACK TO LOBBY</button><button class="k3-btn" data-leave>LEAVE</button>' : `<div class="k3-sub">waiting for <b>${N.name(N.hostId)}</b>...</div><button class="k3-btn" data-leave>LEAVE</button>`}</div>`);
  el.querySelector('[data-a]')?.addEventListener('click', () => start());
  el.querySelector('[data-m]')?.addEventListener('click', () => menu());
  el.querySelector('[data-lobby]')?.addEventListener('click', () => lobby.backToLobby());
  el.querySelector('[data-leave]')?.addEventListener('click', () => (window.XC ? XC.exit() : history.back()));
}

function update(dt) {
  if (G.phase === 'menu' || G.phase === 'over' || !G.me) return;
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) hud.querySelector('[data-msg]').style.opacity = 0; }
  if (G.phase === 'count') { const b = Math.ceil(G.phaseT); G.phaseT -= dt; const n = Math.ceil(G.phaseT); if (n !== b && n > 0) { hudMsg(String(n), 0.9); K3.audio.tone(440, 0.1, 'square', 0.04); } if (G.phaseT <= 0) { G.phase = 'live'; hudMsg('GO!', 0.7, '#3dffa0'); K3.audio.tone(880, 0.15, 'square', 0.05); } }
  if (G.phase === 'live') G.t += dt;
  stepCourse(dt);
  const mv = K3.input.move, s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
  if (!G.spectator && !G.me.remote) { G.me.input.x = mv.x * c + mv.y * s; G.me.input.y = -mv.x * s + mv.y * c; G.me.input.jump = K3.input.tap('jump'); }
  for (const P of G.players) if ((P.bot || P.auto) && !P.remote) botThink(P, dt);   // (auto: tests drive a player with the bot)
  for (const P of G.players) { if (P.remote) followNet(P); else stepPlayer(P, dt); }
  if (N) netTick(dt);
  if (G.phase === 'live') {
    const humans = G.players.filter((P) => !P.bot && (!N || N.players.some((p) => p.id === P.nid)));
    const allHome = humans.every((P) => P.fin != null) || G.players.every((P) => P.fin != null);
    const timeUp = G.t > MAX_T || (G.firstFin != null && G.t - G.firstFin > AFTER_FIRST);
    if (!N || N.isHost) {
      if (allHome) G.endT = (G.endT ?? 3) - dt;
      if ((G.endT != null && G.endT <= 0) || timeUp) { const order = G.finish.concat(G.players.filter((P) => !G.finish.includes(P)).sort((a, b) => b.best - a.best)).map((P) => P.nid); if (N) N.send({ k: 'res', o: order }); results(order); }
    }
  }
}
let specI = 0;
function render(alpha, dt) {
  for (const P of G.players) {
    const p0 = P.prev, p1 = P.ch.pos(), x = p0.x + (p1.x - p0.x) * alpha, y = p0.y + (p1.y - p0.y) * alpha, z = p0.z + (p1.z - p0.z) * alpha;
    P.av.root.position.set(x, y, z);
    const cur = P.av.root.rotation.y, d = Math.atan2(Math.sin(P.yaw - cur), Math.cos(P.yaw - cur)); P.av.root.rotation.y = cur + d * Math.min(1, dt * 14);
    const sp = Math.hypot(P.vel.x, P.vel.z);
    if (P.fin != null && G.finish[0] === P) P.av.play('Wave');
    else if (!P.grounded) P.av.play(P.vel.y > 1 ? 'Jump' : 'Jump_Idle', { loop: P.vel.y <= 1 });
    else if (P.landT > 0) { P.landT -= dt; P.av.play('Jump_Land', { loop: false }); }
    else if (sp > 0.6) P.av.play('Run', { speed: Math.max(0.7, sp / RUN) * 1.1 });
    else P.av.play('Idle');
  }
  gate.rotation.y += dt * 0.6;
  if (G.debugCam) { cam.cam.position.set(...G.debugCam.pos); cam.cam.setTarget(new V.Vector3(...G.debugCam.at)); return; }
  if (G.phase === 'menu' || !G.me) { const t = performance.now() / 9000; cam.cam.position.set(Math.sin(t) * 26, 16, 70 + Math.cos(t) * 50); cam.cam.setTarget(new V.Vector3(0, 2, 75)); return; }
  let who = G.me;
  if (G.spectator || G.me.fin != null) { const left = G.players.filter((P) => P.fin == null); if (left.length) { if (K3.input.tap('jump')) specI++; who = left.sort((a, b) => b.best - a.best)[specI % left.length]; } }
  cam.update(who.ch.pos(), dt);
  const order = G.finish.concat(G.players.filter((P) => !G.finish.includes(P)).sort((a, b) => b.ch.pos().z - a.ch.pos().z));
  hud.querySelector('[data-top]').innerHTML = G.phase === 'live' || G.phase === 'count' ? `${fmt(G.t)}<br><small style="font-size:12px;letter-spacing:1px;color:#c8c0e8">CHECKPOINT ${G.me.cp} / 4${who !== G.me ? ` · watching ${who.name}` : ''}</small>` : '';
  hud.querySelector('[data-pos]').innerHTML = G.spectator ? '' : `${order.indexOf(G.me) + 1}<small style="font-size:16px">/${order.length}</small>`;
}

// ================= ONLINE (like FLOORFALL: everyone runs their own character, the host runs bots + the result) =================
const lobby = N && onlineLobby(K3, N, {
  title: 'OBBY RACE', sub: 'ONLINE · first to the top wins · bots fill the start line up to the size you pick',
  hostOpts: [{ key: 'size', label: 'RACERS', opts: [[2, '2'], [4, '4'], [6, '6'], [8, '8']], ok: (v, n) => v >= n }, { key: 'diff', label: 'BOTS', opts: [['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']] }],
  myOpts: [], cfg: { size: 4, diff: G.cfg.diff }, mine: {},
  onStart: (go) => start(go),
  onShow: () => { clearPlayers(); G.phase = 'menu'; hud.style.display = 'none'; },
});
if (N) netBadge(K3, N, { left: 12, top: 12 });
const r2 = (v) => Math.round(v * 100) / 100;
let sendAcc = 0;
function netTick(dt) {
  sendAcc += dt; if (sendAcc < 1 / 30) return; sendAcc = 0;
  const mine = G.players.filter((P) => !P.remote);
  if (mine.length) N.send({ k: 's', t: N.now(), p: mine.map((P) => { const q = P.ch.pos(); return [P.nid, r2(q.x), r2(q.y), r2(q.z), r2(P.vel.x), r2(P.vel.y), r2(P.vel.z), r2(P.yaw), P.grounded ? 1 : 0, P.cp, r2(P.best)]; }) }, { fast: true });
}
function followNet(P) {
  P.prev = P.ch.pos();
  const s = P.interp && P.interp.sample(); if (!s) return;
  const { a, b, k } = s, kk = Math.min(1.25, k), h = P.ch.height / 2;
  const x = lerp(a[1], b[1], kk), y = lerp(a[2], b[2], kk), z = lerp(a[3], b[3], kk);
  P.ch.body.setTranslation({ x, y: y + h, z }, true); P.ch.body.setNextKinematicTranslation({ x, y: y + h, z });
  P.vel = { x: b[4], y: b[5], z: b[6] }; P.yaw = lerpAngle(a[7], b[7], kk);
  const was = P.grounded; P.grounded = !!b[8]; if (P.grounded && !was) P.landT = 0.18; P.cp = b[9]; P.best = b[10];
}
function reassign() {
  for (const P of G.players) {
    if (N.players.some((p) => p.id === P.owner)) continue;
    P.owner = N.hostId;
    if (!P.bot && !N.players.some((p) => p.id === P.nid)) { P.bot = true; P.name += ' (BOT)'; P.skill = 0.85; P.wp = WPCP[P.cp] || 0; }
    if (P.owner === N.me && P.remote) { P.remote = false; P.interp = null; }
  }
}
if (N) {
  N.on((d, from) => {
    if (!d || !d.k || d.k[0] === 'L' || !G.players.length) return;
    const P = (nid) => G.players.find((x) => x.nid === nid);
    if (d.k === 's') { for (const st of d.p) { const Q = P(st[0]); if (Q && Q.remote && Q.owner === from) Q.interp.push(st, d.t); } return; }
    if (d.k === 'fin') { const Q = P(d.n); if (Q && Q.owner === from && Q.fin == null) { Q.fin = d.t; finished(Q); } return; }
    if (from !== N.hostId || N.isHost) return;
    if (d.k === 'fo') G.finish = d.o.map((n) => P(n)).filter(Boolean);
    if (d.k === 'res') results(d.o);
  });
  N.onLeave(() => { if (G.players.length) { reassign(); hudMsg('a player left · a bot takes over', 1.6, '#c8c0e8'); } });
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
