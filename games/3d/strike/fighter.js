// A fighter (you, a teammate bot, an enemy bot, a training dummy): movement, health, weapons, ability, body + hitboxes.
// The player and the bots run the exact same code - bots just fill in `input`, `yaw`, `pitch` themselves.
import { V } from '../../kit3d/kit3d.js';
import { arsenal, curW } from './weapons.js';

export const TEAM_COL = ['#22e6ff', '#ff2bd6'];
const STAND = 1.8, CROUCH = 1.15, EYE_STAND = 1.62, EYE_CROUCH = 1.0;
const RUN = 6.5, SPRINT = 8.5, CROUCH_SPD = 3.2, SLIDE = 10, CAP = 11, JUMP_V = 6.6, GRAV = 18;

export class Fighter {
  constructor(game, { team, name, primary = 'smg', ability = 'dash', bot = false, dummy = false, me = false, spawn, seed = 1 }) {
    Object.assign(this, { game, team, name, primary, bot, dummy, me, abilityKind: ability });
    const K3 = game.K3;
    this.ch = K3.phys.character({ x: spawn.x, y: 0.05, z: spawn.z, radius: 0.4, height: STAND });
    this.ch.collider.userData = this.ch; this.ch.owner = this;
    this.yaw = spawn.yaw || 0; this.pitch = 0;
    this.vel = { x: 0, y: 0, z: 0 };
    this.input = { move: { x: 0, y: 0 }, jump: false, crouch: false, sprint: false, fire: false, fireTap: false, aim: false, reload: false, swap: -1, ability: false };
    this.rng = mulberry(seed);
    this.reset(spawn);
    if (!me) this.body = makeBody(game, this);
  }
  reset(spawn) {
    this.maxHp = this.game.mods.glassCannon ? 60 : 100;
    this.hp = this.maxHp; this.alive = true; this.deadT = 0;
    this.arms = arsenal(this.primary);
    this.vel = { x: 0, y: 0, z: 0 }; this.slideT = 0; this.dashT = 0; this.coyote = 0; this.crouch = false; this.sprinting = false; this.sprintStop = 1;
    this.eyeH = EYE_STAND; this.grounded = true; this.stepAcc = 0;
    this.abilityCd = 0; this.lastHitBy = null; this.damageTaken = 0;
    this.ch.setHeight(STAND);
    if (spawn) { this.ch.teleport(spawn.x, 0.05, spawn.z); this.yaw = spawn.yaw || 0; this.pitch = 0; }
    this.prev = this.feet();
    if (this.body) { this.body.root.setEnabled(true); this.body.dissolve = 0; }
  }
  feet() { return this.ch.pos(); }
  eye() { const p = this.feet(); return { x: p.x, y: p.y + this.eyeH, z: p.z }; }

