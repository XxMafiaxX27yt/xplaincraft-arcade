// REDLINE - 3D circuit racing. Pick a car, launch on the green, shift at the redline, spool the turbo, drift to fill nitro.
import { boot, V, canvasTexture } from '../../kit3d/kit3d.js';
import { sampleTrack, buildTrack, locate, ROAD_W } from './track.js';
import { Car, CARS, EngineSound, rotate } from './car.js';
import { net3d, Interp, lerp } from '../../kit3d/net3d.js';
import { onlineLobby, netBadge } from '../../kit3d/online.js';

const K3 = await boot({ title: 'REDLINE', gravity: 13, actions: { up: ['KeyE', 'ShiftRight'], down: ['KeyQ', 'ControlRight'], hand: ['Space'], nitro: ['ShiftLeft', 'KeyN'], cam: ['KeyC'], reset: ['KeyR'], gas: [], brake: [], left: [], right: [] } });
const S = K3.scene;
// online (from a party): everyone drives their own car, the host drives the AI cars and keeps the finishing order
const N = await net3d(window.XC?.net);
K3.online = !!N;
const G = { phase: 'menu', cars: [], cfg: Object.assign({ car: 'apex', mode: 'race', diff: 'normal', auto: true, laps: 3 }, JSON.parse(localStorage.getItem('rl_cfg') || '{}')), best: JSON.parse(localStorage.getItem('rl_best') || '{}'), camMode: 0, pops: [] };
window.__R = G;

