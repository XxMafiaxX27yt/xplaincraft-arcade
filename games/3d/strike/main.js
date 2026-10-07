// NOVEX STRIKE - the match: menus, rounds (first to 5), patches, Sudden Overcharge, shooting, effects, camera, HUD.
import { boot, V } from '../../kit3d/kit3d.js';
import { buildArena, buildRange, RANGE } from './arena.js';
import { WEAPONS, PRIMARIES, curW, spreadOf, tickArms, startReload, swapTo, tryFire, damageAt } from './weapons.js';
import { Fighter, TEAM_COL, rayHit, mulberry } from './fighter.js';
import { buildNav, Brain } from './bot.js';
import { Hud } from './hud.js';
import { net3d, Interp, lerp, lerpAngle } from '../../kit3d/net3d.js';
import { onlineLobby, netBadge } from '../../kit3d/online.js';

const ROUNDS_TO_WIN = 5, FREEZE = 3, OVERCHARGE_AT = 45, ZONE_END = 60;
const PATCHES = {
  lowGravity: ['LOW GRAVITY', 'everyone jumps higher and floats'],
  overclock: ['OVERCLOCK', 'every gun fires 25% faster'],
  tinyZone: ['TINY ZONE', 'the overcharge ring starts closing at 20 s'],
  headshotSurge: ['HEADSHOT SURGE', '+50% headshot bonus (not the marksman)'],
  hotHands: ['HOT HANDS', 'reload and swap 60% faster'],
  glassCannon: ['GLASS CANNON', '60 HP, every hit does 25% more'],
};
const SOUNDS = {};
for (const [k, n] of [['pistol', 3], ['smg', 3], ['marksman', 2], ['shotgun', 2], ['step', 5], ['wall', 3], ['flesh', 3]]) for (let i = 0; i < n; i++) SOUNDS[k + i] = `assets/strike/sfx/${k}${i}.mp3`;
for (const k of ['headshot', 'reload0', 'reload1', 'barrier', 'dash', 'shutter', 'zone']) SOUNDS[k] = `assets/strike/sfx/${k}.mp3`;

const K3 = await boot({
  title: 'NOVEX STRIKE',
  actions: { fire: ['Mouse0'], aim: ['Mouse2'], jump: ['Space'], crouch: ['ControlLeft', 'KeyC'], sprint: ['ShiftLeft'], reload: ['KeyR'], w1: ['Digit1'], w2: ['Digit2'], w3: ['Digit3'], swapLast: ['KeyQ'], ability: ['KeyE'], board: ['Tab'], cyclePrimary: ['KeyF'], hostile: ['KeyG'] },
});
const S = K3.scene;
// online (started from a party): every player moves their own fighter, the host runs the bots, the rounds and everyone's HP
const N = await net3d(window.XC?.net);
K3.online = !!N;
const G = { K3, mods: {}, fighters: [], brains: [], phase: 'menu', time: 0, score: [0, 0], round: 0, zone: null, barriers: [], fx: [], stats: new Map(), cfg: Object.assign({ mode: '1v1', diff: 'normal', primary: 'smg', ability: 'dash' }, JSON.parse(localStorage.getItem('strike_cfg') || '{}')) };
window.__S = G;
G.N = N;
const hostSide = () => !N || N.isHost;               // do I decide damage, rounds, bots?
const byNid = (nid) => G.fighters.find((f) => f.nid === nid);
// where a bot goes when it knows nothing: mostly toward the enemy half / centre, a new spot every few seconds
G.roamGoal = (f) => {
  if (!G.nav) return null;
  if (!f.roam || G.time > f.roamT || Math.hypot(f.feet().x - f.roam.x, f.feet().z - f.roam.z) < 2) {
    const nodes = G.nav.nodes, side = f.team === 0 ? 1 : -1;
    let n = nodes[0];
    for (let i = 0; i < 25; i++) { n = nodes[Math.floor(Math.random() * nodes.length)]; if (n.x * side > -3) break; }
    f.roam = { x: n.x, y: n.y, z: n.z }; f.roamT = G.time + 5 + Math.random() * 6;
  }
  return f.roam;
};

// ---------- scene ----------
const cam = new V.FreeCamera('cam', new V.Vector3(0, 2, -10), S);
cam.minZ = 0.03; cam.maxZ = 400; cam.fovMode = V.Camera ? V.Camera.FOVMODE_HORIZONTAL_FIXED : 1; cam.inertia = 0;
S.activeCamera = cam;
const hemi = new V.HemisphericLight('hemi', new V.Vector3(0.2, 1, -0.3), S); hemi.intensity = 0.95; hemi.groundColor = new V.Color3(0.18, 0.14, 0.3); hemi.diffuse = new V.Color3(0.82, 0.86, 1);
const sun = new V.DirectionalLight('sun', new V.Vector3(-0.45, -1, 0.35), S); sun.position = new V.Vector3(20, 40, -20); sun.intensity = 0.9; sun.diffuse = new V.Color3(1, 0.92, 0.86);
if (K3.quality === 'high') { const sg = new V.ShadowGenerator(2048, sun); sg.usePercentageCloserFiltering = true; sg.bias = 0.0008; sg.normalBias = 0.02; sg.darkness = 0.35; K3.shadow = sg; }
const glow = new V.GlowLayer('glow', S, { mainTextureRatio: K3.quality === 'low' ? 0.25 : 0.5, blurKernelSize: 32 }); glow.intensity = 0.75;
S.fogMode = 2; S.fogDensity = 0.008; S.fogColor = new V.Color3(0.05, 0.04, 0.1);
S.clearColor = new V.Color4(0.05, 0.04, 0.1, 1);
S.setRenderingAutoClearDepthStencil(1, true);   // the viewmodel draws over the world, never clips into walls

// ---------- maps ----------
K3.shell.loading(0.1);
const arena = buildArena(K3, G.cfg.mode === '2v2' ? '2v2' : '1v1');
const range = buildRange(K3);
K3.world.step();
const navs = {};
const navFor = (mode) => { if (!navs[mode]) { arena.setMode(mode); K3.world.step(); navs[mode] = buildNav(K3, arena.bounds); } return navs[mode]; };
K3.shell.loading(0.35);

// ---------- weapon models ----------
const gunSrc = {};
await Promise.all(['pistol', 'smg', 'shotgun', 'marksman'].map(async (id) => { try { gunSrc[id] = await K3.loadGLB(`assets/strike/weapons/${WEAPONS[id].model}.glb`); } catch (e) { console.warn('gun', id, e); } }));
K3.shell.loading(0.7);
const LEN = { pistol: 0.3, smg: 0.42, shotgun: 0.33, marksman: 0.72, knife: 0.3 };
const knifeMat = (() => { const m = new V.StandardMaterial('blade', S); m.emissiveColor = V.Color3.FromHexString('#22e6ff'); m.diffuseColor = new V.Color3(0.6, 0.9, 1); return m; })();
G.makeGun = (id, parent, view) => {
  let root;
  if (id === 'knife') {
    root = new V.TransformNode('knife', S);
    const h = V.CreateBox('kh', { width: 0.035, height: 0.04, depth: 0.12 }, S); h.position.z = -0.06; h.parent = root; h.material = G.darkMat || knifeMat;
    const b = V.CreateBox('kb', { width: 0.012, height: 0.05, depth: 0.22 }, S); b.position.z = 0.1; b.parent = root; b.material = knifeMat;
  } else {
    const src = gunSrc[id]; if (!src) return null;
    const inst = src.instantiateModelsToScene((n) => n, false, { doNotInstantiate: true });
    root = new V.TransformNode('gun-' + id, S); inst.rootNodes.forEach((n) => (n.parent = root));
    const sc = LEN[id] / ({ pistol: 0.8, smg: 0.91, shotgun: 0.55, marksman: 1.64 }[id]); root.scaling.setAll(sc);
  }
  root.parent = parent;
  root.getChildMeshes().forEach((m) => { m.isPickable = false; if (view) { m.renderingGroupId = 1; m.receiveShadows = false; } else if (K3.shadow) K3.shadow.addShadowCaster(m); });
  return root;
};
// first-person viewmodel: hangs off the camera
const vm = new V.TransformNode('vm', S); vm.parent = cam;
const vmGuns = {};
const vmShow = (id) => { for (const [k, g] of Object.entries(vmGuns)) g.setEnabled(k === id); if (!vmGuns[id]) vmGuns[id] = G.makeGun(id, vm, true); vmGuns[id]?.setEnabled(true); };
const flash = V.CreateSphere('flash', { diameter: 0.09, segments: 6 }, S); flash.parent = vm; flash.renderingGroupId = 1; flash.isPickable = false;
flash.material = (() => { const m = new V.StandardMaterial('flash', S); m.emissiveColor = new V.Color3(1, 0.85, 0.4); m.disableLighting = true; return m; })(); flash.setEnabled(false);

