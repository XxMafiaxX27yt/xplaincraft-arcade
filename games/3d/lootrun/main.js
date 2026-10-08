// LOOT RUN - a night shift scavenging a dark facility: find scrap with your flashlight, carry it back to the ship,
// meet the quota before time runs out, and stay away from what walks the halls.
import { boot, V } from '../../kit3d/kit3d.js';
import { avatars } from '../../kit3d/avatar.js';
import { tpcam } from '../../kit3d/tpcam.js';
import { net3d, Interp, lerp, lerpAngle } from '../../kit3d/net3d.js';
import { onlineLobby, netBadge } from '../../kit3d/online.js';

const CW = 8, GW = 7, GH = 6, Z0 = 20, X0 = -(GW * CW) / 2, WALL_H = 3.6, RUN = 5.6, SPRINT = 8, GRAV = 22, DAY = 300, NITEMS = 20;
const SHIP = { x: 0, z: -16, w: 10, d: 8 };
const PCOL = ['#ffffff', '#ffd93a', '#3dffa0', '#ff8a3a'];
const LOOT = [['GOLD BAR', 85, '#ffd93a'], ['OLD RADIO', 40, '#c8a070'], ['STRANGE IDOL', 70, '#c45cff'], ['TOOLBOX', 30, '#ff3355'], ['BRASS BELL', 45, '#e8b84a'], ['GEARS', 25, '#9aa0b0'], ['GLOW JAR', 55, '#3dffa0'], ['RUBBER DUCK', 15, '#fff04a'], ['LAPTOP', 60, '#4f8bff'], ['TEDDY BEAR', 20, '#b07a50']];
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const K3 = await boot({ title: 'LOOT RUN', gravity: 22, actions: { pick: ['KeyE'], drop: ['KeyQ'], sprint: ['ShiftLeft'] } });
const N = await net3d(window.XC?.net);
K3.online = !!N;
const S = K3.scene;
const G = { phase: 'menu', players: [], items: [], mons: [], t: 0, bank: 0, quota: 300, cfg: Object.assign({ mons: 2 }, JSON.parse(localStorage.getItem('lr_cfg') || '{}')) };
window.__L = G;

// ---------- scene: night ----------
S.clearColor = new V.Color4(0.01, 0.01, 0.025, 1);
const hemi = new V.HemisphericLight('h', new V.Vector3(0.2, 1, 0.1), S); hemi.intensity = 0.12; hemi.groundColor = new V.Color3(0.02, 0.02, 0.05);
S.fogMode = 2; S.fogDensity = 0.045; S.fogColor = new V.Color3(0.01, 0.01, 0.025);
const cam = tpcam(K3, { dist: 4.6, height: 1.7, pitch: 0.3 });
const flash = new V.SpotLight('flash', new V.Vector3(0, 2, 0), new V.Vector3(0, -0.2, 1), 0.9, 6, S); flash.intensity = 2.4; flash.range = 26; flash.diffuse = new V.Color3(1, 0.95, 0.8);
const matC = {}, mat = (hex, em = 0) => matC[hex + em] || (matC[hex + em] = (() => { const m = new V.StandardMaterial('m', S), c = V.Color3.FromHexString(hex); m.diffuseColor = c; m.emissiveColor = c.scale(em); m.specularColor = new V.Color3(0.05, 0.05, 0.05); m.maxSimultaneousLights = 8; return m; })());
const ground = V.CreateGround('g', { width: 160, height: 160 }, S); ground.position.z = 10; ground.material = mat('#2a2a22'); ground.isPickable = false;
K3.phys.box(0, -0.5, 10, 80, 0.5, 80);
// the ship: a lit deck with a ramp, the deposit zone glows
function box(x, y, z, w, h, d, m) { const b = V.CreateBox('b', { width: w, height: h, depth: d }, S); b.position.set(x, y + h / 2, z); b.material = m; b.isPickable = false; K3.phys.box(x, y + h / 2, z, w / 2, h / 2, d / 2); return b; }
box(SHIP.x, 0, SHIP.z - SHIP.d / 2 - 0.3, SHIP.w + 0.6, 4, 0.6, mat('#3a3e48'));
for (const s of [-1, 1]) box(SHIP.x + s * (SHIP.w / 2 + 0.3), 0, SHIP.z, 0.6, 4, SHIP.d, mat('#3a3e48'));
box(SHIP.x, 4, SHIP.z, SHIP.w + 0.6, 0.3, SHIP.d + 0.6, mat('#2a2e36'));
const pad = V.CreateGround('pad', { width: SHIP.w, height: SHIP.d }, S); pad.position.set(SHIP.x, 0.03, SHIP.z); pad.material = mat('#1a3a2a', 0.5); pad.isPickable = false;
const shipLight = new V.PointLight('shipL', new V.Vector3(SHIP.x, 3.4, SHIP.z), S); shipLight.intensity = 0.9; shipLight.range = 14; shipLight.diffuse = new V.Color3(0.8, 1, 0.85);
const inShip = (f) => Math.abs(f.x - SHIP.x) < SHIP.w / 2 && Math.abs(f.z - SHIP.z) < SHIP.d / 2;