  // one 60 Hz step of movement
  step(dt) {
    const I = this.input, mods = this.game.mods, ch = this.ch;
    this.prev = this.feet();
    if (!this.alive) return;
    const fwd = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }, right = { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
    let wx = right.x * I.move.x + fwd.x * I.move.y, wz = right.z * I.move.x + fwd.z * I.move.y;
    const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
    const W = curW(this.arms);
    let sp = Math.hypot(this.vel.x, this.vel.z);

    // crouch + slide (a slide needs speed: crouch while running fast)
    if (I.crouch && !this.crouchHeld && this.grounded && sp > 6 && this.slideT <= 0) {
      const d = sp || 1, s = Math.min(CAP, Math.max(sp, SLIDE));
      this.vel.x = (this.vel.x / d) * s; this.vel.z = (this.vel.z / d) * s; this.slideT = 0.62; this.game.sound?.('slide', this);
    }
    this.crouchHeld = I.crouch;
    if (this.slideT > 0) { this.slideT -= dt; if (sp < 4.2 || (!I.crouch && this.slideT < 0.45)) this.slideT = 0; }
    const wantLow = I.crouch || this.slideT > 0;
    if (wantLow && ch.height > CROUCH) ch.setHeight(CROUCH);
    if (!wantLow && ch.height < STAND) ch.setHeight(STAND);   // refuses under a ceiling
    this.crouch = ch.height < 1.5;

    // sprint: forward only, not while shooting / aiming / crouched
    const wasSprint = this.sprinting;
    this.sprinting = I.sprint && I.move.y > 0.5 && this.grounded && !this.crouch && !I.fire && this.arms.zoom < 0.2 && this.slideT <= 0;
    if (wasSprint && !this.sprinting) this.sprintStop = 0;
    this.sprintStop += dt;
    let target = this.crouch ? CROUCH_SPD : this.sprinting ? SPRINT : RUN;
    if (W.scope && this.arms.zoom > 0.5) target *= W.scopeSpeed;

    if (this.dashT > 0) {
      this.dashT -= dt; this.vel.x = this.dashDir.x * 30; this.vel.z = this.dashDir.z * 30;
      if (this.dashT <= 0) { this.vel.x = this.dashDir.x * RUN; this.vel.z = this.dashDir.z * RUN; }
    } else if (this.grounded && this.slideT <= 0) {
      const tx = wx * target, tz = wz * target, dx = tx - this.vel.x, dz = tz - this.vel.z, dl = Math.hypot(dx, dz);
      const acc = (wl > 0.05 ? 70 : 48) * dt;
      if (dl <= acc) { this.vel.x = tx; this.vel.z = tz; } else { this.vel.x += (dx / dl) * acc; this.vel.z += (dz / dl) * acc; }
    } else if (this.slideT > 0) {
      const k = Math.max(0, 1 - 1.5 * dt); this.vel.x *= k; this.vel.z *= k;
      this.vel.x += wx * 6 * dt; this.vel.z += wz * 6 * dt;
    } else {
      // air: steer, keep momentum
      const cur = this.vel.x * wx + this.vel.z * wz, add = Math.max(0, Math.min(15 * dt, target - cur));
      this.vel.x += wx * add; this.vel.z += wz * add;
    }
    sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > CAP && this.dashT <= 0) { this.vel.x *= CAP / sp; this.vel.z *= CAP / sp; }

    // jump (a little coyote time)
    this.coyote = this.grounded ? 0.1 : Math.max(0, this.coyote - dt);
    if (I.jump && this.coyote > 0) { this.vel.y = JUMP_V; this.coyote = 0; this.grounded = false; this.slideT = Math.min(this.slideT, 0); this.game.sound?.('jump', this); }
    const g = mods.lowGravity ? GRAV * 0.45 : GRAV;
    this.vel.y -= g * dt;
    if (this.grounded && this.vel.y < 0) this.vel.y = -2;

