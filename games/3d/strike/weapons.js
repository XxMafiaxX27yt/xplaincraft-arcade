// NOVEX STRIKE weapons: the locked numbers (HP 100) + recoil patterns, bloom, falloff, swap speeds.
//   dmg [body, head] · rpm · mag · reload (s) · fall [full until m, min factor, at m]
//   spread: hip cone (radians) · bloom per shot / max / recovery per s · recoil: aim kick pattern (pitch up, yaw) per shot
export const WEAPONS = {
  pistol: {
    name: 'PISTOL', slot: 1, model: 'blaster-a', auto: false, dmg: [24, 48], rpm: 300, mag: 12, reload: 1.2, swap: 0.3,
    fall: [12, 0.65, 35], spread: 0.011, bloom: [0.012, 0.045, 0.16], move: 0.014, recoil: [[0.012, 0.002], [0.014, -0.003], [0.013, 0.003]], recover: 0.55,
    zoom: 0.82, zoomT: 0.12, kick: 0.035, snd: 'pistol', tracer: '#9ae6ff',
  },
  smg: {
    name: 'SMG', slot: 0, model: 'blaster-d', auto: true, dmg: [17, 26], rpm: 600, mag: 30, reload: 1.8, swap: 0.45,
    fall: [10, 0.6, 30], spread: 0.02, bloom: [0.0035, 0.035, 0.12], move: 0.016,
    recoil: [[0.006, 0], [0.007, 0.001], [0.008, 0.002], [0.008, 0.001], [0.007, -0.002], [0.006, -0.003], [0.006, -0.002], [0.005, 0.002], [0.005, 0.003], [0.005, 0.002]], recover: 0.5,
    zoom: 0.9, zoomT: 0.12, kick: 0.02, snd: 'smg', tracer: '#ffd93a',
  },
  shotgun: {
    name: 'SHOTGUN', slot: 0, model: 'blaster-l', auto: true, dmg: [14, 18], pellets: 8, rpm: 70, mag: 6, reload: 0.45, shellReload: true, swap: 0.55,
    fall: [4, 0.25, 14], range: 26, spread: 0.075, bloom: [0, 0, 1], move: 0.01, recoil: [[0.05, 0]], recover: 0.7,
    zoom: 0.92, zoomT: 0.12, kick: 0.09, snd: 'shotgun', tracer: '#ff8a3a',
  },
  marksman: {
    name: 'MARKSMAN', slot: 0, model: 'blaster-e', auto: false, dmg: [55, 100], rpm: 75, mag: 6, reload: 2.2, swap: 0.6,
    fall: [999, 1, 999], spread: 0.09, scoped: 0.0006, bloom: [0, 0, 1], move: 0.05, recoil: [[0.045, 0.004]], recover: 0.6,
    zoom: 0.34, zoomT: 0.18, scope: true, scopeSpeed: 0.7, kick: 0.06, snd: 'marksman', tracer: '#ff2bd6',
  },
  knife: {
    name: 'KNIFE', slot: 2, model: null, melee: true, dmg: [55, 55], rpm: 133, swap: 0.25, range: 2.3, lunge: 4.6, kick: 0.04, snd: null,
  },
};
export const PRIMARIES = ['smg', 'shotgun', 'marksman'];

// fixed shotgun pellet pattern (two rings) + a little random: readable, lethal up close
const PELLETS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];

// weapon state for one fighter
export function arsenal(primary) {
  const list = [primary, 'pistol', 'knife'];
  const ammo = {}; list.forEach((w) => (ammo[w] = WEAPONS[w].mag || 0));
  return { list, cur: 0, ammo, cool: 0, swapT: WEAPONS[primary].swap, reloadT: 0, shellT: 0, bloom: 0, shot: 0, sinceShot: 9, zoom: 0, recoilAcc: { p: 0, y: 0 }, lastFire: false };
}
export const curW = (A) => WEAPONS[A.list[A.cur]];

// spread cone (radians) right now, for shooting and for the crosshair
export function spreadOf(f) {
  const A = f.arms, W = curW(A); if (W.melee) return 0;
  if (W.scope && A.zoom > 0.95) return W.scoped;
  let s = W.spread + A.bloom;
  const sp = Math.hypot(f.vel.x, f.vel.z);
  s += W.move * Math.min(1.4, sp / 6.5);
  if (!f.grounded) s += 0.03;
  if (f.crouch && f.grounded) s *= 0.75;
  if (A.zoom > 0.5 && !W.scope) s *= 0.7;
  return s;
}