// ---------- the facility: a maze of rooms (seeded, the same for everyone) ----------
const wallM = mat('#4a4438'), floorM = mat('#33302a');
let built = [];
const cellC = (cx, cz) => ({ x: X0 + cx * CW + CW / 2, z: Z0 + cz * CW + CW / 2 });
const cellOf = (x, z) => ({ cx: Math.max(0, Math.min(GW - 1, Math.floor((x - X0) / CW))), cz: Math.max(0, Math.min(GH - 1, Math.floor((z - Z0) / CW))) });
function buildFacility(seed) {
  built.forEach((m) => m.dispose()); built = [];
  const R = mulberry(seed), open = {};   // open['cx,cz,dir'] = passage
  const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a), id = (cx, cz) => cx + ',' + cz;
  const seen = new Set([id(3, 0)]), stack = [[3, 0]];
  while (stack.length) {
    const [cx, cz] = stack[stack.length - 1], nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => [cx + dx, cz + dz]).filter(([x, z]) => x >= 0 && z >= 0 && x < GW && z < GH && !seen.has(id(x, z)));
    if (!nb.length) { stack.pop(); continue; }
    const [nx, nz] = nb[Math.floor(R() * nb.length)]; open[key(id(cx, cz), id(nx, nz))] = true; seen.add(id(nx, nz)); stack.push([nx, nz]);
  }
  for (let i = 0; i < 9; i++) { const cx = Math.floor(R() * (GW - 1)), cz = Math.floor(R() * GH); open[key(id(cx, cz), id(cx + 1, cz))] = true; }   // a few loops
  G.open = (a, b) => !!open[key(a, b)];
  const wall = (x, z, w, d) => { const b = V.CreateBox('w', { width: w, height: WALL_H, depth: d }, S); b.position.set(x, WALL_H / 2, z); b.material = wallM; b.isPickable = false; built.push(b); built.push({ dispose: ((c) => () => K3.phys.remove(c))(K3.phys.box(x, WALL_H / 2, z, w / 2, WALL_H / 2, d / 2)) }); };
  const f = V.CreateGround('ff', { width: GW * CW, height: GH * CW }, S); f.position.set(0, 0.02, Z0 + (GH * CW) / 2); f.material = floorM; f.isPickable = false; built.push(f);
  // walls: a door gap (2.4 m) where a passage is open
  for (let cz = 0; cz < GH; cz++) for (let cx = 0; cx < GW; cx++) {
    const c = cellC(cx, cz);
    const side = (open2, x, z, horiz) => { if (open2) { const seg = (CW - 2.4) / 2; if (horiz) { wall(x - CW / 2 + seg / 2, z, seg, 0.4); wall(x + CW / 2 - seg / 2, z, seg, 0.4); } else { wall(x, z - CW / 2 + seg / 2, 0.4, seg); wall(x, z + CW / 2 - seg / 2, 0.4, seg); } } else horiz ? wall(x, z, CW + 0.4, 0.4) : wall(x, z, 0.4, CW + 0.4); };
    if (cx < GW - 1) side(G.open(id(cx, cz), id(cx + 1, cz)), c.x + CW / 2, c.z, false); else side(false, c.x + CW / 2, c.z, false);
    if (cz < GH - 1) side(G.open(id(cx, cz), id(cx, cz + 1)), c.x, c.z + CW / 2, true); else side(false, c.x, c.z + CW / 2, true);
    if (cx === 0) side(false, c.x - CW / 2, c.z, false);
    if (cz === 0) side(cx === 3, c.x, c.z - CW / 2, true);   // the front door
  }
  // a lamp over the door, dim emergency lights inside
  const door = cellC(3, 0); const lamp = new V.PointLight('door', new V.Vector3(door.x, 3, Z0 - 1.5), S); lamp.intensity = 0.7; lamp.range = 10; lamp.diffuse = new V.Color3(1, 0.6, 0.3); built.push(lamp);
  K3.world.updateSceneQueries();
  // loot in the rooms (never the entrance room)
  G.items.forEach((it) => it.m.dispose()); G.items = [];
  for (let i = 0; i < NITEMS; i++) {
    let cx, cz; do { cx = Math.floor(R() * GW); cz = Math.floor(R() * GH); } while (cx === 3 && cz === 0);
    const c = cellC(cx, cz), L = LOOT[Math.floor(R() * LOOT.length)], val = Math.round(L[1] * (0.7 + R() * 0.6));
    const m = V.CreateBox('it', { width: 0.55, height: 0.45, depth: 0.55 }, S); m.material = mat(L[2], 0.55); m.isPickable = false;
    const it = { i, name: L[0], val, m, x: c.x + (R() - 0.5) * (CW - 3), z: c.z + (R() - 0.5) * (CW - 3), by: null, banked: false };
    m.position.set(it.x, 0.25, it.z); G.items.push(it);
  }
  G.quota = Math.round(G.items.reduce((a, it) => a + it.val, 0) * (0.32 + 0.08 * (G.crew || 1)));
}
const neighbourCells = (cx, cz) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => [cx + dx, cz + dz]).filter(([x, z]) => x >= 0 && z >= 0 && x < GW && z < GH && G.open(cx + ',' + cz, x + ',' + z));
function pathCells(a, b) {
  const k = (c) => c[0] + ',' + c[1], prev = { [k(a)]: null }, q = [a];
  while (q.length) { const c = q.shift(); if (c[0] === b[0] && c[1] === b[1]) break; for (const n of neighbourCells(c[0], c[1])) if (!(k(n) in prev)) { prev[k(n)] = c; q.push(n); } }
  if (!(k(b) in prev)) return [];
  const out = []; for (let c = b; c && prev[k(c)] !== null; c = prev[k(c)]) out.unshift(c);
  return out;
}