    const want = { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt };
    const m = ch.move(want.x, want.y, want.z);
    // a wall in the way: drop only the speed going INTO it, keep sliding along it (ramps and steps are not walls)
    for (const n of ch.walls) {
      const l = Math.hypot(n.x, n.z) || 1, nx = n.x / l, nz = n.z / l, d = this.vel.x * nx + this.vel.z * nz;
      if (d < 0) { this.vel.x -= d * nx; this.vel.z -= d * nz; }
    }
    if (want.y > 0 && (ch.ceiling || m.y < want.y - 1e-4)) this.vel.y = 0;
    const was = this.grounded;
    this.grounded = ch.grounded;
    if (this.grounded && !was && this.vel.y < -7) this.game.sound?.('land', this);
    // eye height eases between standing and crouching
    const eyeT = this.crouch ? EYE_CROUCH : EYE_STAND;
    this.eyeH += (eyeT - this.eyeH) * Math.min(1, dt * 14);
    // footsteps
    if (this.grounded && this.slideT <= 0) { this.stepAcc += Math.hypot(m.x, m.z); if (this.stepAcc > (this.sprinting ? 2.4 : 2.0)) { this.stepAcc = 0; this.game.sound?.('step', this); } }
    // fell out somehow (never expected): put back on the floor
    if (this.feet().y < -5) this.ch.teleport(this.prev.x, 0.1, this.prev.z);
    this.abilityCd = Math.max(0, this.abilityCd - dt);
  }

  useAbility() {
    if (this.abilityCd > 0 || !this.alive) return false;
    if (this.abilityKind === 'dash') {
      const fwd = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }, right = { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
      let dx = right.x * this.input.move.x + fwd.x * this.input.move.y, dz = right.z * this.input.move.x + fwd.z * this.input.move.y;
      const l = Math.hypot(dx, dz); if (l < 0.1) { dx = fwd.x; dz = fwd.z; } else { dx /= l; dz /= l; }
      this.dashDir = { x: dx, z: dz }; this.dashT = 5.5 / 30; this.abilityCd = 12;
      this.game.sound?.('dash', this); return true;
    }
    if (this.abilityKind === 'barrier') { if (this.game.placeBarrier(this)) { this.abilityCd = 12; return true; } }
    return false;
  }

  // hitboxes: head sphere + body capsule (feet-relative), matching the body mesh
  hitboxes() {
    const p = this.feet(), headY = p.y + (this.crouch ? 1.06 : 1.66);
    return { head: { x: p.x, y: headY, z: p.z, r: 0.24 }, body: { a: { x: p.x, y: p.y + 0.2, z: p.z }, b: { x: p.x, y: p.y + (this.crouch ? 0.82 : 1.38), z: p.z }, r: 0.36 } };
  }

  // body animation for everyone else's view
  pose(alpha, dt) {
    const B = this.body; if (!B) return;
    const f = this.feet(), p = this.prev, x = p.x + (f.x - p.x) * alpha, y = p.y + (f.y - p.y) * alpha, z = p.z + (f.z - p.z) * alpha;
    B.root.position.set(x, y, z);
    B.root.rotation.y = this.yaw;
    if (!this.alive) return;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    B.walk += dt * sp * 1.6;
    const sw = Math.sin(B.walk) * Math.min(1, sp / 6) * 0.7;
    const low = this.crouch ? 1 : 0;
    B.k += (low - B.k) * Math.min(1, dt * 12);
    const k = B.k;
    B.hipL.rotation.x = sw * (1 - k) - k * 1.1; B.hipR.rotation.x = -sw * (1 - k) - k * 1.1;
    B.kneeL.rotation.x = k * 2.0 + Math.max(0, -sw) * 0.6; B.kneeR.rotation.x = k * 2.0 + Math.max(0, sw) * 0.6;
    B.upper.position.y = 0.92 - k * 0.5;
    B.hipL.position.y = B.hipR.position.y = 0.88 - k * 0.42;
    B.upper.rotation.x = this.slideT > 0 ? -0.5 : 0;
    B.headPivot.rotation.x = Math.max(-0.8, Math.min(0.8, this.pitch));
    B.armPivot.rotation.x = Math.max(-1.2, Math.min(1.2, this.pitch)) + (this.arms.reloadT > 0 ? 0.6 : 0);
    B.showGun(this.arms.list[this.arms.cur]);
  }
}