// ---------- effect pools: tracers, sparks, death pixels ----------
const unlit = (hex) => { const m = new V.StandardMaterial('fx' + hex, S); m.emissiveColor = V.Color3.FromHexString(hex); m.disableLighting = true; return m; };
const tracerSrc = V.CreateBox('tracer', { size: 1 }, S); tracerSrc.isVisible = false;
const tracers = Array.from({ length: 24 }, () => { const t = tracerSrc.clone('t'); t.isVisible = true; t.setEnabled(false); t.isPickable = false; return { m: t, life: 0 }; });
const sparkSrc = V.CreateBox('spark', { size: 0.05 }, S); sparkSrc.material = unlit('#ffe08a'); sparkSrc.isVisible = false;
const sparks = Array.from({ length: 60 }, () => { const m = sparkSrc.createInstance('s'); m.setEnabled(false); m.isPickable = false; return { m, life: 0, v: { x: 0, y: 0, z: 0 } }; });
const pixSrc = [0, 1].map((t) => { const b = V.CreateBox('pix' + t, { size: 0.09 }, S); b.material = unlit(TEAM_COL[t]); b.isVisible = false; return b; });
const pixels = [0, 1].map((t) => Array.from({ length: 50 }, () => { const m = pixSrc[t].createInstance('p'); m.setEnabled(false); m.isPickable = false; return { m, life: 0, v: { x: 0, y: 0, z: 0 } }; }));
const tracerMats = {};
function tracer(from, to, col) {
  const t = tracers.find((x) => x.life <= 0) || tracers[0];
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, L = Math.hypot(dx, dy, dz);
  t.m.material = tracerMats[col] || (tracerMats[col] = unlit(col));
  t.m.position.set(from.x + dx / 2, from.y + dy / 2, from.z + dz / 2); t.m.scaling.set(0.018, 0.018, L);
  t.m.lookAt(new V.Vector3(to.x, to.y, to.z)); t.m.setEnabled(true); t.life = 0.06;
}
function spark(p, n = 6, col = null) { for (let i = 0; i < n; i++) { const s = sparks.find((x) => x.life <= 0); if (!s) return; s.m.position.set(p.x, p.y, p.z); s.v = { x: (Math.random() - 0.5) * 5, y: Math.random() * 4, z: (Math.random() - 0.5) * 5 }; s.life = 0.25 + Math.random() * 0.15; s.m.setEnabled(true); } }
function dissolve(f) {
  // the neon-pixel death: the body bursts into team-coloured pixels and is gone in ~150 ms
  const p = f.feet(), pool = pixels[f.team];
  for (const s of pool) { s.m.position.set(p.x + (Math.random() - 0.5) * 0.5, p.y + Math.random() * 1.7, p.z + (Math.random() - 0.5) * 0.5); s.v = { x: (Math.random() - 0.5) * 4, y: 1 + Math.random() * 3.5, z: (Math.random() - 0.5) * 4 }; s.life = 0.5 + Math.random() * 0.4; s.m.scaling.setAll(1); s.m.setEnabled(true); }
  if (f.body) setTimeout(() => f.body.root.setEnabled(false), 140);
}
function stepFx(dt) {
  for (const t of tracers) if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.m.setEnabled(false); }
  for (const s of sparks) if (s.life > 0) { s.life -= dt; s.v.y -= 12 * dt; s.m.position.x += s.v.x * dt; s.m.position.y += s.v.y * dt; s.m.position.z += s.v.z * dt; if (s.life <= 0) s.m.setEnabled(false); }
  for (const pool of pixels) for (const s of pool) if (s.life > 0) { s.life -= dt; s.v.y -= 6 * dt; s.m.position.x += s.v.x * dt; s.m.position.y += s.v.y * dt; s.m.position.z += s.v.z * dt; s.m.scaling.setAll(Math.max(0.05, s.life * 1.6)); if (s.life <= 0) s.m.setEnabled(false); }
}

// ---------- sounds ----------
K3.audio.load(SOUNDS).catch(() => {});
G.sound = (kind, f) => {
  const at = f ? f.feet() : null, mine = f === G.me, A = K3.audio;
  if (kind === 'step') { const surf = arena.surfaceOf(K3.phys.ray({ x: at.x, y: at.y + 0.3, z: at.z }, { x: 0, y: -1, z: 0 }, 1)?.collider); const v = surf === 'metal' ? 0.9 : surf === 'rubber' ? 0.12 : 0.45; A.play('step' + Math.floor(Math.random() * 5), { vol: v * (mine ? 0.5 : 1), rate: surf === 'metal' ? 1.25 : 1, at: mine ? null : at }); if (!mine && v > 0.3) G.brains.forEach((b) => b.f !== f && Math.hypot(b.f.feet().x - at.x, b.f.feet().z - at.z) < (surf === 'metal' ? 18 : 10) && b.hear(at, f)); }
  if (kind === 'jump' || kind === 'land') A.play('step' + Math.floor(Math.random() * 5), { vol: 0.5, rate: 0.8, at: mine ? null : at });
  if (kind === 'dash') A.play('dash', { vol: 0.7, at: mine ? null : at });
  if (kind === 'slide') A.play('step2', { vol: 0.4, rate: 0.6, at: mine ? null : at });
};

// ---------- HUD ----------
const hud = new Hud(K3); hud.show(false);
K3.setTouchButtons([]);
const touchLayout = () => K3.setTouchButtons([
  { a: 'fire', label: 'FIRE', right: 26, bottom: 120, size: 86, big: true, lookToo: true },
  { a: 'aim', label: 'AIM', right: 128, bottom: 186, size: 58, toggle: true },
  { a: 'jump', label: 'JUMP', right: 130, bottom: 40, size: 62 },
  { a: 'crouch', label: 'CROUCH', right: 26, bottom: 24, size: 62 },
  { a: 'reload', label: 'R', right: 210, bottom: 120, size: 50 },
  { a: 'swapLast', label: 'SWAP', right: 200, bottom: 50, size: 50 },
  { a: 'ability', label: 'ABILITY', right: 26, bottom: 226, size: 58 },
  { a: 'sprint', label: 'RUN', right: 210, bottom: 190, size: 50, toggle: true },
]);

// ---------- menus ----------
const btns = (key, opts) => opts.map(([v, label]) => `<button class="k3-btn ${G.cfg[key] === v ? 'sel' : ''}" data-k="${key}" data-v="${v}">${label}</button>`).join('');
function menu() {
  G.phase = 'menu'; K3.playing = false; hud.show(false); K3.setTouchButtons([]); document.exitPointerLock?.();
  if (N) { clearFighters(); return lobby.show(); }
  const el = K3.shell.screen(`
    <div class="k3-title">NOVEX STRIKE</div>
    <div class="k3-sub">Fast arena shooter. First to 5 rounds. The loser of each round picks a PATCH that changes the next one.</div>
    <div class="k3-label">MODE</div><div class="k3-row">${btns('mode', [['1v1', '1v1 vs BOT'], ['2v2', '2v2 (you + bot)'], ['range', 'TRAINING RANGE']])}</div>
    <div class="k3-label">BOTS</div><div class="k3-row">${btns('diff', [['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']])}</div>
    <div class="k3-label">PRIMARY · always with a pistol + knife</div><div class="k3-row">${btns('primary', [['smg', 'SMG'], ['shotgun', 'SHOTGUN'], ['marksman', 'MARKSMAN']])}</div>
    <div class="k3-label">ABILITY</div><div class="k3-row">${btns('ability', [['dash', 'DASH · 5.5 m'], ['barrier', 'BARRIER · 100 HP wall']])}</div>
    <div class="k3-row" style="margin-top:8px"><button class="k3-btn primary" data-play style="min-width:220px;font-size:18px">▶ PLAY</button><button class="k3-btn" data-set>SETTINGS</button></div>
    <div class="k3-sub" style="font-size:13px">${K3.isTouch ? 'left side: move · right side: look · FIRE also aims while you hold it' : 'WASD move · mouse look · click shoot · right click aim/scope · SPACE jump · CTRL crouch (slide while running) · SHIFT sprint · R reload · 1 2 3 / Q weapons · E ability · TAB scores'}</div>`);
  el.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { G.cfg[b.dataset.k] = b.dataset.v; localStorage.setItem('strike_cfg', JSON.stringify(G.cfg)); K3.audio.unlock(); menu(); }));
  el.querySelector('[data-set]').onclick = () => K3.shell.settings(menu);
  el.querySelector('[data-play]').onclick = () => { K3.audio.unlock(); G.cfg.mode === 'range' ? startRange() : startMatch(); };
}
K3.onSettings = () => {};