// ---------- the things in the dark (the host runs them) ----------
const monM = mat('#0a0a0e'), eyeM = mat('#ff2020', 2);
function makeMonster(i, cx, cz) {
  const root = new V.TransformNode('mon', S), body = V.CreateCylinder('mb', { diameterTop: 0.5, diameterBottom: 0.9, height: 2.3 }, S); body.parent = root; body.position.y = 1.15; body.material = monM;
  for (const s of [-1, 1]) { const e = V.CreateSphere('eye', { diameter: 0.12 }, S); e.parent = root; e.position.set(s * 0.13, 2.0, 0.27); e.material = eyeM; }
  root.getChildMeshes().forEach((m) => (m.isPickable = false));
  const c = cellC(cx, cz); root.position.set(c.x, 0, c.z);
  return { i, root, x: c.x, z: c.z, path: [], chase: null, yaw: 0, see: 0, tx: c.x, tz: c.z };
}
function stepMonsters(dt) {
  for (const M of G.mons) {
    // can it see someone? (inside, close, nothing in between)
    let tgt = null, bd = 18;
    for (const P of G.players) { if (!P.alive) continue; const f = P.ch.pos(); if (f.z < Z0 + 0.5) continue; /* they never leave the facility */ const d = Math.hypot(f.x - M.x, f.z - M.z); if (d > bd) continue; const dir = { x: (f.x - M.x) / d, y: 0, z: (f.z - M.z) / d }; const h = K3.phys.ray({ x: M.x, y: 1.6, z: M.z }, dir, d); if (!h) { bd = d; tgt = P; } }
    if (tgt) { M.chase = tgt.nid; M.see = 3; } else if ((M.see -= dt) <= 0) M.chase = null;
    const sp = (M.chase ? 5.6 : 2.6) * dt;
    let gx, gz;
    if (M.chase && tgt) { gx = tgt.ch.pos().x; gz = tgt.ch.pos().z; M.path = []; }
    else {
      if (!M.path.length) { const here = cellOf(M.x, M.z), dest = [Math.floor(Math.random() * GW), Math.floor(Math.random() * GH)]; M.path = pathCells([here.cx, here.cz], dest); }
      const c = M.path[0]; if (!c) continue; const p = cellC(c[0], c[1]); gx = p.x; gz = p.z; if (Math.hypot(gx - M.x, gz - M.z) < 0.4) { M.path.shift(); continue; }
    }
    const dx = gx - M.x, dz = gz - M.z, d = Math.hypot(dx, dz); if (d < 0.05) continue;
    // move, sliding along walls (a short probe ray ahead)
    const nx = M.x + (dx / d) * sp, nz = M.z + (dz / d) * sp;
    const hx = K3.phys.ray({ x: M.x, y: 1, z: M.z }, { x: Math.sign(dx) || 1, y: 0, z: 0 }, Math.abs(nx - M.x) + 0.45), hz = K3.phys.ray({ x: M.x, y: 1, z: M.z }, { x: 0, y: 0, z: Math.sign(dz) || 1 }, Math.abs(nz - M.z) + 0.45);
    if (!hx) M.x = nx; if (!hz) M.z = nz;
    if (hx && hz && M.chase) M.see = 0;   // stuck on a corner: give up the chase, walk the maze again
    M.yaw = Math.atan2(dx, dz);
  }
}
const SLOW = 0.12;