// tick timers; returns events: 'reloaded' etc.
export function tickArms(f, dt, mods) {
  const A = f.arms, W = curW(A);
  A.cool = Math.max(0, A.cool - dt);
  A.sinceShot += dt;
  const hot = mods.hotHands ? 1.6 : 1;
  if (A.swapT > 0) A.swapT = Math.max(0, A.swapT - dt * hot);
  // bloom + recoil recovery
  if (W.bloom) A.bloom = Math.max(0, A.bloom - W.bloom[2] * dt);
  if (A.sinceShot > 0.12) { const k = Math.min(1, dt * 6); const rp = A.recoilAcc.p * k * (W.recover || 0.5), ry = A.recoilAcc.y * k * (W.recover || 0.5); f.pitch += rp; f.yaw -= ry; A.recoilAcc.p -= A.recoilAcc.p * k; A.recoilAcc.y -= A.recoilAcc.y * k; if (A.sinceShot > 0.25) A.shot = 0; }
  // reload
  if (A.reloadT > 0) {
    A.reloadT -= dt * hot;
    if (A.reloadT <= 0) {
      if (W.shellReload) { A.ammo[A.list[A.cur]]++; if (A.ammo[A.list[A.cur]] < W.mag) A.reloadT = W.reload; else A.reloadT = 0; return 'shell'; }
      A.ammo[A.list[A.cur]] = W.mag; A.reloadT = 0; return 'reloaded';
    }
  }
  // scope / zoom
  const wantZoom = f.input.aim && !W.melee && A.swapT <= 0 && (A.reloadT <= 0 || W.shellReload) && !f.sprinting;
  A.zoom = Math.max(0, Math.min(1, A.zoom + (wantZoom ? 1 : -1.6) * (dt / (W.zoomT || 0.12))));
  return null;
}
export function startReload(f) {
  const A = f.arms, W = curW(A), id = A.list[A.cur];
  if (W.melee || A.reloadT > 0 || A.ammo[id] >= W.mag || A.swapT > 0) return false;
  A.reloadT = W.reload; return true;
}
export function swapTo(f, i, mods) {
  const A = f.arms; if (i === A.cur || i < 0 || i >= A.list.length) return false;
  A.cur = i; A.swapT = curW(A).swap; A.reloadT = 0; A.zoom = 0; A.bloom = 0; A.shot = 0; return true;
}

// pull the trigger: returns null or { pellets: [{dir}], weapon } for the game to trace
export function tryFire(f, mods) {
  const A = f.arms, W = curW(A), id = A.list[A.cur];
  if (A.swapT > 0 || A.cool > 0) return null;
  if (W.melee) { A.cool = 60 / W.rpm; A.sinceShot = 0; return { melee: true, weapon: id }; }
  if (A.reloadT > 0 && !W.shellReload) return null;
  if (A.ammo[id] <= 0) { startReload(f); return null; }
  A.reloadT = 0;
  A.ammo[id]--;
  A.cool = (60 / W.rpm) / (mods.overclock ? 1.25 : 1);
  A.sinceShot = 0;
  const spread = spreadOf(f), rng = f.rng;
  // aim recoil: moves where you aim (deterministic pattern), the game adds a separate view kick
  const pat = W.recoil[Math.min(A.shot, W.recoil.length - 1)];
  const r = { p: pat[0] * (f.crouch ? 0.8 : 1), y: pat[1] };
  f.pitch -= r.p; f.yaw += r.y; A.recoilAcc.p += r.p; A.recoilAcc.y += r.y;
  A.shot++;
  A.bloom = Math.min(W.bloom[1], A.bloom + W.bloom[0]);
  const fwd = dirOf(f.yaw, f.pitch), right = { x: Math.cos(f.yaw), y: 0, z: -Math.sin(f.yaw) }, up = cross(fwd, right);
  const pellets = [];
  const n = W.pellets || 1;
  for (let i = 0; i < n; i++) {
    let ox, oy;
    if (n > 1) { const p = PELLETS[i % PELLETS.length], ring = i === 0 ? 0 : 1; ox = p[0] * spread * 0.75 * ring + (rng() - 0.5) * spread * 0.4; oy = p[1] * spread * 0.75 * ring + (rng() - 0.5) * spread * 0.4; }
    else { const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * spread; ox = Math.cos(a) * d; oy = Math.sin(a) * d; }
    pellets.push(norm({ x: fwd.x + right.x * ox + up.x * oy, y: fwd.y + right.y * ox + up.y * oy, z: fwd.z + right.z * ox + up.z * oy }));
  }
  return { pellets, weapon: id };
}

// damage at a distance (+ head / patch rules)
export function damageAt(id, dist, head, mods) {
  const W = WEAPONS[id];
  let d = W.dmg[head ? 1 : 0];
  if (head && mods.headshotSurge && id !== 'marksman') d = W.dmg[0] + (W.dmg[1] - W.dmg[0]) * 1.5;
  const [full, minF, at] = W.fall || [999, 1, 999];
  if (dist > full) d *= Math.max(minF, 1 - ((dist - full) / Math.max(1, at - full)) * (1 - minF));
  if (mods.glassCannon) d *= 1.25;
  return d;
}

export const dirOf = (yaw, pitch) => ({ x: Math.sin(yaw) * Math.cos(pitch), y: -Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) });
export const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