// ---------- match ----------
function clearFighters() { G.fighters.forEach((f) => { f.ch.destroy(); f.body?.root.dispose(); }); if (G.me?.ghost) G.me.ch.destroy(); G.me = null; G.fighters = []; G.brains = []; G.barriers.forEach((b) => removeBarrier(b)); G.barriers = []; }
function startMatch() {
  clearFighters();
  const mode = G.cfg.mode, n = mode === '2v2' ? 2 : 1;
  G.nav = navFor(mode); arena.setMode(mode);
  G.mode = mode; G.score = [0, 0]; G.round = 0; G.mods = {}; G.patchName = ''; G.stats = new Map();
  const names = ['VEX', 'NOVA', 'BYTE', 'GLITCH', 'RIFT', 'ZERO'], prims = () => PRIMARIES[Math.floor(Math.random() * 3)];
  G.me = new Fighter(G, { team: 0, name: (K3.xc?.player?.callsign || 'YOU'), primary: G.cfg.primary, ability: G.cfg.ability, me: true, spawn: arena.spawns[0][0], seed: 7 });
  G.fighters.push(G.me);
  for (let t = 0; t < 2; t++) for (let i = 0; i < n; i++) {
    if (t === 0 && i === 0) continue;
    const f = new Fighter(G, { team: t, name: names[(t * 2 + i) % names.length], primary: prims(), ability: Math.random() < 0.5 ? 'dash' : 'barrier', bot: true, spawn: arena.spawns[t][i], seed: 100 + t * 10 + i });
    G.fighters.push(f); G.brains.push(new Brain(G, f, G.cfg.diff));
  }
  G.fighters.forEach((f) => G.stats.set(f, { k: 0, d: 0, dmg: 0 }));
  K3.shell.screen(''); hud.show(true); hud.range(null); touchLayout();
  K3.playing = true; K3.paused = false;
  if (!K3.isTouch && !K3.test) K3.canvas.requestPointerLock?.();
  K3.canvas.focus();
  window.XC?.start();
  startRound();
}
function startRound(net = null) {
  if (net) { G.round = net.round; G.score = net.score; G.mods = net.mods; G.patchName = net.patch; } else G.round++;
  if (N && !net) N.send({ k: 'rd', round: G.round, score: G.score, mods: G.mods, patch: G.patchName });
  if (N) K3.shell.screen('');
  G.barriers.forEach((b) => removeBarrier(b)); G.barriers = [];
  G.fighters.forEach((f) => { if (f.ghost) return; const sp = arena.spawns[f.team][G.fighters.filter((x) => x.team === f.team && !x.ghost).indexOf(f)]; f.ch.collider.setEnabled(true); f.reset(sp); f.zoneAcc = 0; if (f.interp) f.interp.clear(); });
  G.brains.forEach((b) => { b.mem.clear(); b.path = null; b.target = null; b.goal = null; });
  G.phase = 'freeze'; G.phaseT = FREEZE; G.roundT = 0; G.zone = null; G.overWarned = false;
  hud.msg(`ROUND ${G.round}`, G.patchName ? `PATCH: ${G.patchName}` : 'get ready', FREEZE - 0.3, '#fff');
  hud.patch(G.patchName ? 'PATCH · ' + G.patchName : '');
}
function endRound(winner, net = null) {
  if (G.phase !== 'live' && !net) return;
  G.phase = 'end'; G.phaseT = 2.6;
  if (net) G.score = net.score; else if (winner >= 0) G.score[winner]++;
  if (N && !net) N.send({ k: 're', w: winner, score: G.score });
  const mine = winner === G.me.team;
  hud.msg(winner < 0 ? 'DRAW' : mine ? 'ROUND WON' : 'ROUND LOST', `${G.score[G.me.team]} - ${G.score[1 - G.me.team]}`, 2.4, winner < 0 ? '#ffd93a' : mine ? '#3dffa0' : '#ff3355');
  G.lastLoser = winner < 0 ? -1 : 1 - winner;
}
function afterRound() {
  if (G.score[0] >= ROUNDS_TO_WIN || G.score[1] >= ROUNDS_TO_WIN) { if (N) N.send({ k: 'mo', score: G.score }); return matchOver(); }
  const keys = Object.keys(PATCHES).sort(() => Math.random() - 0.5).slice(0, 3);
  if (N) {
    // online: the first player (not a bot) on the losing team picks; an all-bot team -> the host picks for it
    const picker = G.lastLoser >= 0 ? G.fighters.find((f) => f.team === G.lastLoser && f.human && N.players.some((p) => p.id === f.nid)) : null;
    if (!picker) { G.phase = 'patch'; return applyPatch(G.lastLoser >= 0 ? keys[0] : null, true); }
    N.send({ k: 'pp', keys, who: picker.nid });
    return patchPhase(keys, picker.nid);
  }
  if (G.lastLoser === G.me.team) {
    // you lost the round: pick the patch
    G.phase = 'patch'; G.phaseT = 8; document.exitPointerLock?.();
    const el = K3.shell.screen(`<div class="k3-title" style="font-size:34px">PICK A PATCH</div><div class="k3-sub">you lost the round - choose how the next one plays</div>
      <div class="k3-row">${keys.map((k) => `<button class="k3-btn" data-p="${k}" style="max-width:240px">${PATCHES[k][0]}<br><small style="font-family:Rajdhani;letter-spacing:0;font-weight:600;color:#c8c0e8">${PATCHES[k][1]}</small></button>`).join('')}</div>`);
    el.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => applyPatch(b.dataset.p)));
    G.patchKeys = keys;
  } else {
    applyPatch(G.lastLoser >= 0 ? keys[0] : null, true);
  }
}
// online: someone is picking the next patch (me -> the picker screen; everyone else waits)
function patchPhase(keys, who) {
  G.phase = 'patch'; G.phaseT = 9; G.patchKeys = keys;
  if (who !== N.me) { hud.msg('PATCH', `${N.name(who)} is picking the next patch`, 8.5); return; }
  document.exitPointerLock?.();
  const el = K3.shell.screen(`<div class="k3-title" style="font-size:34px">PICK A PATCH</div><div class="k3-sub">your team lost the round - choose how the next one plays</div>
    <div class="k3-row">${keys.map((k) => `<button class="k3-btn" data-p="${k}" style="max-width:240px">${PATCHES[k][0]}<br><small style="font-family:Rajdhani;letter-spacing:0;font-weight:600;color:#c8c0e8">${PATCHES[k][1]}</small></button>`).join('')}</div>`);
  el.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { K3.shell.screen(''); if (!K3.isTouch && !K3.test) K3.canvas.requestPointerLock?.(); if (N.isHost) applyPatch(b.dataset.p); else N.send({ k: 'pk', key: b.dataset.p }, { to: N.hostId }); }));
}
function applyPatch(k, byBot) {
  if (N && G.phase !== 'patch') return;
  G.mods = k ? { [k]: true } : {}; G.patchName = k ? PATCHES[k][0] : '';
  K3.shell.screen('');
  if (!K3.isTouch && !K3.test) K3.canvas.requestPointerLock?.();
  startRound();
  if (k && byBot) hud.msg(`ROUND ${G.round}`, `they picked: ${PATCHES[k][0]}`, FREEZE - 0.3);
}
function matchOver() {
  G.phase = 'over'; K3.playing = false; K3.menuOpen = false; document.exitPointerLock?.(); hud.show(false); K3.setTouchButtons([]);
  const myT = G.me.team, won = G.score[myT] > G.score[1 - myT], st = G.stats.get(G.me) || { k: 0, d: 0, dmg: 0 };
  const score = G.score[myT] * 100 + st.k * 25 + (won ? 500 : 0);
  if (!G.spectator) window.XC?.end({ score, won, stats: { won: won ? 1 : 0, kills: st.k } });
  const rows = N ? `<div class="k3-sub">${G.fighters.filter((f) => !f.ghost).map((f) => `<span style="color:${TEAM_COL[f.team]}">${f === G.me ? 'YOU' : f.name}</span> ${(G.stats.get(f) || {}).k || 0}/${(G.stats.get(f) || {}).d || 0}`).join(' · ')}</div>` : '';
  const el = K3.shell.screen(`<div class="k3-title" style="font-size:52px;${won ? '' : 'background:linear-gradient(90deg,#ff3355,#ff8a3a);-webkit-background-clip:text;background-clip:text'}">${G.spectator ? 'MATCH OVER' : won ? 'VICTORY' : 'DEFEAT'}</div>
    <div class="k3-sub" style="font-size:22px">${G.score[myT]} - ${G.score[1 - myT]}</div>
    <div class="k3-sub">${st.k} eliminations · ${st.d} deaths · ${Math.round(st.dmg)} damage · ${score} points</div>${rows}
    <div class="k3-row">${!N ? '<button class="k3-btn primary" data-again>PLAY AGAIN</button><button class="k3-btn" data-menu>MENU</button>' : N.isHost ? '<button class="k3-btn primary" data-lobby>BACK TO LOBBY</button><button class="k3-btn" data-leave>LEAVE</button>' : `<div class="k3-sub">waiting for <b>${N.name(N.hostId)}</b>...</div><button class="k3-btn" data-leave>LEAVE</button>`}</div>`);
  el.querySelector('[data-again]')?.addEventListener('click', () => startMatch());
  el.querySelector('[data-menu]')?.addEventListener('click', () => { clearFighters(); menu(); });
  el.querySelector('[data-lobby]')?.addEventListener('click', () => { clearFighters(); lobby.backToLobby(); });
  el.querySelector('[data-leave]')?.addEventListener('click', () => (window.XC ? XC.exit() : history.back()));
}