// ---------- players ----------
let makeAvatar = null;
function makePlayer(i, o = {}) {
  const ch = K3.phys.character({ x: SHIP.x - 2 + i * 1.3, y: 0.1, z: SHIP.z + 1, radius: 0.35, height: 1.6 });
  return { i, nid: o.nid ?? i, owner: o.owner, remote: !!o.remote, name: o.name || (K3.xc?.player?.callsign || 'YOU'), ch, av: makeAvatar(PCOL[i % 4]), vel: { x: 0, y: 0, z: 0 }, yaw: 0, alive: true, grounded: true, input: { x: 0, y: 0, sprint: false }, prev: ch.pos(), carry: [], stam: 1, landT: 0 };
}
function stepPlayer(P, dt) {
  P.prev = P.ch.pos();
  if (!P.alive) return;
  const I = P.input; let wx = I.x, wz = I.y; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
  const sprint = I.sprint && P.stam > 0.05 && wl > 0.1; P.stam = Math.max(0, Math.min(1, P.stam + (sprint ? -dt / 4 : dt / 6)));
  const top = (sprint ? SPRINT : RUN) * (1 - SLOW * P.carry.length), acc = 40 * dt, tx = wx * top, tz = wz * top, dx = tx - P.vel.x, dz = tz - P.vel.z, dl = Math.hypot(dx, dz);
  if (dl <= acc) { P.vel.x = tx; P.vel.z = tz; } else { P.vel.x += (dx / dl) * acc; P.vel.z += (dz / dl) * acc; }
  P.vel.y -= GRAV * dt; if (P.grounded && P.vel.y < 0) P.vel.y = -2;
  P.ch.move(P.vel.x * dt, P.vel.y * dt, P.vel.z * dt);
  for (const n of P.ch.walls || []) { const l = Math.hypot(n.x, n.z) || 1, d = (P.vel.x * n.x + P.vel.z * n.z) / l; if (d < 0) { P.vel.x -= (d * n.x) / l; P.vel.z -= (d * n.z) / l; } }
  P.grounded = P.ch.grounded;
  if (Math.hypot(P.vel.x, P.vel.z) > 0.5) P.yaw = Math.atan2(P.vel.x, P.vel.z);
  const f = P.ch.pos();
  // caught?
  for (const M of G.mons) if (Math.hypot(M.x - f.x, M.z - f.z) < 1.0) { die(P); return; }
  // carrying loot onto the ship banks it
  if (P.carry.length && inShip(f)) for (const i of P.carry.slice()) bankItem(P, i);
}
function nearestItem(P) { const f = P.ch.pos(); let b = null, bd = 1.8; for (const it of G.items) { if (it.by != null || it.banked) continue; const d = Math.hypot(it.x - f.x, it.z - f.z); if (d < bd) { bd = d; b = it; } } return b; }
function tryPick(P) { const it = nearestItem(P); if (!it || P.carry.length >= 2) return; if (N && !N.isHost) return N.send({ k: 'pick', i: it.i }, { to: N.hostId }); givePick(P, it.i); }
function givePick(P, i) { const it = G.items[i]; if (!it || it.by != null || it.banked || P.carry.length >= 2 || !P.alive) return; it.by = P.nid; P.carry.push(i); if (N) N.send({ k: 'it', i, by: P.nid }); if (P === G.me) K3.audio.tone(660, 0.08, 'triangle', 0.05, 200); }
function tryDrop(P) { const i = P.carry[P.carry.length - 1]; if (i == null) return; const f = P.ch.pos(); if (N && !N.isHost) return N.send({ k: 'drop', i, x: f.x, z: f.z }, { to: N.hostId }); dropItem(P, i, f.x, f.z); }
function dropItem(P, i, x, z) { const it = G.items[i]; if (!it || it.by !== P.nid) return; it.by = null; it.x = x + (Math.random() - 0.5) * 0.6; it.z = z + (Math.random() - 0.5) * 0.6; P.carry = P.carry.filter((c) => c !== i); if (N) N.send({ k: 'it', i, by: null, x: it.x, z: it.z }); }
function bankItem(P, i) { if (N && !N.isHost) { if (!P.bankSent?.[i]) { (P.bankSent = P.bankSent || {})[i] = 1; N.send({ k: 'bank', i }, { to: N.hostId }); } return; } const it = G.items[i]; if (!it || it.by !== P.nid || it.banked) return; it.banked = true; it.by = null; P.carry = P.carry.filter((c) => c !== i); G.bank += it.val; if (N) N.send({ k: 'it', i, banked: 1, bank: G.bank }); banked(it); }
function banked(it) { it.m.setEnabled(false); hudMsg(`+${it.val} ${it.name}`, 1.2, '#3dffa0'); K3.audio.tone(880, 0.1, 'square', 0.05); if (G.bank >= G.quota && (!N || N.isHost)) setTimeout(() => finish(true), 900); }
function die(P) {
  if (!P.alive) return;
  P.alive = false; P.ch.collider.setEnabled(false); P.av.root.setEnabled(false);
  const f = P.ch.pos();
  if (!P.remote) { for (const i of P.carry.slice()) { if (N && !N.isHost) N.send({ k: 'drop', i, x: f.x, z: f.z }, { to: N.hostId }); else dropItem(P, i, f.x, f.z); } if (N) N.send({ k: 'out', n: P.nid }); }
  if (P === G.me) { hudMsg('CAUGHT', 2, '#ff3355', 'you dropped everything - watch your crew'); K3.audio.tone(90, 0.6, 'sawtooth', 0.07, -40); cam.shake = 0.5; }
  else hudMsg(`${P.name} was caught`, 1.5, '#ff6a7c');
  if ((!N || N.isHost) && G.players.every((Q) => !Q.alive)) setTimeout(() => finish(false, 'the whole crew was caught'), 1500);
}

