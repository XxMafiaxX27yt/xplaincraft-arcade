// Bots: a navigation graph sampled from the real colliders, A* paths, and a brain with human-like limits
// (reaction time, turn speed, aim error that settles, memory of where you were, hearing gunshots).
import { WEAPONS, curW } from './weapons.js';

export const DIFF = {
  easy: { react: [0.4, 0.55], turn: 4.2, err: 0.075, settle: 0.55, head: 0.08, strafe: 0.35, fov: 1.9 },
  normal: { react: [0.275, 0.4], turn: 7, err: 0.045, settle: 0.4, head: 0.18, strafe: 0.65, fov: 2.2 },
  hard: { react: [0.2, 0.275], turn: 10, err: 0.025, settle: 0.28, head: 0.32, strafe: 0.9, fov: 2.5 },
};

// ---------- navigation graph ----------
export function buildNav(K3, area) {
  const R = K3.R, W = K3.world;
  W.updateSceneQueries();
  const nodes = [], cell = new Map();
  const capsule = new R.Capsule(0.45, 0.36), rot = { x: 0, y: 0, z: 0, w: 1 }, grp = K3.phys.groups(0xffff, K3.phys.G_WORLD);
  const free = (x, y, z) => !W.intersectionWithShape({ x, y: y + 0.95, z }, rot, capsule, undefined, grp);
  for (let x = -area.x + 0.5; x <= area.x - 0.5; x += 1) for (let z = -area.z + 0.5; z <= area.z - 0.5; z += 1) {
    let y0 = 9;
    for (let lvl = 0; lvl < 4; lvl++) {
      const h = K3.phys.ray({ x, y: y0, z }, { x: 0, y: -1, z: 0 }, 12);
      if (!h) break;
      if (h.dist < 0.01) { y0 -= 0.5; continue; }        // started inside something: step down
      const y = h.point.y;
      if (h.normal.y > 0.7 && y < 3.4 && free(x, y + 0.05, z)) {
        const n = { i: nodes.length, x, y, z, nb: [] }; nodes.push(n);
        const key = `${Math.round(x * 2)},${Math.round(z * 2)}`; (cell.get(key) || cell.set(key, []).get(key)).push(n);
      }
      y0 = y - 0.6;
      if (y0 < -0.5) break;
    }
  }
  for (const n of nodes) for (const [dx, dz] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    for (const m of cell.get(`${Math.round((n.x + dx) * 2)},${Math.round((n.z + dz) * 2)}`) || []) {
      const dy = Math.abs(m.y - n.y); if (dy > (dx && dz ? 0.75 : 0.55)) continue;
      if (!free((n.x + m.x) / 2, Math.max(n.y, m.y) + 0.05, (n.z + m.z) / 2)) continue;
      const d = Math.hypot(m.x - n.x, m.y - n.y, m.z - n.z); n.nb.push([m, d]); m.nb.push([n, d]);
    }
  }
  // keep the biggest connected piece (drops crate tops and roofs nobody can reach)
  let best = [], seen = new Set();
  for (const n of nodes) {
    if (seen.has(n)) continue;
    const comp = [], st = [n]; seen.add(n);
    while (st.length) { const a = st.pop(); comp.push(a); for (const [b] of a.nb) if (!seen.has(b)) { seen.add(b); st.push(b); } }
    if (comp.length > best.length) best = comp;
  }
  const keep = new Set(best);
  best.forEach((n, i) => { n.i = i; n.nb = n.nb.filter(([m]) => keep.has(m)); });
  const nearest = (p, maxDy = 2.2) => { let b = null, bd = 1e9; for (const n of best) { const dy = Math.abs(n.y - p.y); if (dy > maxDy) continue; const d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2 + dy * dy * 4; if (d < bd) { bd = d; b = n; } } return b; };
  const path = (from, to) => {
    const a = nearest(from), b = nearest(to); if (!a || !b) return null;
    const g = new Map([[a, 0]]), came = new Map(), open = [[Math.hypot(b.x - a.x, b.z - a.z), a]], closed = new Set();
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, cur] = open.splice(bi, 1)[0];
      if (cur === b) { const out = [cur]; let c = cur; while (came.has(c)) { c = came.get(c); out.push(c); } return out.reverse(); }
      if (closed.has(cur)) continue; closed.add(cur);
      for (const [m, d] of cur.nb) { const ng = g.get(cur) + d; if (ng < (g.get(m) ?? 1e9)) { g.set(m, ng); came.set(m, cur); open.push([ng + Math.hypot(b.x - m.x, b.y - m.y, b.z - m.z), m]); } }
    }
    return null;
  };
  return { nodes: best, nearest, path };
}