// ---------- training range ----------
function startRange() {
  clearFighters();
  G.mode = 'range'; G.mods = {}; G.patchName = ''; G.stats = new Map(); G.nav = null;
  G.me = new Fighter(G, { team: 0, name: 'YOU', primary: G.cfg.primary, ability: G.cfg.ability, me: true, spawn: range.spawn, seed: 3 });
  G.fighters.push(G.me);
  G.dummies = [];
  for (const [d, x] of [[5, -3], [10, 3], [20, -2], [30, 4], [45, 0]]) G.dummies.push(new Fighter(G, { team: 1, name: d + 'm', dummy: true, spawn: { x: RANGE.x + x, z: RANGE.z0 + d, yaw: Math.PI }, seed: d }));
  const mover = new Fighter(G, { team: 1, name: 'MOVER', dummy: true, spawn: { x: RANGE.x, z: RANGE.z0 + 15, yaw: Math.PI }, seed: 99 }); mover.mover = true; G.dummies.push(mover);
  G.dummies.forEach((f) => { G.fighters.push(f); f.home = f.feet(); });
  G.fighters.forEach((f) => G.stats.set(f, { k: 0, d: 0, dmg: 0 }));
  G.rangeStats = { shots: 0, hits: 0, last: '-', ttk: '-', dmg: 0, first: null };
  K3.shell.screen(''); hud.show(true); touchLayout();
  hud.score('', '', 'RANGE'); hud.patch('');
  K3.playing = true; K3.paused = false; if (!K3.isTouch && !K3.test) K3.canvas.requestPointerLock?.(); K3.canvas.focus();
  G.phase = 'live'; G.roundT = 0; G.zone = null;
}
function rangeTick(dt) {
  for (const f of G.dummies) {
    if (!f.alive) { f.respawnT = (f.respawnT ?? 1.2) - dt; if (f.respawnT <= 0) { f.respawnT = null; f.ch.collider.setEnabled(true); f.reset({ ...f.home, yaw: Math.PI }); } continue; }
    f.yaw = Math.PI; f.input.move = { x: 0, y: 0 };
    if (f.mover) { f.t = (f.t || 0) + dt; f.input.move = { x: Math.sin(f.t * 1.3) > 0 ? 1 : -1, y: 0 }; }
    if (f.hostile && G.me.alive) { const b = f.brain || (f.brain = new Brain(G, f, 'easy')); b.tick(dt); f.input.move.y = 0; }
  }
  const R = G.rangeStats, W = curW(G.me.arms);
  hud.range(`<b style="color:#22e6ff;letter-spacing:2px">TRAINING RANGE</b><br>weapon: <b>${W.name}</b> · F = next primary<br>accuracy: ${R.shots ? Math.round((100 * R.hits) / R.shots) : 0}% (${R.hits}/${R.shots})<br>last hit: ${R.last}<br>time to kill: ${R.ttk}<br>G = mover ${G.dummies.find((d) => d.mover)?.hostile ? 'shoots back ✓' : 'shoots back ✗'}`);
}

// ---------- barriers ----------
let barN = 0;
G.placeBarrier = (f, net = null) => {
  const fwd = { x: Math.sin(f.yaw), z: Math.cos(f.yaw) }, p = f.feet(), c = net ? net.c : { x: p.x + fwd.x * 1.7, y: p.y + 1, z: p.z + fwd.z * 1.7 }, yaw = net ? net.yaw : f.yaw;
  const q = V.Quaternion.FromEulerAngles(0, yaw, 0), rot = { x: q.x, y: q.y, z: q.z, w: q.w };
  // never inside walls or other barriers, so it cannot seal a doorway shut
  const hit = !net && K3.world.intersectionWithShape(c, rot, new K3.R.Cuboid(1.2, 1, 0.12), undefined, K3.phys.groups(0xffff, K3.phys.G_WORLD | K3.phys.G_CHAR), f.ch.collider);
  if (hit) { if (f === G.me) hud.msg('', 'no room for a barrier there', 0.8); return false; }
  const id = net ? net.id : `${f.nid || 'x'}:${++barN}`;
  if (N && !net) N.send({ k: 'bar', id, n: f.nid, c, yaw });
  const col = K3.phys.box(c.x, c.y, c.z, 1.2, 1, 0.12, rot, { surface: 'barrier' });
  const m = V.CreateBox('barrier', { width: 2.4, height: 2, depth: 0.24 }, S); m.position.set(c.x, c.y, c.z); m.rotation.y = yaw;
  const mat = new V.StandardMaterial('bar', S); mat.emissiveColor = V.Color3.FromHexString(TEAM_COL[f.team]); mat.alpha = 0.35; mat.disableLighting = true; m.material = mat; m.isPickable = false;
  const b = { id, col, m, hp: 100, t: 4.5, team: f.team }; G.barriers.push(b);
  K3.audio.play('barrier', { vol: 0.6, at: c });
  return true;
};
function removeBarrier(b) { if (b.dead) return; b.dead = true; K3.phys.remove(b.col); b.m.dispose(); }
G.barrierCollider = () => undefined;