// ---------- scene: late-afternoon sky ----------
S.clearColor = new V.Color4(0.55, 0.7, 0.92, 1);
const sky = V.CreateSphere('sky', { diameter: 1800, segments: 16, sideOrientation: 1 }, S);
sky.material = (() => { const m = new V.StandardMaterial('skym', S); m.disableLighting = true; m.backFaceCulling = false; m.emissiveTexture = canvasTexture(S, 16, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a4a9a'); g.addColorStop(0.42, '#7aa6e8'); g.addColorStop(0.5, '#ffd0a0'); g.addColorStop(0.53, '#c8d8e8'); g.addColorStop(1, '#88a0b8'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); m.fogEnabled = false; return m; })();
sky.isPickable = false; sky.infiniteDistance = true;
const hemi = new V.HemisphericLight('h', new V.Vector3(0.2, 1, 0.1), S); hemi.intensity = 0.75; hemi.groundColor = new V.Color3(0.35, 0.4, 0.3);
const sun = new V.DirectionalLight('sun', new V.Vector3(-0.5, -0.8, 0.4), S); sun.intensity = 1.05; sun.diffuse = new V.Color3(1, 0.92, 0.8);
S.fogMode = 2; S.fogDensity = 0.0028; S.fogColor = new V.Color3(0.72, 0.8, 0.9);
const cam = new V.FreeCamera('cam', new V.Vector3(0, 10, -30), S); cam.minZ = 0.2; cam.maxZ = 2500; cam.inertia = 0; S.activeCamera = cam;

// ---------- load ----------
K3.shell.loading(0.1);
const T = sampleTrack();
const carSrc = {}, props = {};
await Promise.all(Object.values(CARS).map(async (c) => { carSrc[c.model] = await K3.loadGLB(`assets/redline/cars/${c.model}.glb`); }));
K3.shell.loading(0.5);
await Promise.all(['grandStandCovered', 'bannerTowerRed', 'overheadLights', 'lightPostModern', 'treeLarge', 'treeSmall', 'pitsGarage', 'billboard', 'billboardDouble_exclusive'].map(async (n) => { try { props[n] = await K3.loadGLB(`assets/redline/props/${n}.glb`); } catch (e) { console.warn(n, e); } }));
K3.shell.loading(0.8);
buildTrack(K3, T, props);
K3.world.updateSceneQueries();
// blob shadows under cars (cheap, readable)
const blobMat = (() => { const m = new V.StandardMaterial('blob', S); m.diffuseTexture = canvasTexture(S, 64, 64, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); m.diffuseTexture.hasAlpha = true; m.useAlphaFromDiffuseTexture = true; m.specularColor = V.Color3.Black(); m.disableLighting = true; return m; })();
// nitro flames
const flameMat = (() => { const m = new V.StandardMaterial('flame', S); m.emissiveColor = new V.Color3(0.3, 0.7, 1); m.disableLighting = true; m.alpha = 0.85; return m; })();
const glow = new V.GlowLayer('g', S, { mainTextureRatio: 0.4 }); glow.intensity = 0.8; glow.addIncludedOnlyMesh?.(V.CreateBox('dummy', { size: 0.001 }, S));

// ---------- HUD ----------
const hud = document.createElement('div');
hud.innerHTML = `<style>
.rh{position:absolute;inset:0;pointer-events:none;font-family:Orbitron,Segoe UI,sans-serif;color:#fff;text-shadow:0 2px 5px rgba(0,0,0,.7)}
.rh-top{position:absolute;top:10px;left:14px;font-weight:900;font-size:clamp(16px,2.6vw,26px);line-height:1.15}
.rh-top small{display:block;font-size:clamp(13px,1.8vw,17px);color:#fff;font-weight:700;letter-spacing:1px}
.rh-pos{position:absolute;top:10px;right:200px;font-weight:900;font-size:clamp(26px,5vw,52px)}
.rh-pos small{font-size:.45em;color:#c8d0e8}
.rh canvas.rh-map{position:absolute;inset:auto;top:10px;right:10px;width:180px;height:180px;background:rgba(10,12,24,.45);border-radius:12px}
.rh canvas.rh-gauge{position:absolute;inset:auto;right:18px;bottom:14px;width:240px;height:240px}
.rh-pop{position:absolute;left:0;right:0;top:30%;text-align:center;font-weight:900;font-size:clamp(22px,4.6vw,46px);letter-spacing:3px;opacity:0;transition:opacity .2s}
.rh-lights{position:absolute;left:50%;top:14%;transform:translateX(-50%);display:flex;gap:14px}
.rh-lights i{width:44px;height:44px;border-radius:50%;background:#2a1018;border:3px solid #111;box-shadow:inset 0 0 8px #000}
.rh-lights i.r{background:#ff2040;box-shadow:0 0 22px #ff2040}.rh-lights i.g{background:#30ff70;box-shadow:0 0 22px #30ff70}
.rh-hint{position:absolute;left:50%;top:calc(14% + 64px);transform:translateX(-50%);font-size:13px;letter-spacing:2px;color:#c8d0e8}
@media (max-width:700px){.rh canvas.rh-gauge{width:170px;height:170px;bottom:auto;top:150px;right:8px}.rh canvas.rh-map{width:130px;height:130px}.rh-pos{right:150px}}
</style><div class="rh"><div class="rh-top"></div><div class="rh-pos"></div><canvas class="rh-map" width="360" height="360"></canvas><canvas class="rh-gauge" width="480" height="480"></canvas><div class="rh-pop"></div><div class="rh-lights" style="display:none"><i></i><i></i><i></i><i></i><i></i></div><div class="rh-hint"></div></div>`;
K3.hud.appendChild(hud); hud.style.display = 'none';
const H = (c) => hud.querySelector(c);
let popT = 0;
const pop = (t, col = '#fff', s = 1.1) => { const e = H('.rh-pop'); e.textContent = t; e.style.color = col; e.style.opacity = 1; popT = s; };
// minimap: the track drawn once into an offscreen canvas
const mapBase = document.createElement('canvas'); mapBase.width = mapBase.height = 360;
(() => { let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9; T.forEach((p) => { mnx = Math.min(mnx, p.x); mxx = Math.max(mxx, p.x); mnz = Math.min(mnz, p.z); mxz = Math.max(mxz, p.z); }); const sc = 320 / Math.max(mxx - mnx, mxz - mnz); G.map = (x, z) => [20 + (x - mnx) * sc + (320 - (mxx - mnx) * sc) / 2, 340 - ((z - mnz) * sc + (320 - (mxz - mnz) * sc) / 2)]; const c = mapBase.getContext('2d'); c.lineWidth = 10; c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineJoin = 'round'; c.beginPath(); T.forEach((p, i) => { const [x, y] = G.map(p.x, p.z); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); c.stroke(); const [sx, sy] = G.map(T[0].x, T[0].z); c.fillStyle = '#ff3355'; c.fillRect(sx - 7, sy - 3, 14, 6); })();
function drawGauge(car) {
  const c = H('.rh-gauge').getContext('2d'), s = car.spec, W = 480, cx = 240, cy = 250, R = 190;
  c.clearRect(0, 0, W, W);
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, ang = (r) => a0 + (a1 - a0) * Math.min(1.02, r / (s.redline + 800));
  c.lineWidth = 26; c.lineCap = 'butt';
  c.strokeStyle = 'rgba(10,12,24,.55)'; c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke();
  c.strokeStyle = 'rgba(61,255,160,.65)'; c.beginPath(); c.arc(cx, cy, R, ang(s.redline * 0.86), ang(s.redline)); c.stroke();     // perfect-shift zone
  c.strokeStyle = 'rgba(255,40,70,.85)'; c.beginPath(); c.arc(cx, cy, R, ang(s.redline), ang(s.redline + 800)); c.stroke();        // redline
  // revs
  c.lineWidth = 14; c.strokeStyle = car.limiter ? '#ff3355' : car.rpm > s.redline * 0.86 ? '#3dffa0' : '#22e6ff'; c.beginPath(); c.arc(cx, cy, R - 30, a0, ang(car.rpm)); c.stroke();
  c.fillStyle = '#c8d0e8'; c.font = 'bold 22px Orbitron'; c.textAlign = 'center';
  for (let k = 0; k <= Math.floor((s.redline + 800) / 1000); k++) { const a = ang(k * 1000); c.fillText(String(k), cx + Math.cos(a) * (R - 64), cy + Math.sin(a) * (R - 64) + 8); }
  // needle
  const a = ang(car.rpm); c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * (R - 18), cy + Math.sin(a) * (R - 18)); c.stroke();
  c.fillStyle = '#fff'; c.font = '900 76px Orbitron'; c.fillText(car.gear === -1 ? 'R' : String(car.gear), cx, cy + 36);
  c.font = '900 44px Orbitron'; c.fillText(String(Math.round(Math.abs(car.speed) * 3.6)), cx, cy + 118); c.font = 'bold 16px Orbitron'; c.fillStyle = '#c8d0e8'; c.fillText('KM/H', cx, cy + 142);
  c.fillText(car.auto ? 'AUTO' : 'MANUAL', cx, cy - 60);
  // turbo boost (small arc) + nitro bar
  c.lineWidth = 10; c.strokeStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.arc(cx, cy, 70, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  c.strokeStyle = '#ffd93a'; c.beginPath(); c.arc(cx, cy, 70, Math.PI * 1.15, Math.PI * (1.15 + 0.7 * car.boost)); c.stroke();
  c.fillStyle = '#ffd93a'; c.font = 'bold 14px Orbitron'; c.fillText('TURBO', cx, cy - 86);
  c.fillStyle = 'rgba(10,12,24,.6)'; c.fillRect(cx - 150, cy + 168, 300, 18); c.fillStyle = car.nitroOn ? '#ffffff' : '#22a6ff'; c.fillRect(cx - 150, cy + 168, 300 * car.nitro, 18);
  c.fillStyle = '#c8d0e8'; c.font = 'bold 14px Orbitron'; c.fillText('NITRO', cx, cy + 206);
}
function drawMap() {
  const c = H('.rh-map').getContext('2d'); c.clearRect(0, 0, 360, 360); c.drawImage(mapBase, 0, 0);
  G.cars.forEach((car) => { const p = car.pos(), [x, y] = G.map(p.x, p.z); c.fillStyle = car === G.me ? '#ffd93a' : car.spec.col; c.beginPath(); c.arc(x, y, car === G.me ? 10 : 7, 0, 7); c.fill(); if (car === G.me) { c.strokeStyle = '#000'; c.lineWidth = 3; c.stroke(); } });
}
const fmt = (t) => (t == null ? '--:--.---' : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${String(Math.floor((t % 1) * 1000)).padStart(3, '0')}`);

// ---------- menu ----------
function menu() {
  G.phase = 'menu'; K3.playing = false; hud.style.display = 'none'; K3.setTouchButtons([]); document.exitPointerLock?.();
  if (N) return lobby.show();
  const b = (k, opts) => opts.map(([v, l]) => `<button class="k3-btn ${G.cfg[k] === v ? 'sel' : ''}" data-k="${k}" data-v="${v}">${l}</button>`).join('');
  const carCards = Object.entries(CARS).map(([id, c]) => `<button class="k3-btn ${G.cfg.car === id ? 'sel' : ''}" data-k="car" data-v="${id}" style="min-width:160px;text-align:left"><span style="color:${c.col}">${c.name}</span><br><small style="font-family:Rajdhani;font-weight:600;letter-spacing:0;color:#c8c0e8">${c.blurb}<br>${c.torque} Nm · ${c.gears.length} gears · ${c.drive.toUpperCase()} · turbo ${Math.round(c.turbo * 100)}%</small></button>`).join('');
  const el = K3.shell.screen(`<div class="k3-title">REDLINE</div>
    <div class="k3-sub">Launch on the green with the revs in the green zone. Shift up at the redline for a PERFECT SHIFT. The turbo spools above 4000 rpm. Drift, catch air and slipstream to fill your nitro.</div>
    <div class="k3-label">CAR</div><div class="k3-row">${carCards}</div>
    <div class="k3-label">MODE</div><div class="k3-row">${b('mode', [['race', 'RACE · 6 cars'], ['trial', 'TIME TRIAL']])}</div>
    <div class="k3-label">GEARBOX · RIVALS</div><div class="k3-row">${b('auto', [[true, 'AUTO'], [false, 'MANUAL (perfect shifts)']])}${G.cfg.mode === 'race' ? b('diff', [['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']]) : ''}</div>
    <div class="k3-row"><button class="k3-btn primary" data-play style="min-width:220px;font-size:18px">▶ RACE</button><button class="k3-btn" data-set>SETTINGS</button></div>
    <div class="k3-sub" style="font-size:13px">${K3.isTouch ? 'stick steers · GAS / BRAKE / NITRO / DRIFT buttons · gears are automatic' : 'W / ↑ gas · S / ↓ brake (and reverse) · A D / ← → steer · SPACE handbrake drift · SHIFT nitro · E / Q gear up / down · C camera · R back on track'}${G.best[G.cfg.car] ? ` · best lap with this car: ${fmt(G.best[G.cfg.car])}` : ''}</div>`);
  el.querySelectorAll('[data-k]').forEach((x) => (x.onclick = () => { const v = x.dataset.v; G.cfg[x.dataset.k] = v === 'true' ? true : v === 'false' ? false : v; localStorage.setItem('rl_cfg', JSON.stringify(G.cfg)); menu(); }));
  el.querySelector('[data-set]').onclick = () => K3.shell.settings(menu);
  el.querySelector('[data-play]').onclick = () => { K3.audio.unlock(); start(); };
}

// ---------- race ----------
const AI_NAMES = ['VORTEX', 'BLAZE', 'KITE', 'DRIFTER', 'NEON'];
function gridSpot(k) { const n = T.length, i = (n - 6 - Math.floor(k / 2) * 5) % n, p = T[i], side = (k % 2 ? 1 : -1) * 3.2; return { x: p.x + p.nx * side, y: p.y, z: p.z + p.nz * side, yaw: Math.atan2(p.dx, p.dz), i }; }
function clearCars() { G.cars.forEach((c) => c.dispose()); G.cars = []; G.me = null; }
function start(go = null) {
  clearCars();
  // the grid: AI cars at the front, players at the back (online: in party order)
  let slots;
  if (go) {
    G.spectator = !go.ids.includes(N.me) || !!go.late; G.laps = go.cfg.laps; G.mode = 'race';
    const nAi = Math.max(0, go.cfg.size - go.ids.length), rnd = ((a) => () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; })(go.seed);
    slots = [];
    for (let k = 0; k < nAi; k++) slots.push({ nid: 'ai' + k, ai: true, owner: N.hostId, car: Object.keys(CARS)[k % 4], skill: { easy: 0.8, normal: 0.9, hard: 0.99 }[go.cfg.diff] * (0.94 + rnd() * 0.06), off: (rnd() - 0.5) * 4 });
    go.ids.forEach((id) => slots.push({ nid: id, owner: id, car: (go.picks[id] || {}).car || 'apex', auto: (go.picks[id] || {}).auto ?? true, name: N.name(id) }));
  } else {
    G.laps = G.cfg.laps; G.mode = G.cfg.mode; G.spectator = false;
    const field = G.cfg.mode === 'race' ? 6 : 1, others = Object.keys(CARS).filter((k) => k !== G.cfg.car);
    slots = Array.from({ length: field }, (_, k) => (k === field - 1 ? { me: true, car: G.cfg.car, auto: G.cfg.auto } : { ai: true, car: others[k % others.length], paint: k >= others.length ? ['#ff8a3a', '#c45cff'][k % 2] : null, skill: { easy: 0.8, normal: 0.9, hard: 0.99 }[G.cfg.diff] * (0.94 + Math.random() * 0.06), off: (Math.random() - 0.5) * 4 }));
  }
  for (let k = 0; k < slots.length; k++) {
    const sl = slots[k], me = sl.me || (N && sl.nid === N.me && !G.spectator), remote = N && sl.owner !== N.me;
    const spec = CARS[sl.car];
    const car = new Car(K3, carSrc[spec.model], spec, gridSpot(k), { ai: !!sl.ai, color: sl.paint || (N && sl.ai && k >= 4 ? ['#ff8a3a', '#c45cff'][k % 2] : null) });
    car.name = sl.name || (me ? (K3.xc?.player?.callsign || 'YOU') : AI_NAMES[k % 5]);
    car.auto = sl.ai ? true : sl.auto;
    Object.assign(car, { nid: sl.nid ?? k, owner: sl.owner, human: !sl.ai });
    if (remote) { car.setRemote(true); car.interp = new Interp(0.1); }
    car.track = { idx: gridSpot(k).i, lap: 0, half: true, lapStart: null, laps: [], done: false, prog: 0 };   // behind the line: crossing it starts lap 1
    car.skill = sl.skill ?? 0.9; car.lineOff = sl.off ?? 0;
    const blob = V.CreateGround('blob', { width: 2.6, height: 5.2 }, S); blob.material = blobMat; blob.parent = car.node; blob.position.y = 0.05 - 0.6; blob.isPickable = false;
    const fl = [-0.35, 0.35].map((x) => { const f = V.CreateCylinder('fl', { diameterTop: 0.05, diameterBottom: 0.28, height: 1.2, tessellation: 8 }, S); f.rotation.x = -Math.PI / 2; f.position.set(x, 0.2, -2.6); f.parent = car.node; f.material = flameMat; f.isPickable = false; f.setEnabled(false); glow.addIncludedOnlyMesh?.(f); return f; });
    car.flames = fl;
    G.cars.push(car);
    if (me) G.me = car;
  }
  G.firstHumanT = null; G.endT = null;
  // watching (arrived late): the camera rides with the leader
  if (!G.me) { G.me = G.cars[G.cars.length - 1]; G.watch = true; } else G.watch = false;
  const raw = K3.audio.raw();
  if (raw) { G.me.sound = new EngineSound(raw, { main: true }); G.cars.filter((c) => c !== G.me).slice(0, 3).forEach((c) => (c.sound = new EngineSound(raw, { main: false }))); }
  G.phase = 'count'; G.countT = 4.2; G.time = 0; G.race = { countdown: true, done: false }; G.finish = [];
  K3.shell.screen(''); hud.style.display = '';
  K3.setTouchButtons([{ a: 'gas', label: 'GAS', right: 24, bottom: 30, size: 96, big: true }, { a: 'brake', label: 'BRAKE', right: 136, bottom: 22, size: 72 }, { a: 'nitro', label: 'NITRO', right: 30, bottom: 140, size: 70 }, { a: 'hand', label: 'DRIFT', right: 116, bottom: 112, size: 64 }]);
  K3.playing = true; K3.paused = false; K3.menuOpen = false; K3.canvas.focus();
  if (!G.watch) window.XC?.start();
  H('.rh-lights').style.display = 'flex';
}
// AI: aim at a point ahead on the racing line, brake for the curvature coming up, nitro on straights
function aiDrive(car, dt) {
  const n = T.length, p = car.pos(), tr = car.track, I = car.input, sp = Math.max(0, car.speed);
  const look = Math.round((7 + sp * 0.5) / 2), tp = T[(tr.idx + look) % n];
  // traffic: a car right ahead in my lane -> move over to the other side (and lift if I am about to hit it)
  const f0 = car.forward(); let avoid = 0, lift = false;
  for (const o of G.cars) {
    if (o === car) continue;
    const q = o.pos(), rx = q.x - p.x, rz = q.z - p.z, ahead = rx * f0.x + rz * f0.z, side = rx * f0.z - rz * f0.x;
    if (ahead > 0 && ahead < 14 && Math.abs(side) < 2.8) { avoid = side > 0 ? -3.5 : 3.5; if (ahead < 7 && sp > Math.max(0, o.speed) + 2) lift = true; }
  }
  const off = Math.max(-4.5, Math.min(4.5, car.lineOff - tp.turn * 6 + avoid));
  const tx = tp.x + tp.nx * off, tz = tp.z + tp.nz * off, f = car.forward();
  const dx = tx - p.x, dz = tz - p.z, cross = f.z * dx - f.x * dz, dot = f.x * dx + f.z * dz;   // + = target is to the right
  I.steer = Math.max(-1, Math.min(1, Math.atan2(cross, dot) * 2.4));
  let kmax = 0; const win = Math.round((sp * 2.0 + 24) / 2); for (let k = 3; k < win; k++) kmax = Math.max(kmax, T[(tr.idx + k) % n].k);
  const vmax = Math.min(95, Math.sqrt((12 * car.skill) / Math.max(0.0012, kmax)));
  I.throttle = lift ? 0.2 : sp < vmax - 1 ? 1 : sp < vmax + 1.5 ? 0.35 : 0;
  I.brake = sp > vmax + 2.5 ? Math.min(1, (sp - vmax) / 8) : 0;
  I.handbrake = false;
  I.nitro = kmax < 0.006 && sp > 25 && car.nitro > 0.2 && Math.random() < 0.9;
  // stuck: reverse out, then back on the road
  // stuck (or crawling along a wall): no progress round the track for 3 s -> back on the road
  if (G.phase === 'live') { if (car.track.prog > (car.bestProg ?? -1)) { car.bestProg = car.track.prog; car.stuck = 0; } else car.stuck = (car.stuck || 0) + dt; if (car.stuck > 3) { resetCar(car); car.stuck = 0; } }
}
function resetCar(car) { const p = T[car.track.idx], q = T[(car.track.idx + 1) % T.length]; car.place({ x: p.x + p.nx * car.lineOff * 0.3, y: p.y, z: p.z + p.nz * car.lineOff * 0.3 }, Math.atan2(q.x - p.x, q.z - p.z)); car.nitro = Math.max(car.nitro, 0.2); }
function myInput() {
  const I = G.me.input, inp = K3.input, mv = inp.move;
  const gas = inp.key('KeyW') || inp.key('ArrowUp') || inp.down('gas'), brk = inp.key('KeyS') || inp.key('ArrowDown') || inp.down('brake');
  I.throttle = gas ? 1 : 0; I.brake = brk ? 1 : 0;
  const st = (inp.key('KeyD') || inp.key('ArrowRight') ? 1 : 0) - (inp.key('KeyA') || inp.key('ArrowLeft') ? 1 : 0);
  I.steer = K3.isTouch ? mv.x : st;
  I.handbrake = inp.down('hand'); I.nitro = inp.down('nitro'); I.up = inp.tap('up'); I.down = inp.tap('down');
  if (inp.tap('cam')) G.camMode = (G.camMode + 1) % 2;
  if (inp.tap('reset') && G.phase === 'live') resetCar(G.me);
}
function progress(car) {
  const tr = car.track, n = T.length, loc = locate(T, car.pos(), tr.idx), was = tr.idx;
  tr.idx = loc.i; tr.lat = loc.lat;
  if (tr.idx > n * 0.45 && tr.idx < n * 0.55) tr.half = true;
  if (was > n - 15 && tr.idx < 15 && tr.half) {   // crossed the line
    tr.half = false;
    if (tr.lapStart != null) { const lt = G.time - tr.lapStart; tr.laps.push(lt); if (car === G.me) { const best = G.best[G.cfg.car]; if (best == null || lt < best) { G.best[G.cfg.car] = lt; localStorage.setItem('rl_best', JSON.stringify(G.best)); pop('NEW BEST LAP ' + fmt(lt), '#ffd93a', 2); } else pop('LAP ' + fmt(lt), '#fff', 1.6); } }
    tr.lap++; tr.lapStart = G.time;
    if (tr.lap > G.laps && !tr.done) {
      tr.done = true; tr.total = tr.laps.reduce((a, b) => a + b, 0);
      if (!N) { G.finish.push(car); if (car === G.me) finishRace(); }
      else { if (N.isHost) hostFinished(car); else N.send({ k: 'fin', n: car.nid, tt: tr.total }, { to: N.hostId }); if (car === G.me) finishRace(); }
    }
  }
  tr.prog = tr.lap * n + (tr.lap === 0 && tr.idx < n / 2 ? tr.idx + n : tr.idx) - (tr.lap === 0 ? n : 0);
}
function finishRace() {
  G.race.done = true; G.phase = 'done'; G.doneT = 3.5;
  // online: my place is the host's call; until it answers, count the cars already home
  const place = N ? (G.finish.includes(G.me) ? G.finish.indexOf(G.me) : G.finish.length) + 1 : G.finish.indexOf(G.me) + 1;
  pop(G.mode === 'race' ? (place === 1 ? 'YOU WIN!' : `FINISHED P${place}`) : 'FINISHED', place === 1 ? '#3dffa0' : '#fff', 3);
  if (N) H('.rh-hint').textContent = 'waiting for the others to finish...';
}
function results(netOrder = null) {
  if (G.phase === 'over') return;
  G.phase = 'over'; K3.playing = false; K3.menuOpen = false; hud.style.display = 'none'; K3.setTouchButtons([]); G.cars.forEach((c) => c.sound?.stop());
  const byProg = G.cars.slice().sort((a, b) => b.track.prog - a.track.prog);
  const final = netOrder ? netOrder.map((nid) => G.cars.find((c) => c.nid === nid)).filter(Boolean) : G.finish.concat(byProg.filter((c) => !G.finish.includes(c)));
  const place = final.indexOf(G.me) + 1;
  const total = G.me.track.laps.reduce((a, b) => a + b, 0), best = Math.min(...G.me.track.laps);
  const race = G.mode === 'race', won = race ? place === 1 : true;
  const score = race ? (7 - place) * 150 + (won ? 500 : 0) : Math.max(0, Math.round(3000 - best * 20));
  if (!G.watch) window.XC?.end({ score, won: race ? won : null, stats: { won: won && race ? 1 : 0 } });
  const el = K3.shell.screen(`<div class="k3-title" style="font-size:46px">${G.watch ? 'RACE OVER' : race ? (won ? 'VICTORY' : 'P' + place) : 'TIME TRIAL'}</div>
    ${race ? `<div class="k3-sub">${final.map((c, i) => `<span style="color:${c === G.me && !G.watch ? '#ffd93a' : '#c8c0e8'}">P${i + 1} ${c.name}</span>`).join(' · ')}</div>` : ''}
    ${G.watch ? '' : `<div class="k3-sub">total ${fmt(total)} · best lap ${fmt(best)} · all-time best ${fmt(G.best[G.cfg.car])} · ${score} points</div>`}
    <div class="k3-row">${!N ? '<button class="k3-btn primary" data-a>RACE AGAIN</button><button class="k3-btn" data-m>GARAGE</button>' : N.isHost ? '<button class="k3-btn primary" data-lobby>BACK TO LOBBY</button><button class="k3-btn" data-leave>LEAVE</button>' : `<div class="k3-sub">waiting for <b>${N.name(N.hostId)}</b>...</div><button class="k3-btn" data-leave>LEAVE</button>`}</div>`);
  el.querySelector('[data-a]')?.addEventListener('click', () => start());
  el.querySelector('[data-m]')?.addEventListener('click', () => menu());
  el.querySelector('[data-lobby]')?.addEventListener('click', () => lobby.backToLobby());
  el.querySelector('[data-leave]')?.addEventListener('click', () => (window.XC ? XC.exit() : history.back()));
}

function update(dt) {
  if (G.phase === 'menu' || G.phase === 'over' || !G.me) return;
  if (!G.watch) myInput();
  if (G.phase === 'count') {
    const before = Math.ceil(G.countT); G.countT -= dt; const now = Math.ceil(G.countT);
    const lights = H('.rh-lights').children, lit = Math.min(5, Math.max(0, 5 - Math.ceil((G.countT - 0.6) / 0.72)));
    for (let k = 0; k < 5; k++) lights[k].className = G.countT <= 0 ? 'g' : k < lit ? 'r' : '';
    H('.rh-hint').textContent = G.countT > 0 ? 'hold GAS: keep the revs in the GREEN zone for a perfect launch' : '';
    if (now !== before && G.countT > 0.4) K3.audio.tone(440, 0.12, 'square', 0.05);
    if (G.countT <= 0) {
      G.phase = 'live'; G.race.countdown = false; K3.audio.tone(880, 0.3, 'square', 0.06);
      G.cars.forEach((c) => { if (c.ai) c.rpm = c.spec.redline * (0.62 + Math.random() * 0.2 * c.skill); c.launch(); });
      setTimeout(() => (H('.rh-lights').style.display = 'none'), 1200);
    }
  }
  if (G.phase === 'live' || G.phase === 'done') G.time += dt;
  if (N) { netTick(dt); softBumps(); }
  for (const c of G.cars) {
    if (c.remote) { followNet(c, dt); continue; }
    if (c.ai) { if (G.phase !== 'count') aiDrive(c, dt); else { c.input.throttle = 0.7 + Math.random() * 0.2; c.input.brake = 0; c.input.steer = 0; } }
    c.step(dt, { countdown: G.phase === 'count', done: c.track.done && c !== G.me ? false : c.track.done && c === G.me });
    if (G.phase !== 'count') progress(c);
    // fell off the track anyway (a big jump, a gap): straight back onto the road
    if (G.phase !== 'count' && c.pos().y < T[c.track.idx].y - 3) { resetCar(c); if (c === G.me) pop('BACK ON TRACK', '#ffd93a', 1); }
    // slipstream: right behind another car on a straight
    if (c === G.me && G.phase === 'live') {
      const f = c.forward(), p = c.pos();
      const draft = G.cars.some((o) => { if (o === c) return false; const q = o.pos(), dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz); return d > 3 && d < 22 && (dx * f.x + dz * f.z) / d > 0.97; });
      if (draft && c.speed > 25) { c.nitro = Math.min(1, c.nitro + dt * 0.08); c.drafting = (c.drafting || 0) + dt; if (c.drafting > 0.6 && !c.draftShown) { pop('SLIPSTREAM', '#22e6ff', 0.8); c.draftShown = true; } } else { c.drafting = 0; c.draftShown = false; }
    }
    // events from the car -> popups + sounds
    for (const e of c.events.splice(0)) {
      if (c !== G.me) { if (e === 'reset') resetCar(c); continue; }
      if (e === 'perfect') { pop('PERFECT SHIFT!', '#3dffa0', 0.9); K3.audio.tone(1320, 0.08, 'square', 0.04); }
      if (e === 'launch') pop('PERFECT LAUNCH!', '#3dffa0', 1.2);
      if (e === 'spin') pop('WHEELSPIN!', '#ff8a3a', 1);
      if (e === 'blowoff') c.sound?.blowoff();
      if (e === 'shift' || e === 'down') K3.audio.tone(e === 'shift' ? 180 : 140, 0.05, 'triangle', 0.03);
      if (e === 'reset') resetCar(c);
    }
  }
  if (G.watch && G.phase !== 'count') { const lead = G.cars.slice().sort((a, b) => b.track.prog - a.track.prog)[0]; if (lead && lead !== G.me) { G.me.sound?.stop(); G.me.sound = null; G.me = lead; } }
  if (G.phase === 'done' && !N) { G.doneT -= dt; if (G.doneT <= 0) results(); }
  if (N && N.isHost && (G.phase === 'live' || G.phase === 'done')) hostCheckEnd(dt);
  if (popT > 0) { popT -= dt; if (popT <= 0) H('.rh-pop').style.opacity = 0; }
}

const camPos = new V.Vector3(0, 10, -30);
function render(alpha, dt) {
  if (G.debugCam) { cam.position.set(...G.debugCam.pos); cam.setTarget(new V.Vector3(...G.debugCam.at)); for (const c of G.cars) c.render(alpha); return; }
  if (G.phase === 'menu' || !G.me) { const t = performance.now() / 14000, p = T[Math.floor((t * 300) % T.length)]; cam.position.set(p.x + 30, p.y + 14, p.z - 20); cam.setTarget(new V.Vector3(p.x, p.y, p.z)); return; }
  for (const c of G.cars) { c.render(alpha); c.flames.forEach((f) => { f.setEnabled(!!c.nitroOn); f.scaling.y = 0.8 + Math.random() * 0.6; }); c.sound?.update(c, c === G.me ? 1 : Math.max(0, 1 - Math.hypot(c.pos().x - G.me.pos().x, c.pos().z - G.me.pos().z) / 120) * 0.6); }
  // chase camera (springy, wider at speed / on nitro) or hood camera
  const car = G.me, n = car.node, fwd = rotate(car.rot(), { x: 0, y: 0, z: 1 }), sp = Math.abs(car.speed);
  if (G.camMode === 0) {
    const dist = 7.2 + sp * 0.03, want = new V.Vector3(n.position.x - fwd.x * dist, n.position.y + 2.6 + sp * 0.01, n.position.z - fwd.z * dist);
    camPos.addInPlace(want.subtract(camPos).scale(Math.min(1, dt * 7)));
    cam.position.copyFrom(camPos);
    cam.setTarget(new V.Vector3(n.position.x + fwd.x * 4, n.position.y + 1.1, n.position.z + fwd.z * 4));
  } else {
    cam.position.set(n.position.x + fwd.x * 0.6, n.position.y + 1.25, n.position.z + fwd.z * 0.6);
    cam.setTarget(new V.Vector3(n.position.x + fwd.x * 20, n.position.y + 1.0 + fwd.y * 20, n.position.z + fwd.z * 20));
  }
  const fov = 1.12 + Math.min(0.28, sp * 0.004) + (car.nitroOn ? 0.12 : 0);
  cam.fov += (fov - cam.fov) * Math.min(1, dt * 4);
  if (car.nitroOn || sp > 60) { cam.position.x += (Math.random() - 0.5) * 0.04; cam.position.y += (Math.random() - 0.5) * 0.04; }
  K3.listener = { x: cam.position.x, y: cam.position.y, z: cam.position.z, yaw: Math.atan2(fwd.x, fwd.z) };
  // HUD
  drawGauge(car); drawMap();
  const order = G.cars.slice().sort((a, b) => (G.finish.includes(b) ? 1e9 - G.finish.indexOf(b) : b.track.prog) - (G.finish.includes(a) ? 1e9 - G.finish.indexOf(a) : a.track.prog));
  const tr = car.track, lapT = tr.done ? null : tr.lapStart != null ? G.time - tr.lapStart : G.time;
  H('.rh-top').innerHTML = `${G.watch ? `<small>WATCHING ${car.name}</small>` : ''}LAP ${Math.min(G.laps, Math.max(1, tr.lap))}/${G.laps}<small>TIME ${fmt(lapT)}</small><small>BEST ${fmt(Math.min(...tr.laps, G.best[G.cfg.car] ?? Infinity) === Infinity ? null : Math.min(...tr.laps, G.best[G.cfg.car] ?? Infinity))}</small>`;
  H('.rh-pos').innerHTML = G.mode === 'race' ? `P${order.indexOf(car) + 1}<small>/${G.cars.length}</small>` : '';
}


// ================= ONLINE =================
const lobby = N && onlineLobby(K3, N, {
  title: 'REDLINE',
  sub: 'ONLINE RACE · AI rivals fill the grid up to the size you pick',
  hostOpts: [
    { key: 'size', label: 'CARS ON THE GRID', opts: [[2, '2'], [4, '4'], [6, '6']], ok: (v, n) => v >= n },
    { key: 'laps', label: 'LAPS', opts: [[2, '2'], [3, '3'], [5, '5']] },
    { key: 'diff', label: 'AI RIVALS', opts: [['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']] },
  ],
  myOpts: [
    { key: 'car', label: 'YOUR CAR', opts: Object.entries(CARS).map(([id, c]) => [id, c.name]) },
    { key: 'auto', label: 'YOUR GEARBOX', opts: [[true, 'AUTO'], [false, 'MANUAL']] },
  ],
  cfg: { size: 6, laps: 3, diff: G.cfg.diff },
  mine: { car: G.cfg.car, auto: G.cfg.auto },
  onMine: (m) => { Object.assign(G.cfg, m); localStorage.setItem('rl_cfg', JSON.stringify(G.cfg)); },
  onStart: (go) => start(go),
  onShow: () => { clearCars(); G.phase = 'menu'; hud.style.display = 'none'; },
});
if (N) netBadge(K3, N, { left: 14, top: 120 });
const r2 = (v) => Math.round(v * 100) / 100, r4 = (v) => Math.round(v * 10000) / 10000;
let sendAcc = 0;
// my car (+ the host's AI cars) -> everyone, 30 times a second
function netTick(dt) {
  sendAcc += dt; if (sendAcc < 1 / 30) return; sendAcc = 0;
  const mine = G.cars.filter((c) => !c.remote && !(G.watch && c === G.me && c.owner !== N.me));
  if (!mine.length) return;
  N.send({ k: 's', t: N.now(), c: mine.map((c) => { const p = c.pos(), q = c.rot(), v = c.body.linvel(), tr = c.track; return [c.nid, r2(p.x), r2(p.y), r2(p.z), r4(q.x), r4(q.y), r4(q.z), r4(q.w), r2(v.x), r2(v.y), r2(v.z), r2(c.speed), r2(c.steerA), Math.round(c.rpm), c.gear, c.nitroOn ? 1 : 0, r2(c.input.throttle), tr.lap, tr.prog, tr.done ? 1 : 0, r2(c.boost)]; }) }, { fast: true });
}
function followNet(c, dt) {
  const s = c.interp.sample(); if (!s) { c.prev = { p: c.pos(), q: c.rot() }; return; }
  const { a, b, k } = s, kk = Math.min(1.3, k);
  // dead reckoning: a car is drawn (and is solid) where it is NOW, not where it was ~0.1 s ago - or you would rear-end its ghost
  // (k > 1: the sample is already a guess past the last update - lean on it less)
  const ahead = Math.min(0.35, c.interp.lag() + (N.rtt(c.owner) ?? 0.1) / 2) * (kk <= 1 ? 1 : Math.max(0, (1.3 - kk) / 0.3));
  const p = { x: lerp(a[1], b[1], kk) + b[8] * ahead, y: lerp(a[2], b[2], kk) + b[9] * ahead * 0.5, z: lerp(a[3], b[3], kk) + b[10] * ahead };
  const q = V.Quaternion.Slerp(new V.Quaternion(a[4], a[5], a[6], a[7]), new V.Quaternion(b[4], b[5], b[6], b[7]), Math.min(1, kk));
  c.speed = b[11]; c.steerA = b[12]; c.rpm = b[13]; c.gear = b[14]; c.nitroOn = !!b[15]; c.input.throttle = b[16]; c.boost = b[20] || 0;
  c.follow(p, { x: q.x, y: q.y, z: q.z, w: q.w }, dt);
  const tr = c.track; tr.lap = b[17]; tr.prog = b[18]; tr.done = !!b[19];
}
// online car-to-car contact: my cars (and the host's AI) get pushed off cars that follow the network - a firm nudge, never a wall.
// The other driver's screen does the same for their car, so both cars bounce apart.
function softBumps() {
  const local = G.cars.filter((c) => !c.remote), remote = G.cars.filter((c) => c.remote);
  if (!local.length || !remote.length) return;
  for (const a of local) {
    const ca = a.bumpCircles(), va = a.body.linvel();
    for (const b of remote) {
      const pb = b.pos(), pa = a.pos(); if (Math.abs(pa.y - pb.y) > 2.5 || (pa.x - pb.x) ** 2 + (pa.z - pb.z) ** 2 > 64) continue;
      const cb = b.bumpCircles(), st = b.interp?.latest, vb = st ? { x: st[8], z: st[10] } : { x: 0, z: 0 };
      for (const p of ca) for (const q of cb) {
        const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz), min = p.r + q.r;
        if (d >= min || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d, closing = (va.x - vb.x) * nx + (va.z - vb.z) * nz;   // < 0 = driving into it
        const dv = Math.max(0, -closing) * 0.6 + (min - d) * 6;   // take away most of the closing speed + push out of the overlap
        const m = a.body.mass();
        a.body.applyImpulse({ x: nx * dv * m, y: 0, z: nz * dv * m }, true);
      }
    }
  }
}
// host: the finishing order, and when the race is over (every player home, or 30 s after the first player)
function hostFinished(car) {
  if (G.finish.includes(car)) return;
  G.finish.push(car);
  N.send({ k: 'fo', o: G.finish.map((c) => c.nid) });
}
function hostCheckEnd(dt) {
  const humans = G.cars.filter((c) => c.human && N.players.some((p) => p.id === c.nid));
  if (G.firstHumanT == null && humans.some((c) => c.track.done)) G.firstHumanT = G.time;
  // every player home (or every car): results 3.5 s later; or 30 s after the first player finished
  if (humans.every((c) => c.track.done) || G.cars.every((c) => c.track.done)) G.endT = (G.endT ?? 3.5) - dt;
  if ((G.endT != null && G.endT <= 0) || (G.firstHumanT != null && G.time - G.firstHumanT > 30)) {
    const rest = G.cars.filter((c) => !G.finish.includes(c)).sort((a, b) => b.track.prog - a.track.prog);
    const order = G.finish.concat(rest).map((c) => c.nid);
    N.send({ k: 'res', o: order });
    results(order);
  }
}
// a player left / the host changed: their car is now driven by the AI on the host
function reassign() {
  for (const c of G.cars) {
    if (N.players.some((p) => p.id === c.owner)) continue;
    c.owner = N.hostId;
    if (c.human && !N.players.some((p) => p.id === c.nid)) { c.human = false; c.ai = true; c.auto = true; c.name += ' (AI)'; }
    if (c.owner === N.me && c.remote) { const st = c.interp.latest; c.interp = null; c.setRemote(false, st ? { x: st[8], y: st[9], z: st[10] } : null); c.ai = c !== G.me; c.bestProg = c.track.prog; }
  }
}
if (N) {
  N.on((d, from) => {
    if (!d || !d.k || d.k[0] === 'L' || !G.cars.length) return;
    const C = (nid) => G.cars.find((c) => c.nid === nid);
    if (d.k === 's') { for (const st of d.c) { const c = C(st[0]); if (c && c.remote && c.owner === from) c.interp.push(st, d.t); } return; }
    if (d.k === 'fin') { const c = C(d.n); if (N.isHost && c && c.owner === from) { c.track.done = true; hostFinished(c); } return; }
    if (from !== N.hostId || N.isHost) return;
    if (d.k === 'fo') G.finish = d.o.map((nid) => C(nid)).filter(Boolean);
    if (d.k === 'res') results(d.o);
  });
  N.onLeave(() => { if (G.cars.length) { reassign(); pop('a player left', '#c8c0e8', 1.2); } });
  N.onHost(() => { if (G.cars.length) reassign(); });
}

K3.shell.loading(1);
K3.loop(update, render);
menu();
G.simulate = (n) => { for (let i = 0; i < n; i++) { update(1 / 60); K3.world.step(); } };
G.T = T;
const Q = new URLSearchParams(location.search);
if (Q.has('auto')) start();