// ---------- the brain ----------
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export class Brain {
  constructor(game, f, diff = 'normal') {
    Object.assign(this, { game, f, D: DIFF[diff] || DIFF.normal });
    this.mem = new Map(); this.path = null; this.pi = 0; this.repath = 0; this.target = null; this.reactT = 0; this.err = 0; this.onT = 0;
    this.strafeT = 0; this.strafeDir = 1; this.shootGap = 0; this.stuckT = 0; this.lastPos = null; this.goal = null; this.aimOff = { x: 0, y: 0 };
  }
  hear(pos, who) { if (who.team !== this.f.team) this.mem.set(who, { x: pos.x, y: pos.y, z: pos.z, t: this.game.time, heard: true }); }
  canSee(e) {
    const f = this.f, eye = f.eye(), hb = e.hitboxes();
    const dx = hb.head.x - eye.x, dz = hb.head.z - eye.z, dist = Math.hypot(dx, dz);
    if (dist > 60) return false;
    const ang = Math.abs(wrap(Math.atan2(dx, dz) - f.yaw));
    const aware = this.mem.has(e) && this.game.time - this.mem.get(e).t < 2;
    if (ang > this.D.fov / 2 && !aware && dist > 3) return false;
    for (const p of [hb.head, { x: hb.body.b.x, y: (hb.body.a.y + hb.body.b.y) / 2, z: hb.body.b.z }]) {
      const d = { x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z }, l = Math.hypot(d.x, d.y, d.z);
      const h = this.game.K3.phys.ray(eye, { x: d.x / l, y: d.y / l, z: d.z / l }, l, { exclude: this.game.barrierCollider?.(this.f) });
      if (!h || h.dist > l - 0.3) return p;
    }
    return false;
  }
  tick(dt) {
    const f = this.f, G = this.game, I = f.input;
    I.fire = false; I.fireTap = false; I.jump = false; I.reload = false; I.swap = -1; I.ability = false; I.sprint = false;
    if (!f.alive || G.phase !== 'live') { I.move = { x: 0, y: 0 }; I.aim = false; I.crouch = false; return; }
    const D = this.D, me = f.eye();
    // perception (10 Hz)
    this.look = (this.look || 0) - dt;
    if (this.look <= 0) {
      this.look = 0.1;
      let best = null, bd = 1e9;
      for (const e of G.fighters) {
        if (e.team === f.team || !e.alive) continue;
        const p = this.canSee(e);
        if (p) { this.mem.set(e, { ...e.feet(), t: G.time, seen: p }); const d = Math.hypot(e.feet().x - me.x, e.feet().z - me.z); if (d < bd) { bd = d; best = e; } }
      }
      if (best !== this.target) { this.target = best; if (best) { this.reactT = D.react[0] + Math.random() * (D.react[1] - D.react[0]); this.err = D.err * (0.8 + Math.random() * 0.8); this.onT = 0; this.aimHead = Math.random() < D.head; const a = Math.random() * 6.28; this.aimOff = { x: Math.cos(a), y: Math.sin(a) }; } }
    }
    const W = curW(f.arms), wid = f.arms.list[f.arms.cur], ammo = f.arms.ammo[wid];
    const T = this.target && this.target.alive ? this.target : null;
    if (T) {
      this.reactT -= dt; this.onT += dt;
      this.err *= Math.pow(0.5, dt / D.settle);
      const hb = T.hitboxes(), head = this.aimHead;
      const pt = head ? hb.head : { x: hb.body.a.x, y: (hb.body.a.y + hb.body.b.y) / 2 + 0.1, z: hb.body.a.z };
      const dx = pt.x - me.x, dy = pt.y - me.y, dz = pt.z - me.z, dist = Math.hypot(dx, dz);
      const wantYaw = Math.atan2(dx, dz) + this.aimOff.x * this.err, wantPitch = -Math.atan2(dy, dist) + this.aimOff.y * this.err;
      const turn = D.turn * dt;
      const ey = wrap(wantYaw - f.yaw), ep = wantPitch - f.pitch;
      f.yaw += Math.max(-turn, Math.min(turn, ey)); f.pitch += Math.max(-turn, Math.min(turn, ep));
      const off = Math.hypot(wrap(wantYaw - f.yaw), wantPitch - f.pitch);
      // weapon choice by range
      const prim = f.arms.list[0], primW = WEAPONS[prim], primAmmo = f.arms.ammo[prim];
      let want = 0;
      if (prim === 'marksman' && dist < 6) want = 1;
      if (prim === 'shotgun' && dist > 17) want = 1;
      if (primAmmo === 0 && f.arms.ammo.pistol > 0 && dist < 25) want = 1;
      if ((f.arms.ammo.pistol === 0 && primAmmo === 0 && dist < 6) || dist < 1.8) want = 2;
      if (want !== f.arms.cur && f.arms.swapT <= 0) I.swap = want;
      // shoot
      const scoped = W.scope;
      I.aim = scoped ? dist > 7 : dist > 14 && wid !== 'shotgun';
      const settled = scoped ? f.arms.zoom > 0.95 || dist <= 7 : true;
      const tol = Math.max(0.02, 0.5 / Math.max(2, dist));
      this.shootGap -= dt;
      if (this.reactT <= 0 && off < tol && settled && (W.melee ? dist < 2.4 : true)) {
        if (W.auto) I.fire = true;
        else if (this.shootGap <= 0) { I.fireTap = true; I.fire = true; this.shootGap = (wid === 'pistol' ? 0.22 : 0.85) + Math.random() * 0.15; }
      }
      if (ammo === 0 && !W.melee) I.reload = true;
      // move: strafe, keep a good distance for the weapon, crouch-peek with the marksman
      const pref = wid === 'shotgun' ? 3.5 : wid === 'knife' ? 1 : wid === 'marksman' ? 18 : wid === 'pistol' ? 9 : 10;
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = 0.35 + Math.random() * 0.8; this.strafeDir = Math.random() < 0.5 ? -1 : 1; }
      const fwd = dist > pref + 3 ? 1 : dist < pref - 2 ? -0.7 : 0;
      I.move = { x: this.strafeDir * D.strafe * (scoped && f.arms.zoom > 0.5 ? 0.3 : 1), y: fwd };
      I.crouch = scoped && f.arms.zoom > 0.5 && this.onT % 3 < 1.4;
      // abilities: shotgun dashes in, anyone hurt throws a barrier
      if (f.abilityKind === 'dash' && wid === 'shotgun' && dist > 5 && dist < 11 && Math.random() < dt) I.ability = true;
      if (f.abilityKind === 'barrier' && f.hp < 45 && Math.random() < dt * 2) I.ability = true;
      if (f.hp < 30 && Math.random() < dt * 0.6) this.goal = this.coverFrom(T);
      if (!this.goal) { this.follow(dt, null, true); return; }
    } else {
      this.aimHead = false;
      if (ammo < (W.mag || 0) * 0.5 && !W.melee) I.reload = true;
      if (f.arms.cur !== 0 && f.arms.ammo[f.arms.list[0]] > 0) I.swap = 0;
      I.aim = false; I.crouch = false;
    }
    // go somewhere: last known enemy, the zone, or toward the enemy side
    let goal = this.goal;
    if (!goal) {
      let mem = null;
      for (const [e, m] of this.mem) if (e.alive && G.time - m.t < 6 && (!mem || m.t > mem.t)) mem = m;
      goal = mem || G.roamGoal(f);
    }
    if (G.zone && Math.hypot(me.x - G.zone.x, me.z - G.zone.z) > G.zone.r - 2) goal = { x: G.zone.x, y: 0, z: G.zone.z };
    this.follow(dt, goal, !!T);
    if (this.goal && Math.hypot(me.x - this.goal.x, me.z - this.goal.z) < 1.2) this.goal = null;
  }
  // walk a path toward goal (or just hold the strafe input when fighting)
  follow(dt, goal, fighting) {
    const f = this.f, I = f.input, G = this.game, p = f.feet();
    if (!goal || !G.nav) return;
    this.repath -= dt;
    if (!this.path || this.repath <= 0 || this.pi >= this.path.length) { this.path = G.nav.path(p, goal); this.pi = 1; this.repath = 0.8 + Math.random() * 0.4; }
    if (!this.path || this.path.length < 2) { return; }
    let n = this.path[Math.min(this.pi, this.path.length - 1)];
    if (Math.hypot(n.x - p.x, n.z - p.z) < 0.7 && this.pi < this.path.length - 1) { this.pi++; n = this.path[this.pi]; }
    const dx = n.x - p.x, dz = n.z - p.z, l = Math.hypot(dx, dz) || 1;
    // turn the wish direction into the fighter's local move input
    const s = Math.sin(f.yaw), c = Math.cos(f.yaw);
    const mx = (dx / l) * c - (dz / l) * s, my = (dx / l) * s + (dz / l) * c;
    if (fighting) { I.move = { x: K(I.move.x * 0.6 + mx * 0.6), y: K(I.move.y * 0.4 + my * 0.8) }; }
    else {
      I.move = { x: mx, y: my };
      const wantYaw = Math.atan2(dx, dz), ey = wrap(wantYaw - f.yaw), turn = this.D.turn * 0.6 * dt;
      f.yaw += Math.max(-turn, Math.min(turn, ey)); f.pitch *= 0.9;
      I.sprint = Math.abs(ey) < 0.4 && l > 2;
    }
    // stuck? hop and repath
    if (this.lastPos && Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z) < 0.02) { this.stuckT += dt; if (this.stuckT > 0.6) { I.jump = true; this.repath = 0; this.stuckT = 0; } } else this.stuckT = 0;
    this.lastPos = p;
  }
  // a nearby spot the enemy cannot see
  coverFrom(e) {
    const G = this.game, me = this.f.feet(), ep = e.eye();
    let best = null, bd = 1e9;
    for (const n of G.nav.nodes) {
      const d = Math.hypot(n.x - me.x, n.z - me.z); if (d > 9 || d < 2 || d > bd) continue;
      const v = { x: n.x - ep.x, y: n.y + 1.2 - ep.y, z: n.z - ep.z }, l = Math.hypot(v.x, v.y, v.z);
      const h = G.K3.phys.ray(ep, { x: v.x / l, y: v.y / l, z: v.z / l }, l);
      if (h && h.dist < l - 0.5) { best = n; bd = d; }
    }
    return best;
  }
}
const K = (v) => Math.max(-1, Math.min(1, v));