// ---------- shooting ----------
function fire(f, shot) {
  const W = WEAPONS[shot.weapon], eye = f.eye();
  const muzzle = f === G.me ? vmMuzzle() : { x: eye.x + Math.sin(f.yaw) * 0.6, y: eye.y - 0.25, z: eye.z + Math.cos(f.yaw) * 0.6 };
  if (shot.melee) return melee(f);
  K3.audio.play(W.snd + Math.floor(Math.random() * (W.snd === 'marksman' || W.snd === 'shotgun' ? 2 : 3)), { vol: f === G.me ? 0.55 : 0.9, rate: 0.95 + Math.random() * 0.1, at: f === G.me ? null : eye });
  G.brains.forEach((b) => b.f !== f && Math.hypot(b.f.feet().x - eye.x, b.f.feet().z - eye.z) < 28 && b.hear(f.feet(), f));
  if (f === G.me) { G.kick = (G.kick || 0) + W.kick; G.flashT = 0.04; if (G.mode === 'range') G.rangeStats.shots++; }
  const range = W.range || 150;
  let anyHit = false, head = false, killed = false;
  const claims = [], bars = [], ends = [];
  for (const dir of shot.pellets) {
    const wh = K3.phys.ray(eye, dir, range);
    const maxT = wh ? wh.dist : range;
    let best = null;
    for (const e of G.fighters) { if (e === f || !e.alive || e.team === f.team) continue; const h = rayHit(eye, dir, e.hitboxes(), maxT); if (h && (!best || h.t < best.t)) best = { ...h, e }; }
    const t = best ? best.t : maxT, end = { x: eye.x + dir.x * t, y: eye.y + dir.y * t, z: eye.z + dir.z * t };
    if (shot.pellets.length === 1 || Math.random() < 0.4) { tracer(muzzle, end, W.tracer); if (ends.length < 4) ends.push([+end.x.toFixed(2), +end.y.toFixed(2), +end.z.toFixed(2)]); }
    if (best) {
      const dmg = damageAt(shot.weapon, best.t, best.head, G.mods);
      const r = dealHit(best.e, dmg, f, best.head, shot.weapon, claims);
      anyHit = true; head = head || best.head; killed = killed || r;
      spark(end, 4);
    } else if (wh) {
      const bar = G.barriers.find((b) => b.col === wh.collider);
      if (bar) { const bd = damageAt(shot.weapon, t, false, G.mods); if (hostSide()) hitBarrier(bar, bd); else bars.push([bar.id, +bd.toFixed(1)]); }
      spark(end, 3);
      if (Math.random() < 0.3) K3.audio.play('wall' + Math.floor(Math.random() * 3), { vol: 0.25, at: end });
    }
  }
  if (f === G.me && anyHit) { hud.hit(head, killed); K3.audio.play(head ? 'headshot' : 'flesh' + Math.floor(Math.random() * 3), { vol: head ? 0.35 : 0.5 }); if (G.mode === 'range') G.rangeStats.hits++; }
  if (N) N.send({ k: 'sh', n: f.nid, w: shot.weapon, e: [+eye.x.toFixed(2), +eye.y.toFixed(2), +eye.z.toFixed(2)], m: [+muzzle.x.toFixed(2), +muzzle.y.toFixed(2), +muzzle.z.toFixed(2)], ends, hits: claims, bars });
}
// a hit: solo / host -> real damage now; online client -> a claim the host checks (returns "probably a kill" for the hit marker)
function dealHit(e, dmg, by, head, weapon, claims) {
  if (hostSide()) return hurt(e, dmg, by, head, weapon);
  claims.push([e.nid, +dmg.toFixed(1), head ? 1 : 0]);
  return e.hp - dmg <= 0;
}
function hitBarrier(bar, dmg) {
  bar.hp -= dmg;
  if (bar.hp <= 0) { removeBarrier(bar); if (N) N.send({ k: 'barx', id: bar.id }); }
}
function melee(f) {
  const eye = f.eye(), fwd = { x: Math.sin(f.yaw), z: Math.cos(f.yaw) };
  let best = null, bd = 99;
  for (const e of G.fighters) {
    if (e === f || !e.alive || e.team === f.team) continue;
    const p = e.feet(), dx = p.x - eye.x, dz = p.z - eye.z, d = Math.hypot(dx, dz);
    const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fwd.x + dz * fwd.z) / (d || 1))));
    if (d < WEAPONS.knife.lunge && ang < 0.45 && d < bd && Math.abs(p.y - f.feet().y) < 1.2) { best = e; bd = d; }
  }
  K3.audio.tone(320, 0.06, 'triangle', 0.04, -200);
  if (f === G.me) G.slashT = 0.22;
  if (!best) return;
  const stab = () => { const claims = [], k = dealHit(best, 55 * (G.mods.glassCannon ? 1.25 : 1), f, false, 'knife', claims); if (N && claims.length) N.send({ k: 'sh', n: f.nid, w: 'knife', melee: 1, hits: claims, ends: [], bars: [] }); if (f === G.me) hud.hit(false, k); };
  if (bd > WEAPONS.knife.range) { f.dashDir = { x: (best.feet().x - eye.x) / bd, z: (best.feet().z - eye.z) / bd }; f.dashT = Math.min(0.12, (bd - 1.4) / 30); return setTimeout(() => best.alive && f.alive && Math.hypot(best.feet().x - f.feet().x, best.feet().z - f.feet().z) < WEAPONS.knife.range + 0.4 && stab(), 130); }
  stab();
}
function hurt(e, dmg, by, head, weapon) {
  if (!e.alive) return false;
  const was = e.hp;
  applyHp(e, e.hp - dmg, by, Math.min(dmg, was), head);
  if (N) N.send({ k: 'hp', n: e.nid, hp: +e.hp.toFixed(1), by: by.nid, d: +Math.min(dmg, was).toFixed(1), h: head ? 1 : 0 });
  if (e.hp <= 0) { kill(e, by, head, weapon); if (N) N.send({ k: 'die', n: e.nid, by: by.nid, h: head ? 1 : 0, w: weapon }); return true; }
  return false;
}
// HP changes (the host's own hits, or the host's word over the network)
function applyHp(e, hp, by, dmg, head) {
  e.hp = Math.max(0, hp); e.lastHitBy = by;
  const sb = G.stats.get(by); if (sb && by !== e) sb.dmg += dmg;
  if (G.mode === 'range' && by === G.me) { const R = G.rangeStats; if (e.hp + dmg >= e.maxHp) R.first = G.time; R.last = `${Math.round(dmg)}${head ? ' HEAD' : ''} @ ${Math.round(Math.hypot(e.feet().x - by.feet().x, e.feet().z - by.feet().z))} m`; }
  if (e === G.me && by !== e) { const p = by.feet(), m = e.feet(); hud.damageFrom(Math.atan2(p.x - m.x, p.z - m.z) - G.me.yaw); G.hurtShake = 0.15; }
  // bots react to being hit
  const br = G.brains.find((b) => b.f === e); if (br) br.hear(by.feet(), by);
}
function kill(e, by, head, weapon) {
  if (!e.alive) return;
  e.alive = false; e.hp = 0; e.ch.collider.setEnabled(false); dissolve(e);
  const se = G.stats.get(e), sb = G.stats.get(by); if (se) se.d++; if (sb && by !== e) sb.k++;
  if (G.mode === 'range' && by === G.me) G.rangeStats.ttk = G.rangeStats.first != null ? `${((G.time - G.rangeStats.first) * 1000).toFixed(0)} ms` : '-';
  if (G.mode === '2v2' || (N && G.mode !== 'range')) hud.feed(`<span style="color:${TEAM_COL[by.team]}">${by === G.me ? 'YOU' : by.name}</span> [${WEAPONS[weapon]?.name || (weapon === 'zone' ? 'RING' : '')}] <span style="color:${TEAM_COL[e.team]}">${e === G.me ? 'YOU' : e.name}</span>${head ? ' ◎' : ''}`);
}

// ---------- player input ----------
let lastWeapon = 1;
function playerInput(dt) {
  const f = G.me, I = f.input, inp = K3.input;
  const W = curW(f.arms);
  // look: scoped = slower (sensitivity follows the zoom); phones get aim friction near enemies
  const zoomF = 1 - f.arms.zoom * (1 - (W.zoom || 1));
  K3.lookScale = zoomF;
  let lk = inp.look();
  if (K3.isTouch && aimOnEnemy(0.09)) { lk.x *= 0.55; lk.y *= 0.55; }
  if (G.phase !== 'menu' && G.phase !== 'over' && f.alive) { f.yaw += lk.x; f.pitch = Math.max(-1.45, Math.min(1.45, f.pitch + lk.y)); }
  const frozen = G.phase === 'freeze' || G.phase === 'end' || G.phase === 'patch';
  I.move = frozen ? { x: 0, y: 0 } : inp.move;
  I.jump = !frozen && inp.tap('jump'); I.crouch = inp.down('crouch'); I.sprint = inp.down('sprint');
  let fire = inp.down('fire'), tapF = inp.tap('fire');
  if (K3.isTouch && K3.settings.autoFire && aimOnEnemy(0.035)) { fire = true; tapF = f.arms.cool <= 0 && f.arms.sinceShot > 0.27; }
  I.fire = !frozen && fire; I.fireTap = !frozen && tapF;
  I.aim = inp.down('aim'); I.reload = inp.tap('reload'); I.ability = !frozen && inp.tap('ability');
  I.swap = inp.tap('w1') ? 0 : inp.tap('w2') ? 1 : inp.tap('w3') ? 2 : inp.tap('swapLast') ? (f.arms.cur === 0 ? 1 : 0) : -1;
  if (G.mode === 'range' && inp.tap('cyclePrimary')) { const i = (PRIMARIES.indexOf(f.primary) + 1) % 3; f.primary = PRIMARIES[i]; G.cfg.primary = f.primary; const hp = f.hp; f.arms.list[0] = f.primary; f.arms.ammo[f.primary] = WEAPONS[f.primary].mag; swapTo(f, 1, G.mods); swapTo(f, 0, G.mods); f.hp = hp; }
  if (G.mode === 'range' && inp.tap('hostile')) { const m = G.dummies.find((d) => d.mover); m.hostile = !m.hostile; }
  hud.board(inp.down('board') && G.mode !== 'range' ? G.fighters.map((x) => ({ name: x === G.me ? 'YOU' : x.name, col: TEAM_COL[x.team], ...G.stats.get(x) })) : null);
}
function aimOnEnemy(tol) {
  const f = G.me, eye = f.eye(), d = { x: Math.sin(f.yaw) * Math.cos(f.pitch), y: -Math.sin(f.pitch), z: Math.cos(f.yaw) * Math.cos(f.pitch) };
  for (const e of G.fighters) {
    if (e.team === f.team || !e.alive) continue;
    const c = e.hitboxes().body, p = { x: c.a.x, y: (c.a.y + c.b.y) / 2 + 0.2, z: c.a.z }, v = { x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z }, l = Math.hypot(v.x, v.y, v.z);
    const ang = Math.acos(Math.max(-1, Math.min(1, (v.x * d.x + v.y * d.y + v.z * d.z) / l)));
    if (ang < Math.max(tol, 0.5 / l)) { const h = K3.phys.ray(eye, { x: v.x / l, y: v.y / l, z: v.z / l }, l); if (!h || h.dist > l - 0.4) return e; }
  }
  return null;
}