// a stylised robot: legs with knees, torso, head with a glowing team visor, arms holding the current gun
function makeBody(game, f) {
  const S = game.K3.scene, col = V.Color3.FromHexString(TEAM_COL[f.team]);
  const mat = game.bodyMat || (game.bodyMat = (() => { const m = new V.StandardMaterial('body', S); m.diffuseColor = V.Color3.FromHexString('#3a3a52'); m.specularColor = new V.Color3(0.2, 0.2, 0.25); return m; })());
  const trim = new V.StandardMaterial('trim' + f.team, S); trim.emissiveColor = col; trim.diffuseColor = col; trim.disableLighting = true;
  const dark = game.darkMat || (game.darkMat = (() => { const m = new V.StandardMaterial('dark', S); m.diffuseColor = V.Color3.FromHexString('#1c1c28'); m.specularColor = new V.Color3(0.1, 0.1, 0.1); return m; })());
  const root = new V.TransformNode('bot-' + f.name, S);
  const box = (w, h, d, m, parent, x, y, z) => { const b = V.CreateBox('p', { width: w, height: h, depth: d }, S); b.material = m; b.parent = parent; b.position.set(x, y, z); b.isPickable = false; if (game.K3.shadow) game.K3.shadow.addShadowCaster(b); return b; };
  const B = { root, walk: 0, k: 0, dissolve: 0 };
  // legs: hip pivot -> thigh -> knee pivot -> shin
  const leg = (sx) => {
    const hip = new V.TransformNode('hip', S); hip.parent = root; hip.position.set(sx * 0.14, 0.88, 0);
    box(0.17, 0.46, 0.2, mat, hip, 0, -0.23, 0);
    const knee = new V.TransformNode('knee', S); knee.parent = hip; knee.position.set(0, -0.44, 0);
    box(0.15, 0.44, 0.18, dark, knee, 0, -0.22, 0);
    box(0.19, 0.08, 0.3, trim, knee, 0, -0.42, 0.04);
    return [hip, knee];
  };
  [B.hipL, B.kneeL] = leg(-1); [B.hipR, B.kneeR] = leg(1);
  B.upper = new V.TransformNode('upper', S); B.upper.parent = root; B.upper.position.y = 0.92;
  box(0.5, 0.62, 0.3, mat, B.upper, 0, 0.32, 0);
  box(0.52, 0.06, 0.32, trim, B.upper, 0, 0.05, 0);
  box(0.34, 0.2, 0.06, trim, B.upper, 0, 0.42, 0.16);
  B.headPivot = new V.TransformNode('neck', S); B.headPivot.parent = B.upper; B.headPivot.position.y = 0.7;
  box(0.36, 0.34, 0.36, mat, B.headPivot, 0, 0.06, 0);
  box(0.3, 0.1, 0.05, trim, B.headPivot, 0, 0.08, 0.18);
  B.armPivot = new V.TransformNode('arms', S); B.armPivot.parent = B.upper; B.armPivot.position.set(0, 0.5, 0);
  box(0.12, 0.12, 0.5, dark, B.armPivot, 0.2, -0.05, 0.22);
  box(0.12, 0.12, 0.42, dark, B.armPivot, -0.16, -0.08, 0.26);
  B.gunMount = new V.TransformNode('gun', S); B.gunMount.parent = B.armPivot; B.gunMount.position.set(0.08, -0.04, 0.48);
  B.guns = {};
  B.showGun = (id) => {
    if (B.cur === id) return; B.cur = id;
    Object.values(B.guns).forEach((g) => g.setEnabled(false));
    if (!B.guns[id]) B.guns[id] = game.makeGun(id, B.gunMount, false);
    B.guns[id]?.setEnabled(true);
  };
  return B;
}

export function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ray vs hitboxes: returns { t, head } or null
export function rayHit(o, d, hb, maxT) {
  let best = null;
  const th = raySphere(o, d, hb.head, hb.head.r); if (th != null && th < maxT) best = { t: th, head: true };
  const tb = rayCapsule(o, d, hb.body.a, hb.body.b, hb.body.r); if (tb != null && tb < maxT && (!best || tb < best.t)) best = { t: tb, head: false };
  return best;
}
function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z, b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc;
  if (h < 0) return null; const t = -b - Math.sqrt(h); return t >= 0 ? t : null;
}
function rayCapsule(o, d, a, b, r) {
  // closest approach between the ray and the segment a-b, then a sphere test there (good enough for hitboxes)
  const ba = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, oa = { x: o.x - a.x, y: o.y - a.y, z: o.z - a.z };
  const baba = ba.x * ba.x + ba.y * ba.y + ba.z * ba.z, bard = ba.x * d.x + ba.y * d.y + ba.z * d.z, baoa = ba.x * oa.x + ba.y * oa.y + ba.z * oa.z;
  const rdoa = d.x * oa.x + d.y * oa.y + d.z * oa.z, oaoa = oa.x * oa.x + oa.y * oa.y + oa.z * oa.z;
  const A = baba - bard * bard, B = baba * rdoa - baoa * bard, C = baba * oaoa - baoa * baoa - r * r * baba, h = B * B - A * C;
  if (h >= 0 && A > 1e-8) { const t = (-B - Math.sqrt(h)) / A, y = baoa + t * bard; if (y > 0 && y < baba && t >= 0) return t; }
  const ta = raySphere(o, d, a, r), tb = raySphere(o, d, b, r);
  if (ta == null) return tb; if (tb == null) return ta; return Math.min(ta, tb);
}