// ---------- HUD ----------
const hud = document.createElement('div');
hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;font-family:Orbitron,Segoe UI,sans-serif;color:#fff;text-shadow:0 2px 6px #000';
hud.innerHTML = `<div data-top style="position:absolute;top:10px;left:50%;transform:translateX(-50%);font-weight:900;font-size:18px;letter-spacing:2px;text-align:center"></div>
  <div data-carry style="position:absolute;bottom:16px;left:16px;font-size:14px;line-height:1.5"></div>
  <div data-prompt style="position:absolute;bottom:24%;left:0;right:0;text-align:center;font-size:16px;color:#ffd93a"></div>
  <div data-msg style="position:absolute;top:26%;left:0;right:0;text-align:center;font-weight:900;font-size:clamp(24px,5vw,50px);letter-spacing:3px;opacity:0;transition:opacity .25s"></div>
  <div data-sub style="position:absolute;top:calc(26% + 58px);left:0;right:0;text-align:center;font-size:15px;opacity:0;transition:opacity .25s"></div>`;
K3.hud.appendChild(hud); hud.style.display = 'none';
let msgT = 0;
const hudMsg = (t, s = 1.4, c = '#fff', sub = '') => { const e = hud.querySelector('[data-msg]'), b = hud.querySelector('[data-sub]'); e.textContent = t; e.style.color = c; e.style.opacity = 1; b.textContent = sub; b.style.opacity = sub ? 1 : 0; msgT = s; };
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ---------- flow ----------
function clearAll() { G.players.forEach((P) => { P.ch.destroy(); P.av.dispose(); }); G.players = []; G.me = null; G.mons.forEach((M) => M.root.dispose()); G.mons = []; }
function menu() {
  G.phase = 'menu'; K3.playing = false; K3.setTouchButtons([]); hud.style.display = 'none'; document.exitPointerLock?.();
  if (N) return lobby.show();
  const b = (k, opts) => opts.map(([v, l]) => `<button class="k3-btn ${G.cfg[k] == v ? 'sel' : ''}" data-k="${k}" data-v="${v}">${l}</button>`).join('');
  const el = K3.shell.screen(`<div class="k3-title">LOOT RUN</div>
    <div class="k3-sub">Night shift at an abandoned facility. Go in with your flashlight, find scrap, carry it back onto the ship (two items at a time - heavy loot slows you down). Meet the quota before the shift ends. Something walks the halls: if it sees you, run.</div>
    <div class="k3-label">THINGS IN THE DARK</div><div class="k3-row">${b('mons', [[1, 'ONE'], [2, 'TWO'], [3, 'THREE']])}</div>
    <div class="k3-row"><button class="k3-btn primary" data-play style="min-width:220px;font-size:18px">▶ LAND</button><button class="k3-btn" data-set>SETTINGS</button></div>
    <div class="k3-sub" style="font-size:13px">${K3.isTouch ? 'stick moves · drag looks · PICK UP / DROP / RUN buttons' : 'WASD move · mouse look · SHIFT sprint · E pick up · Q drop'}</div>`);
  el.querySelectorAll('[data-k]').forEach((x) => (x.onclick = () => { G.cfg[x.dataset.k] = Number(x.dataset.v); localStorage.setItem('lr_cfg', JSON.stringify(G.cfg)); menu(); }));
  el.querySelector('[data-set]').onclick = () => K3.shell.settings(menu);
  el.querySelector('[data-play]').onclick = () => { K3.audio.unlock(); start(); };
}
function start(go = null) {
  clearAll();
  const seed = go ? go.seed : Math.floor(Math.random() * 1e9), R = mulberry(seed + 7);
  G.spectator = false;
  if (go) {
    G.spectator = !go.ids.includes(N.me) || !!go.late; G.cfg.mons = go.cfg.mons;
    go.ids.slice(0, 4).forEach((id, i) => G.players.push(makePlayer(i, { nid: id, owner: id, remote: id !== N.me || G.spectator, name: N.name(id) })));
    G.players.forEach((P) => { if (P.remote) P.interp = new Interp(0.1); });
    G.me = G.players.find((P) => P.nid === N.me && !G.spectator) || G.players[0];
  } else { G.players.push(makePlayer(0)); G.me = G.players[0]; }
  G.crew = G.players.length;
  buildFacility(seed);
  for (let i = 0; i < G.cfg.mons; i++) { const M = makeMonster(i, 1 + Math.floor(R() * (GW - 2)), 2 + Math.floor(R() * (GH - 2))); M.interp = new Interp(0.1); G.mons.push(M); }
  G.bank = 0; G.t = 0; G.phase = 'live'; cam.yaw = 0; cam.ready = false;
  K3.shell.screen(''); hud.style.display = '';
  K3.setTouchButtons([{ a: 'pick', label: 'PICK UP', right: 26, bottom: 40, size: 84, big: true }, { a: 'drop', label: 'DROP', right: 120, bottom: 30, size: 62 }, { a: 'sprint', label: 'RUN', right: 30, bottom: 140, size: 62, toggle: true }]);
  K3.playing = true; K3.paused = false; K3.menuOpen = false; if (!K3.isTouch && !K3.test) K3.canvas.requestPointerLock?.(); K3.canvas.focus();
  if (!G.spectator) window.XC?.start();
  hudMsg('THE SHIFT STARTS', 2.2, '#ffd93a', `quota: ${G.quota} · the facility is straight ahead`);
}
function finish(win, why = '') {
  if (G.phase === 'over') return;
  if (N && N.isHost) N.send({ k: 'fin', win, why, bank: G.bank });
  G.phase = 'over'; K3.playing = false; K3.menuOpen = false; document.exitPointerLock?.(); K3.setTouchButtons([]);
  if (!G.spectator) window.XC?.end({ score: G.bank + (win ? 300 : 0), won: win, stats: { won: win ? 1 : 0 } });
  const el = K3.shell.screen(`<div class="k3-title" style="font-size:46px;${win ? '' : 'background:linear-gradient(90deg,#ff3355,#ff8a3a);-webkit-background-clip:text;background-clip:text'}">${win ? 'QUOTA MET' : 'QUOTA MISSED'}</div>
    <div class="k3-sub">${G.bank} / ${G.quota} scrap${why ? ' · ' + why : ''} · shift time ${fmt(G.t)}</div>
    <div class="k3-sub">${G.players.map((P) => `${P === G.me ? 'YOU' : P.name}: ${P.alive ? 'made it' : 'caught'}`).join(' · ')}</div>
    <div class="k3-row">${!N ? '<button class="k3-btn primary" data-a>NEW SHIFT</button><button class="k3-btn" data-m>MENU</button>' : N.isHost ? '<button class="k3-btn primary" data-lobby>BACK TO LOBBY</button><button class="k3-btn" data-leave>LEAVE</button>' : `<div class="k3-sub">waiting for <b>${N.name(N.hostId)}</b>...</div><button class="k3-btn" data-leave>LEAVE</button>`}</div>`);
  el.querySelector('[data-a]')?.addEventListener('click', () => start());
  el.querySelector('[data-m]')?.addEventListener('click', () => menu());
  el.querySelector('[data-lobby]')?.addEventListener('click', () => lobby.backToLobby());
  el.querySelector('[data-leave]')?.addEventListener('click', () => (window.XC ? XC.exit() : history.back()));
}
function update(dt) {
  if (G.phase !== 'live' || !G.me) return;
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) { hud.querySelector('[data-msg]').style.opacity = 0; hud.querySelector('[data-sub]').style.opacity = 0; } }
  G.t += dt;
  const me = G.me, mv = K3.input.move, s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
  if (!G.spectator && !me.remote && !me.auto) { me.input.x = mv.x * c + mv.y * s; me.input.y = -mv.x * s + mv.y * c; me.input.sprint = K3.input.down('sprint'); if (me.alive && K3.input.tap('pick')) tryPick(me); if (me.alive && K3.input.tap('drop')) tryDrop(me); }
  if (!N || N.isHost) stepMonsters(dt); else for (const M of G.mons) { const smp = M.interp.sample(); if (smp) { const { a, b, k } = smp; M.x = lerp(a[1], b[1], Math.min(1.2, k)); M.z = lerp(a[2], b[2], Math.min(1.2, k)); M.yaw = b[3]; M.chase = b[4] ? 1 : null; } }
  for (const P of G.players) { if (P.remote) followNet(P); else stepPlayer(P, dt); }
  // carried loot follows its carrier
  for (const it of G.items) { if (it.banked) continue; if (it.by != null) { const P = G.players.find((Q) => Q.nid === it.by); if (P) { const f = P.ch.pos(), k = P.carry.indexOf(it.i); it.x = f.x; it.z = f.z; it.m.position.set(f.x + Math.sin(P.yaw) * 0.5, 0.9 + k * 0.5, f.z + Math.cos(P.yaw) * 0.5); } } else it.m.position.set(it.x, 0.25 + Math.sin(G.t * 2 + it.i) * 0.04, it.z); }
  if (N) netTick(dt);
  if ((!N || N.isHost) && G.t >= DAY) finish(G.bank >= G.quota, 'the ship had to leave');
}
let specI = 0;
function render(alpha, dt) {
  for (const P of G.players) {
    const p0 = P.prev, p1 = P.ch.pos(); P.av.root.position.set(p0.x + (p1.x - p0.x) * alpha, p0.y + (p1.y - p0.y) * alpha, p0.z + (p1.z - p0.z) * alpha);
    const cur = P.av.root.rotation.y, d = Math.atan2(Math.sin(P.yaw - cur), Math.cos(P.yaw - cur)); P.av.root.rotation.y = cur + d * Math.min(1, dt * 14);
    const sp = Math.hypot(P.vel.x, P.vel.z); if (P.alive) P.av.play(sp > 0.6 ? 'Run' : 'Idle', { speed: Math.max(0.7, sp / RUN) });
  }
  for (const M of G.mons) { M.root.position.set(M.x, Math.sin(G.t * 9) * (M.chase ? 0.06 : 0.02), M.z); M.root.rotation.y = M.yaw; }
  if (G.debugCam) { cam.cam.position.set(...G.debugCam.pos); cam.cam.setTarget(new V.Vector3(...G.debugCam.at)); return; }
  if (G.phase === 'menu' || !G.me) { const t = performance.now() / 9000; cam.cam.position.set(Math.sin(t) * 14, 6, -26 + Math.cos(t) * 6); cam.cam.setTarget(new V.Vector3(0, 1, 6)); flash.position.set(0, 3, -20); flash.direction = new V.Vector3(0, -0.3, 1); return; }
  let who = G.me;
  if (!G.me.alive || G.spectator) { const alive = G.players.filter((P) => P.alive); if (alive.length) { if (K3.input.tap('pick')) specI++; who = alive[specI % alive.length]; } }
  const f = who.ch.pos();
  cam.update(f, dt);
  flash.position.set(f.x, 1.7, f.z); flash.direction = new V.Vector3(Math.sin(cam.yaw), -0.18, Math.cos(cam.yaw));
  const left = Math.max(0, DAY - G.t), near = G.me.alive && nearestItem(G.me);
  hud.querySelector('[data-top]').innerHTML = `${G.bank} / ${G.quota} <small style="font-size:12px;color:#c8c0e8">SCRAP</small><br><small style="font-size:13px;color:${left < 60 ? '#ff6a7c' : '#c8c0e8'}">SHIFT ENDS IN ${fmt(left)}${who !== G.me ? ` · watching ${who.name}` : ''}</small>`;
  hud.querySelector('[data-carry]').innerHTML = G.me.alive ? `HANDS: ${G.me.carry.length ? G.me.carry.map((i) => `<b style="color:${LOOT.find((l) => l[0] === G.items[i].name)[2]}">${G.items[i].name}</b> (${G.items[i].val})`).join(' · ') : 'empty'}<br>STAMINA ${'▮'.repeat(Math.ceil(G.me.stam * 10))}` : '';
  hud.querySelector('[data-prompt]').textContent = near ? (G.me.carry.length >= 2 ? `${near.name} (${near.val}) · hands full` : `E · pick up ${near.name} (${near.val})`) : G.me.carry.length && G.me.alive && f.z < Z0 ? 'carry it onto the ship to bank it' : '';
}