// ---------- weapons for everyone ----------
function arms(f, dt) {
  const I = f.input, A = f.arms;
  const ev = tickArms(f, dt, G.mods);
  if (f === G.me && ev) K3.audio.play(ev === 'shell' ? 'reload0' : 'reload1', { vol: 0.5 });
  if (!f.alive || (f.dummy && !f.hostile)) return;
  if (I.swap >= 0 && I.swap !== A.cur) { if (swapTo(f, I.swap, G.mods)) { if (f === G.me) K3.audio.tone(420, 0.04, 'triangle', 0.03); } }
  if (I.reload && startReload(f) && f === G.me) K3.audio.play('reload0', { vol: 0.45 });
  if (I.ability && f.useAbility() && f === G.me) hud.msg('', f.abilityKind === 'dash' ? 'DASH' : 'BARRIER', 0.5);
  const W = curW(A);
  // sprint-to-fire delay, then the trigger (automatic weapons fire while held, the others need a new click)
  if (f.sprinting || f.sprintStop < 0.12) return;
  const want = W.auto ? I.fire : I.fireTap;
  if (want) { const shot = tryFire(f, G.mods); if (shot) fire(f, shot); }
  if (f === G.me && f.arms.cur !== lastWeapon) { lastWeapon = f.arms.cur; vmShow(f.arms.list[f.arms.cur]); }
}

// ---------- the 60 Hz tick ----------
function update(dt) {
  if (G.phase === 'menu' || G.phase === 'over' || !G.me) return;
  G.time += dt;
  playerInput(dt);
  if (N) netTick(dt);
  for (const b of G.brains) b.tick(dt);
  if (G.mode === 'range') rangeTick(dt);
  for (const f of G.fighters) { if (f.remote) { followNet(f, dt); continue; } arms(f, dt); f.step(dt); }
  for (const b of G.barriers) { b.t -= dt; if (b.t <= 0 || b.hp <= 0) removeBarrier(b); }
  G.barriers = G.barriers.filter((b) => !b.dead);
  hud.tick(dt);
  if (G.mode === 'range') return;
  // phases
  if (G.phase === 'freeze') { G.phaseT -= dt; if (G.phaseT <= 0) { G.phase = 'live'; hud.msg('FIGHT', '', 0.7, '#ffd93a'); K3.audio.tone(880, 0.12, 'square', 0.05); } }
  else if (G.phase === 'live') {
    G.roundT += dt;
    const start = G.mods.tinyZone ? 20 : OVERCHARGE_AT;
    if (G.roundT >= start - 3 && !G.overWarned) { G.overWarned = true; hud.msg('OVERCHARGE', 'the ring is closing', 1.6, '#ff3355'); K3.audio.play('zone', { vol: 0.7 }); }
    if (G.roundT >= start) {
      const B = arena.bounds, R0 = Math.hypot(B.x, B.z), k = Math.min(1, (G.roundT - start) / (ZONE_END - start));
      G.zone = { x: 0, z: 0, r: R0 + (4 - R0) * k };
      if (hostSide()) for (const f of G.fighters) if (f.alive && !f.ghost && Math.hypot(f.feet().x, f.feet().z) > G.zone.r) { f.zoneAcc = (f.zoneAcc || 0) + (12 + Math.max(0, G.roundT - ZONE_END) * 3) * dt; if (f.zoneAcc >= 3) { const d = f.zoneAcc; f.zoneAcc = 0; hurt(f, d, f, false, 'zone'); } }
    }
    const alive = [0, 1].map((t) => G.fighters.some((f) => f.team === t && f.alive && !f.ghost));
    if (hostSide() && (!alive[0] || !alive[1])) endRound(alive[0] ? 0 : alive[1] ? 1 : -1);
  } else if (G.phase === 'end') { G.phaseT -= dt; if (G.phaseT <= 0 && hostSide()) afterRound(); }
  else if (G.phase === 'patch') { G.phaseT -= dt; if (G.phaseT <= 0 && hostSide()) applyPatch(G.patchKeys[0]); }
}

// ---------- camera, viewmodel, HUD every frame ----------
let bob = 0;
function vmMuzzle() { const g = vmGuns[G.me.arms.list[G.me.arms.cur]]; const p = V.Vector3.TransformCoordinates(new V.Vector3(0, 0.05, 0.62), vm.getWorldMatrix()); return g ? { x: p.x, y: p.y, z: p.z } : G.me.eye(); }
function render(alpha, dt) {
  stepFx(dt);
  for (const f of G.fighters) f.pose?.(alpha, dt);
  if (G.debugCam) { cam.position.set(...G.debugCam.pos); cam.setTarget(new V.Vector3(...G.debugCam.at)); vm.setEnabled(false); hud.show(false); return; }
  if (!G.me || G.phase === 'menu') { const t = performance.now() / 9000; cam.position.set(Math.sin(t) * 24, 9, Math.cos(t) * 18); cam.setTarget(new V.Vector3(0, 1, 0)); vm.setEnabled(false); return; }
  let f = G.me, spect = null;
  if (!f.alive && G.mode !== 'range') { spect = G.fighters.find((x) => x.team === f.team && x.alive) || f.lastHitBy || null; if (spect && !spect.alive) spect = null; }
  const who = spect || f, p0 = who.prev, p1 = who.feet();
  const eyeH = who.eyeH;
  let pos = { x: p0.x + (p1.x - p0.x) * alpha, y: p0.y + (p1.y - p0.y) * alpha + eyeH, z: p0.z + (p1.z - p0.z) * alpha };
  if (spect && spect.team !== f.team) { pos = { x: pos.x - Math.sin(spect.yaw) * 3, y: pos.y + 1.2, z: pos.z - Math.cos(spect.yaw) * 3 }; }
  // view kick (visual only) + hurt shake + walk bob
  G.kick = (G.kick || 0) * Math.exp(-dt * 18); G.hurtShake = Math.max(0, (G.hurtShake || 0) - dt);
  const sp = Math.hypot(f.vel.x, f.vel.z); bob += dt * sp * (f.grounded ? 1.15 : 0);
  const bobY = f.grounded && !spect ? Math.sin(bob * 2) * 0.025 * Math.min(1, sp / 6.5) : 0;
  const shake = G.hurtShake > 0 ? (Math.random() - 0.5) * 0.02 : 0;
  cam.position.set(pos.x, pos.y + bobY, pos.z);
  cam.rotation.set(who.pitch - (spect ? 0 : G.kick) + shake + (spect && spect.team !== f.team ? 0.3 : 0), who.yaw + shake, 0);
  const W = curW(f.arms);
  const baseFov = (K3.settings.fov * Math.PI) / 180, zoom = 1 - f.arms.zoom * (1 - (W.zoom || 1));
  cam.fov = 2 * Math.atan(Math.tan(baseFov / 2) * zoom) * (cam.fovMode === 1 ? 1 : 0.62);
  K3.listener = { x: cam.position.x, y: cam.position.y, z: cam.position.z, yaw: who.yaw };
  // viewmodel: bob, sway, recoil, reload dip, swap raise, scope hides it
  const scoped = W.scope && f.arms.zoom > 0.9;
  vm.setEnabled(f.alive && !spect && !scoped && G.phase !== 'over');
  if (vm.isEnabled()) {
    if (!vmGuns[f.arms.list[f.arms.cur]] || lastWeapon !== f.arms.cur) { lastWeapon = f.arms.cur; vmShow(f.arms.list[f.arms.cur]); }
    const ads = f.arms.zoom, A = f.arms;
    const swap = A.swapT > 0 ? A.swapT / Math.max(0.01, W.swap) : 0, rel = A.reloadT > 0 && !W.shellReload ? Math.sin(Math.min(1, 1 - A.reloadT / W.reload) * Math.PI) : W.shellReload && A.reloadT > 0 ? 0.35 : 0;
    const k = (G.kick || 0) * 3, slash = G.slashT > 0 ? Math.sin((1 - G.slashT / 0.22) * Math.PI) : 0;
    G.slashT = Math.max(0, (G.slashT || 0) - dt);
    vm.position.set(0.17 * (1 - ads) + Math.cos(bob) * 0.006, -0.17 + 0.06 * ads + Math.abs(Math.sin(bob)) * 0.008 - swap * 0.3 - rel * 0.12, 0.42 - k * 0.12 + slash * 0.15);
    vm.rotation.set(-k * 0.6 + rel * 0.7 + swap * 0.8 - slash * 0.4, -0.04 * (1 - ads) + slash * 0.6, rel * 0.3);
    G.flashT = Math.max(0, (G.flashT || 0) - dt);
    flash.setEnabled(G.flashT > 0); flash.position.set(0, 0.05, LEN[f.arms.list[f.arms.cur]] * 0.95 + 0.05);
  }
  hud.scope(scoped && f.alive);
  // HUD
  if (G.phase !== 'over') {
    const gap = (Math.tan(spreadOf(f)) / Math.tan(cam.fov / 2)) * (K3.canvas.clientWidth / 2);
    hud.crosshair(gap + 2, f.alive && !scoped && !spect && !(W.scope && f.arms.zoom > 0.3), aimOnEnemy(0.02) ? '#ff3355' : '#fff');
    const A = f.arms, id = A.list[A.cur];
    hud.hp(f.hp, f.maxHp, f.abilityKind === 'dash' ? (f.abilityCd > 0 ? `DASH ${f.abilityCd.toFixed(1)}s` : 'DASH READY · E') : f.abilityCd > 0 ? `BARRIER ${f.abilityCd.toFixed(1)}s` : 'BARRIER READY · E', f.abilityCd <= 0);
    hud.ammo(W.name, A.ammo[id], W.mag, A.list.map((x) => WEAPONS[x].name), A.cur, A.reloadT > 0);
    if (G.mode !== 'range') {
      const t = G.phase === 'freeze' ? G.phaseT : Math.max(0, (G.mods.tinyZone ? 20 : OVERCHARGE_AT) - G.roundT);
      hud.score(G.score[0], G.score[1], G.phase === 'freeze' ? `${Math.ceil(t)}` : G.zone ? 'RING' : `0:${String(Math.ceil(t)).padStart(2, '0')}`, !!G.zone);
      hud.zone(G.zone && f.alive && Math.hypot(f.feet().x, f.feet().z) > G.zone.r);
      hud.spec(spect ? `SPECTATING ${spect.name}` : '');
    }
  }
  drawZone();
}
// the overcharge ring: a glowing cylinder wall
let ring = null;
function drawZone() {
  if (!G.zone) { if (ring) ring.setEnabled(false); return; }
  if (!ring) { ring = V.CreateCylinder('ring', { height: 7, diameter: 2, tessellation: 64, cap: 0, sideOrientation: 2 }, S); const m = new V.StandardMaterial('ringm', S); m.emissiveColor = V.Color3.FromHexString('#ff2bd6'); m.alpha = 0.18; m.disableLighting = true; m.backFaceCulling = false; ring.material = m; ring.isPickable = false; }
  ring.setEnabled(true); ring.position.set(G.zone.x, 3.5, G.zone.z); ring.scaling.set(G.zone.r, 1, G.zone.r);
}

// ================= ONLINE =================
const lobby = N && onlineLobby(K3, N, {
  title: 'NOVEX STRIKE',
  sub: 'ONLINE · first to 5 rounds · bots fill the empty spots',
  hostOpts: [
    { key: 'mode', label: 'MODE', opts: [['1v1', '1v1'], ['2v2', '2v2 (teams)'], ['coop', 'CO-OP vs BOTS']], ok: (v, n) => (v === '1v1' ? n === 2 : v === 'coop' ? n <= 2 : n <= 4) },
    { key: 'diff', label: 'BOTS', opts: [['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']] },
  ],
  myOpts: [
    { key: 'primary', label: 'YOUR PRIMARY · always with a pistol + knife', opts: [['smg', 'SMG'], ['shotgun', 'SHOTGUN'], ['marksman', 'MARKSMAN']] },
    { key: 'ability', label: 'YOUR ABILITY', opts: [['dash', 'DASH · 5.5 m'], ['barrier', 'BARRIER']] },
  ],
  cfg: { mode: N.players.length === 2 ? '1v1' : '2v2', diff: G.cfg.diff },
  mine: { primary: G.cfg.primary, ability: G.cfg.ability },
  onMine: (m) => { Object.assign(G.cfg, m); localStorage.setItem('strike_cfg', JSON.stringify(G.cfg)); },
  onStart: (go) => startOnline(go),
  onShow: () => { clearFighters(); G.phase = 'menu'; hud.show(false); },
});
if (N) netBadge(K3, N, { left: 12, top: 64 });

// who plays where: 1v1 (two players), 2v2 (players alternate teams), co-op (players together vs bots); bots fill the rest
function startOnline(go) {
  clearFighters();
  const mode = go.cfg.mode === '1v1' ? '1v1' : '2v2', n = mode === '2v2' ? 2 : 1;
  G.nav = navFor(mode); arena.setMode(mode);
  G.mode = mode; G.score = [0, 0]; G.round = 0; G.mods = {}; G.patchName = ''; G.stats = new Map(); G.cfg.diff = go.cfg.diff; G.time = 0;
  G.spectator = !go.ids.includes(N.me) || !!go.late;
  const rng = mulberry(go.seed), names = ['VEX', 'NOVA', 'BYTE', 'GLITCH', 'RIFT', 'ZERO'];
  const teams = [[], []];
  go.ids.forEach((id, i) => teams[go.cfg.mode === 'coop' ? 0 : i % 2].push(id));
  let bi = 0;
  for (let t = 0; t < 2; t++) for (let i = 0; i < n; i++) {
    const id = teams[t][i], sp = arena.spawns[t][i];
    if (id) {
      const pk = go.picks[id] || {}, me = id === N.me && !G.spectator;
      const f = new Fighter(G, { team: t, name: N.name(id), primary: pk.primary || 'smg', ability: pk.ability || 'dash', me, spawn: sp, seed: 7 + t * 10 + i });
      Object.assign(f, { nid: id, owner: id, human: true, remote: !me });
      if (me) G.me = f;
      G.fighters.push(f);
    } else {
      const f = new Fighter(G, { team: t, name: names[bi % names.length], primary: PRIMARIES[Math.floor(rng() * 3)], ability: rng() < 0.5 ? 'dash' : 'barrier', bot: true, spawn: sp, seed: 100 + t * 10 + i });
      Object.assign(f, { nid: 'b' + bi++, owner: N.hostId, remote: !N.isHost });
      G.fighters.push(f);
      if (N.isHost) G.brains.push(new Brain(G, f, go.cfg.diff));
    }
  }
  for (const f of G.fighters) if (f.remote) f.interp = new Interp(0.1);
  // watching (arrived late): an invisible camera that spectates like a teammate who is out
  if (G.spectator) { G.me = new Fighter(G, { team: 0, name: 'YOU', me: true, spawn: { x: 0, z: -60 }, seed: 1 }); G.me.alive = false; G.me.ch.collider.setEnabled(false); Object.assign(G.me, { nid: 'spec:' + N.me, owner: N.me, ghost: true }); }
  G.fighters.forEach((f) => G.stats.set(f, { k: 0, d: 0, dmg: 0 }));
  K3.shell.screen(''); hud.show(true); hud.range(null); touchLayout();
  K3.playing = true; K3.paused = false; K3.menuOpen = false;
  if (!K3.isTouch && !K3.test) K3.canvas.requestPointerLock?.();
  K3.canvas.focus();
  if (!G.spectator) window.XC?.start();
  if (N.isHost) startRound(); else { G.phase = 'freeze'; G.phaseT = FREEZE; G.roundT = 0; hud.msg(G.spectator ? 'WATCHING' : 'GET READY', G.spectator ? 'you join the next match' : '', 2); }
}