// ================= ONLINE (co-op: everyone moves themselves, the host runs the monsters and the loot) =================
const lobby = N && onlineLobby(K3, N, {
  title: 'LOOT RUN', sub: 'ONLINE CO-OP · up to 4 · meet the quota together',
  hostOpts: [{ key: 'mons', label: 'THINGS IN THE DARK', opts: [[1, 'ONE'], [2, 'TWO'], [3, 'THREE']] }],
  myOpts: [], cfg: { mons: G.cfg.mons }, mine: {},
  onStart: (go) => start(go),
  onShow: () => { clearAll(); G.phase = 'menu'; hud.style.display = 'none'; },
});
if (N) netBadge(K3, N, { right: 12, top: 12 });
const r2 = (v) => Math.round(v * 100) / 100;
let sendAcc = 0;
function netTick(dt) {
  sendAcc += dt; if (sendAcc < 1 / 30) return; sendAcc = 0;
  const mine = G.players.filter((P) => !P.remote && P.alive);
  if (mine.length) N.send({ k: 's', t: N.now(), p: mine.map((P) => { const q = P.ch.pos(); return [P.nid, r2(q.x), r2(q.y), r2(q.z), r2(P.vel.x), r2(P.vel.z), r2(P.yaw)]; }) }, { fast: true });
  if (N.isHost) N.send({ k: 'm', t: N.now(), m: G.mons.map((M) => [M.i, r2(M.x), r2(M.z), r2(M.yaw), M.chase ? 1 : 0]), bank: G.bank, gt: r2(G.t) }, { fast: true });
}
function followNet(P) {
  P.prev = P.ch.pos();
  const s = P.alive && P.interp && P.interp.sample(); if (!s) return;
  const { a, b, k } = s, kk = Math.min(1.25, k), h = P.ch.height / 2;
  const x = lerp(a[1], b[1], kk), y = lerp(a[2], b[2], kk), z = lerp(a[3], b[3], kk);
  P.ch.body.setTranslation({ x, y: y + h, z }, true); P.ch.body.setNextKinematicTranslation({ x, y: y + h, z });
  P.vel = { x: b[4], y: 0, z: b[5] }; P.yaw = lerpAngle(a[6], b[6], kk);
}
if (N) {
  N.on((d, from) => {
    if (!d || !d.k || d.k[0] === 'L' || !G.players.length) return;
    const P = (nid) => G.players.find((x) => x.nid === nid);
    if (d.k === 's') { for (const st of d.p) { const Q = P(st[0]); if (Q && Q.remote && Q.owner === from) Q.interp.push(st, d.t); } return; }
    if (d.k === 'out') { const Q = P(d.n); if (Q && Q.owner === from) die(Q); return; }
    if (N.isHost) {
      const Q = G.players.find((x) => x.owner === from);
      if (d.k === 'pick' && Q) givePick(Q, d.i);
      if (d.k === 'drop' && Q) dropItem(Q, d.i, d.x, d.z);
      if (d.k === 'bank' && Q) bankItem(Q, d.i);
      return;
    }
    if (from !== N.hostId) return;
    if (d.k === 'm') { for (const st of d.m) { const M = G.mons[st[0]]; if (M) M.interp.push(st, d.t); } G.bank = d.bank; if (Math.abs(G.t - d.gt) > 1) G.t = d.gt; }
    if (d.k === 'it') {
      const it = G.items[d.i]; if (!it) return;
      // who holds it now (take it out of everyone else's hands)
      for (const Q of G.players) Q.carry = Q.carry.filter((c) => c !== d.i);
      if (d.banked) { it.banked = true; it.by = null; G.bank = d.bank; banked(it); return; }
      it.by = d.by; if (d.by != null) { const Q = P(d.by); if (Q) Q.carry.push(d.i); if (Q === G.me) K3.audio.tone(660, 0.08, 'triangle', 0.05, 200); } else { it.x = d.x; it.z = d.z; }
    }
    if (d.k === 'fin') { G.bank = d.bank; finish(d.win, d.why); }
  });
  const leave = () => { for (const P of G.players) if (!N.players.some((p) => p.id === P.nid) && P.alive) { P.alive = false; P.av.root.setEnabled(false); P.ch.collider.setEnabled(false); if (N.isHost) for (const i of P.carry.slice()) dropItem(P, i, P.ch.pos().x, P.ch.pos().z); } };
  N.onLeave(leave); N.onHost(leave);
}

K3.shell.loading(0.3);
makeAvatar = await avatars(K3, 'assets/common/buddy.glb', { height: 1.5 });
K3.shell.loading(1);
K3.loop(update, render);
menu();
G.simulate = (n) => { for (let i = 0; i < n; i++) { update(1 / 60); K3.world.step(); } };
const Q = new URLSearchParams(location.search);
if (Q.has('auto')) start();