// my fighters (me + the host's bots) -> everyone, 30 times a second; the host also sends the round clock + HP twice a second
let sendAcc = 0, syncAcc = 0;
const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
function netTick(dt) {
  sendAcc += dt; syncAcc += dt;
  if (sendAcc >= 1 / 30) {
    sendAcc = 0;
    const list = G.fighters.filter((f) => !f.remote && !f.ghost);
    if (list.length) N.send({ k: 's', t: N.now(), r: G.round, f: list.map((f) => { const p = f.feet(); return [f.nid, r2(p.x), r2(p.y), r2(p.z), r2(f.vel.x), r2(f.vel.y), r2(f.vel.z), r3(f.yaw), r3(f.pitch), (f.crouch ? 1 : 0) | (f.slideT > 0 ? 2 : 0) | (f.grounded ? 4 : 0) | (f.arms.reloadT > 0 ? 8 : 0), f.arms.cur, r2(f.arms.zoom), r2(f.eyeH)]; }) }, { fast: true });
  }
  if (N.isHost && syncAcc >= 0.5) {
    syncAcc = 0;
    N.send({ k: 'sy', r: G.round, ph: G.phase, pt: r2(G.phaseT || 0), rt: r2(G.roundT || 0), sc: G.score, hp: G.fighters.filter((f) => !f.ghost).map((f) => [f.nid, r2(f.hp), f.alive ? 1 : 0]) }, { fast: true });
  }
}
// someone else's fighter: placed where its owner says it was ~0.1 s ago (smooth), footsteps from how far it moved
function followNet(f, dt) {
  const s = f.interp && f.interp.sample();
  f.prev = f.feet();
  if (!s || !f.alive) return;
  const { a, b, k } = s, kk = Math.min(1.25, k);
  const x = lerp(a[1], b[1], kk), y = lerp(a[2], b[2], kk), z = lerp(a[3], b[3], kk), fl = b[9];
  const low = (fl & 1) || (fl & 2);
  if (low && f.ch.height > 1.5) f.ch.setHeight(1.15); else if (!low && f.ch.height < 1.5) f.ch.setHeight(1.8);
  const h = f.ch.height / 2;
  f.ch.body.setTranslation({ x, y: y + h, z }, true); f.ch.body.setNextKinematicTranslation({ x, y: y + h, z });
  f.vel = { x: b[4], y: b[5], z: b[6] };
  f.yaw = lerpAngle(a[7], b[7], kk); f.pitch = lerp(a[8], b[8], kk);
  f.crouch = !!low; f.slideT = fl & 2 ? 0.3 : 0; f.grounded = !!(fl & 4);
  f.arms.reloadT = fl & 8 ? 0.5 : 0; f.arms.cur = Math.max(0, Math.min(f.arms.list.length - 1, b[10] | 0)); f.arms.zoom = b[11]; f.eyeH = b[12];
  if (f.grounded) { f.stepAcc += Math.hypot(x - f.prev.x, z - f.prev.z); if (f.stepAcc > 2.1) { f.stepAcc = 0; G.sound('step', f); } }
}
// a fighter whose player left (or whose owner was the old host) now belongs to the host: a bot keeps it playing
function reassign() {
  for (const f of G.fighters) {
    if (f.ghost || N.players.some((p) => p.id === f.owner)) continue;
    f.owner = N.hostId;
    if (f.human && !N.players.some((p) => p.id === f.nid)) { f.name += ' (BOT)'; f.human = false; }
    if (f.owner === N.me && f.remote) {
      f.remote = false; f.interp = null; f.bot = true;
      if (f.alive) f.ch.collider.setEnabled(true);
      if (!G.brains.some((b) => b.f === f)) G.brains.push(new Brain(G, f, G.cfg.diff));
    }
  }
}
// the host checks a hit claim: both alive, round live, believable damage + range, not faster than the gun can fire
function claimOk(sh, by, e, dmg, w) {
  const W = WEAPONS[w]; if (!W || !by || !e || !by.alive || !e.alive || G.phase !== 'live' || e.team === by.team) return false;
  if (!(dmg > 0 && dmg <= 165)) return false;
  const d = Math.hypot(e.feet().x - by.feet().x, e.feet().z - by.feet().z);
  if (d > (W.melee ? W.lunge + 2.5 : (W.range || 150) + 6)) return false;
  if (sh !== by.lastShot) {
    // one trigger pull at most as often as the gun fires (+ slack for network bunching)
    const t = G.time; by.budget = Math.min(6, (by.budget ?? 6) + (t - (by.budgetT ?? t)) * ((W.rpm || 600) / 60) * 1.6); by.budgetT = t;
    by.lastShot = sh; if (by.budget < 1) { by.lastShotOk = false; return false; } by.budget -= 1; by.lastShotOk = true;
  }
  return by.lastShotOk;
}
if (N) {
  N.on((d, from) => {
    if (!d || !d.k || d.k[0] === 'L' || !G.fighters.length) return;
    if (d.k === 's') { if (d.r !== G.round) return; for (const st of d.f) { const f = byNid(st[0]); if (f && f.remote && f.owner === from) f.interp.push(st, d.t); } return; }
    if (d.k === 'sh') {
      const f = byNid(d.n); if (!f) return;
      // what it looks and sounds like
      if (!d.melee && d.e) {
        const W = WEAPONS[d.w], at = { x: d.e[0], y: d.e[1], z: d.e[2] }, mz = d.m ? { x: d.m[0], y: d.m[1], z: d.m[2] } : at;
        if (W && W.snd) K3.audio.play(W.snd + Math.floor(Math.random() * (W.snd === 'marksman' || W.snd === 'shotgun' ? 2 : 3)), { vol: 0.9, rate: 0.95 + Math.random() * 0.1, at });
        for (const e of d.ends || []) { tracer(mz, { x: e[0], y: e[1], z: e[2] }, W ? W.tracer : '#fff'); spark({ x: e[0], y: e[1], z: e[2] }, 3); }
        G.brains.forEach((b) => b.f !== f && Math.hypot(b.f.feet().x - at.x, b.f.feet().z - at.z) < 28 && b.hear(f.feet(), f));
      } else K3.audio.tone(320, 0.06, 'triangle', 0.02, -200);
      // what it does (the host decides)
      if (N.isHost && f.owner === from) {
        const sh = {};
        for (const [nid, dmg, head] of d.hits || []) { const e = byNid(nid); if (claimOk(sh, f, e, dmg, d.w)) hurt(e, dmg, f, !!head, d.w); }
        for (const [id, dmg] of d.bars || []) { const b = G.barriers.find((x) => x.id === id); if (b && dmg > 0 && dmg < 120) hitBarrier(b, dmg); }
      }
      return;
    }
    if (d.k === 'bar') { const f = byNid(d.n); if (f && f.owner === from && !G.barriers.some((b) => b.id === d.id)) G.placeBarrier(f, d); return; }
    if (d.k === 'pk') { if (N.isHost && G.phase === 'patch') applyPatch(d.key); return; }
    if (from !== N.hostId || N.isHost) return;   // everything below is the host's word
    if (d.k === 'hp') { const e = byNid(d.n), by = byNid(d.by); if (e && by && e.alive) applyHp(e, d.hp, by, d.d, !!d.h); }
    else if (d.k === 'die') { const e = byNid(d.n), by = byNid(d.by); if (e && by) { kill(e, by, !!d.h, d.w); if (by === G.me) hud.hit(!!d.h, true); } }
    else if (d.k === 'barx') { const b = G.barriers.find((x) => x.id === d.id); if (b) removeBarrier(b); }
    else if (d.k === 'rd') startRound(d);
    else if (d.k === 're') endRound(d.w, d);
    else if (d.k === 'pp') patchPhase(d.keys, d.who);
    else if (d.k === 'mo') { G.score = d.score; matchOver(); }
    else if (d.k === 'sy' && d.r === G.round && G.phase !== 'over') {
      if (G.phase === d.ph) { if (Math.abs((G.roundT || 0) - d.rt) > 0.3) G.roundT = d.rt; if (Math.abs((G.phaseT || 0) - d.pt) > 0.3) G.phaseT = d.pt; }
      G.score = d.sc;
      for (const [nid, hp, al] of d.hp) { const e = byNid(nid); if (!e) continue; if (!al && e.alive) kill(e, e.lastHitBy || e, false, 'zone'); else if (al && e.alive) e.hp = hp; }
    }
  });
  N.onLeave((id) => { if (G.fighters.length) { reassign(); hud.msg('', 'a player left · a bot takes over', 2); } });
  N.onHost((id) => { if (G.fighters.length) reassign(); if (id === N.me) hud.msg('', 'you are the host now', 2); });
}

K3.shell.loading(1);
// tests: run the simulation n ticks right now (no rendering), with the same code as the game loop
G.simulate = (n, each) => { for (let i = 0; i < n; i++) { update(1 / 60); K3.world.step(); each?.(i); } };
G.gunsLoaded = () => Object.keys(gunSrc).length;
G.arena = arena;
K3.loop(update, render);
menu();
// tests: ?test&auto=1v1 jumps straight into a match
const Q = new URLSearchParams(location.search);
if (Q.get('auto')) { G.cfg.mode = Q.get('auto'); if (Q.get('primary')) G.cfg.primary = Q.get('primary'); Q.get('auto') === 'range' ? startRange() : startMatch(); }
