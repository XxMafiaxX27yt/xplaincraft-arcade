// REDLINE cars: Rapier ray-cast vehicle (real suspension) + an engine model (torque curve, gears, RPM, rev limiter),
// TURBO (spools above ~4000 rpm), NITRO, PERFECT SHIFT / PERFECT LAUNCH bonuses, handbrake drifts, downforce.
import { V } from '../../kit3d/kit3d.js';

export const CARS = {
  apex: { name: 'APEX GT', model: 'race', col: '#ff3355', mass: 1150, torque: 520, gears: [3.3, 2.25, 1.68, 1.31, 1.06, 0.88], final: 5.32, idle: 950, redline: 8200, turbo: 0.42, drive: 'rwd', grip: 2.0, steer: 0.58, drag: 1.01, blurb: 'balanced rear-drive racer, loves to drift' },
  nova: { name: 'NOVA X', model: 'race-future', col: '#22e6ff', mass: 1100, torque: 470, gears: [3.1, 2.15, 1.62, 1.28, 1.04, 0.86, 0.74], final: 5.25, idle: 1000, redline: 9200, turbo: 0.55, drive: 'rwd', grip: 2.1, steer: 0.55, drag: 0.9, blurb: 'huge turbo, highest top speed, needs revs' },
  razor: { name: 'RAZOR S', model: 'sedan-sports', col: '#ffd93a', mass: 1350, torque: 560, gears: [3.4, 2.3, 1.7, 1.3, 1.04, 0.85], final: 5.4, idle: 900, redline: 7600, turbo: 0.38, drive: 'awd', grip: 2.25, steer: 0.55, drag: 1.12, blurb: 'all-wheel drive, glued to the road' },
  zip: { name: 'ZIP HATCH', model: 'hatchback-sports', col: '#3dffa0', mass: 980, torque: 360, gears: [3.6, 2.5, 1.85, 1.42, 1.12, 0.92], final: 5.85, idle: 1000, redline: 8600, turbo: 0.5, drive: 'fwd', grip: 2.05, steer: 0.62, drag: 1.06, blurb: 'light and nimble, quickest off the line' },
};
const SCALE = 1.72;

export class Car {
  constructor(K3, src, spec, spawn, { ai = false, color = null } = {}) {
    Object.assign(this, { K3, spec, ai });
    const S = K3.scene, R = K3.R;
    // ---------- visual ----------
    this.node = new V.TransformNode('car', S);
    const inst = src.instantiateModelsToScene((n) => n, false, { doNotInstantiate: true });
    const holder = new V.TransformNode('carModel', S); holder.parent = this.node; holder.scaling.setAll(SCALE);
    inst.rootNodes.forEach((r) => (r.parent = holder));
    const all = holder.getChildTransformNodes(false).concat(holder.getChildMeshes(false));
    const find = (n) => all.find((x) => x.name === n || x.name.endsWith(n));
    this.wheels = ['wheel-front-left', 'wheel-front-right', 'wheel-back-left', 'wheel-back-right'].map((n) => find(n));
    holder.computeWorldMatrix(true); all.forEach((x) => x.computeWorldMatrix?.(true));
    this.node.computeWorldMatrix(true);
    const inv = this.node.getWorldMatrix().clone().invert();
    const wpos = this.wheels.map((w) => V.Vector3.TransformCoordinates(w.getAbsolutePosition(), inv));
    // body bounds (car-local)
    let mn = new V.Vector3(1e9, 1e9, 1e9), mx = new V.Vector3(-1e9, -1e9, -1e9);
    holder.getChildMeshes().forEach((m) => { if (this.wheels.some((w) => m === w || m.isDescendantOf?.(w))) return; m.computeWorldMatrix(true); const b = m.getBoundingInfo().boundingBox; [b.minimumWorld, b.maximumWorld].forEach((v) => { const l = V.Vector3.TransformCoordinates(v, inv); mn = V.Vector3.Minimize(mn, l); mx = V.Vector3.Maximize(mx, l); }); });
    this.wheelR = 0.3 * SCALE * 0.95;
    if (color) holder.getChildMeshes().forEach((m) => { if (m.material && !this.wheels.some((w) => m === w || m.isDescendantOf?.(w))) { const c = m.material.clone('paint'); (c.albedoColor || c.diffuseColor)?.copyFrom?.(V.Color3.FromHexString(color).toLinearSpace()); m.material = c; } });
    holder.getChildMeshes().forEach((m) => { m.isPickable = false; if (K3.shadow) K3.shadow.addShadowCaster(m); });
    // ---------- physics ----------
    const half = { x: (mx.x - mn.x) / 2 * 0.92, y: (mx.y - mn.y) / 2 * 0.6, z: (mx.z - mn.z) / 2 * 0.95 }, c = { x: (mx.x + mn.x) / 2, y: mn.y + half.y + 0.15, z: (mx.z + mn.z) / 2 };
    const m = spec.mass;
    const bd = R.RigidBodyDesc.dynamic().setTranslation(spawn.x, spawn.y + 0.6, spawn.z).setCanSleep(false).setAngularDamping(0.6).setLinearDamping(0.02)
      .setAdditionalMassProperties(m, { x: 0, y: c.y - 0.25, z: c.z * 0.5 }, { x: (m / 12) * (4 * half.y * half.y + 4 * half.z * half.z), y: (m / 12) * (4 * half.x * half.x + 4 * half.z * half.z) * 1.1, z: (m / 12) * (4 * half.x * half.x + 4 * half.y * half.y) }, { w: 1, x: 0, y: 0, z: 0 });
    const q = V.Quaternion.FromEulerAngles(0, spawn.yaw, 0); bd.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    this.body = K3.world.createRigidBody(bd);
    // the body collider starts just under the wheel centres, so only the wheels (suspension rays) ever touch the road.
    // (it used to hang 4 cm over the road, scrape it and snag on the seams between road triangles: invisible walls)
    const wheelY = Math.min(...wpos.map((w) => w.y)), bot = Math.max(mn.y + 0.15, wheelY - 0.05), top = Math.max(c.y + half.y, bot + 0.34);
    const hy = (top - bot) / 2, rr = 0.12;   // rounded edges: slides along walls and other cars instead of catching
    this.footprint = { x: c.x, z: c.z, hx: half.x, hz: half.z };   // for the soft online bumps
    this.col = K3.world.createCollider(R.ColliderDesc.roundCuboid(half.x - rr, hy - rr, half.z - rr, rr).setTranslation(c.x, bot + hy, c.z).setDensity(0).setFriction(0.3).setRestitution(0.1).setCollisionGroups(K3.phys.groups(K3.phys.G_CHAR, 0xffff)), this.body);
    const vc = K3.world.createVehicleController(this.body);
    vc.indexUpAxis = 1; vc.setIndexForwardAxis = 2;
    this.rest = 0.38;
    wpos.forEach((p, i) => {
      vc.addWheel({ x: p.x, y: p.y + this.rest, z: p.z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, this.rest, this.wheelR);
      vc.setWheelSuspensionStiffness(i, 34); vc.setWheelSuspensionCompression(i, 3.8); vc.setWheelSuspensionRelaxation(i, 2.6);
      vc.setWheelMaxSuspensionTravel(i, 0.3); vc.setWheelMaxSuspensionForce(i, 60000);
      vc.setWheelFrictionSlip(i, spec.grip); vc.setWheelSideFrictionStiffness(i, 1);
    });
    this.vc = vc; this.wpos = wpos;
    // ---------- state ----------
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false, up: false, down: false };
    this.gear = 1; this.spinT = 0; this.rpm = spec.idle; this.boost = 0; this.nitro = 0.5; this.shiftT = 0; this.perfectT = 0; this.launchT = 0; this.steerA = 0;
    this.auto = true; this.speed = 0; this.drift = 0; this.air = 0; this.limiter = false; this.upsideT = 0; this.spin = [0, 0, 0, 0]; this.events = [];
    this.prev = { p: this.pos(), q: this.rot() };
  }
  pos() { const t = this.body.translation(); return { x: t.x, y: t.y, z: t.z }; }
  rot() { const r = this.body.rotation(); return { x: r.x, y: r.y, z: r.z, w: r.w }; }
  forward() { const q = this.rot(); return rotate(q, { x: 0, y: 0, z: 1 }); }
  // put the car somewhere (start grid, reset after a crash)
  place(p, yaw) {
    const q = V.Quaternion.FromEulerAngles(0, yaw, 0);
    this.body.setTranslation({ x: p.x, y: p.y + 0.7, z: p.z }, true); this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.gear = 1; this.boost = 0; this.rpm = this.spec.idle; this.shiftT = 0; this.prev = { p: this.pos(), q: this.rot() };
  }
  // engine force for the current rpm / gear / extras
  engineForce(thr) {
    const s = this.spec, r = this.rpm / s.redline;
    const curve = r < 0.15 ? 0.55 : r < 0.72 ? 0.55 + (r - 0.15) * (0.45 / 0.57) : 1 - (r - 0.72) * 0.6;   // rises to a peak at ~72% of redline
    let T = s.torque * curve * thr;
    T *= 1 + s.turbo * this.boost;
    const ratio = this.gear > 0 ? s.gears[this.gear - 1] : -3.2;
    let F = (T * ratio * s.final * 0.86) / this.wheelR;
    if (this.nitroOn) F *= 1.55;
    if (this.perfectT > 0) F *= 1.18;
    if (this.launchT > 0) F *= 1.3;
    return F;
  }
  step(dt, race) {
    const s = this.spec, I = this.input, vc = this.vc;
    this.prev = { p: this.pos(), q: this.rot() };
    const lv = this.body.linvel(), fwd = this.forward(), v = lv.x * fwd.x + lv.y * fwd.y + lv.z * fwd.z, sp = Math.hypot(lv.x, lv.y, lv.z);
    this.speed = v;
    const grounded = [0, 1, 2, 3].filter((i) => vc.wheelIsInContact(i)).length;
    // ---------- gearbox ----------
    if (this.shiftT > 0) this.shiftT -= dt;
    const wheelRpm = (Math.abs(v) / (2 * Math.PI * this.wheelR)) * 60;
    const ratio = this.gear > 0 ? s.gears[this.gear - 1] * s.final : 3.2 * s.final;
    let rpm = wheelRpm * ratio;
    if (race.countdown) {
      // on the grid: revs climb while you hold gas and fall when you let go - tap to hold the needle in the green zone.
      // AUTO gearbox = launch assist: the revs park in the green zone by themselves.
      const top = this.auto ? s.redline * 0.72 : s.redline + 100;
      rpm = this.rpm + (I.throttle > 0.1 ? 1 : -1.3) * dt * 5200;
      rpm = Math.max(s.idle, Math.min(top, rpm));
      this.rpm = rpm;
    }
    else if (this.gear === 1 && rpm < s.idle + 3200 * I.throttle) rpm = rpm + (s.idle + 3200 * I.throttle - rpm) * 0.6;   // clutch slip off the line
    if (!race.countdown) this.rpm += (Math.max(s.idle, Math.min(s.redline + 150, rpm)) - this.rpm) * Math.min(1, dt * 14);
    const up = () => { if (this.gear < s.gears.length && this.shiftT <= 0) { const perfect = this.rpm > s.redline * 0.86 && this.rpm <= s.redline + 100; this.gear++; this.shiftT = 0.16; if (perfect && !this.auto) { this.perfectT = 1.2; this.events.push('perfect'); } else this.events.push('shift'); } };
    const down = () => { if (this.gear > 1 && this.shiftT <= 0) { this.gear--; this.shiftT = 0.14; this.events.push('down'); } };
    if (this.auto) { if (this.rpm > s.redline - 350 && I.throttle > 0.2 && grounded >= 2) up(); else if (this.rpm < s.redline * 0.42 && this.gear > 1) down(); }
    else { if (I.up) up(); if (I.down) down(); }
    // reverse: hold brake when (almost) stopped
    if (I.brake > 0.5 && v < 0.8 && I.throttle < 0.1 && !race.countdown) this.gear = -1;
    else if (this.gear === -1 && (I.throttle > 0.1 || I.brake < 0.5)) this.gear = 1;
    // ---------- turbo ----------
    const wasBoost = this.boost;
    if (I.throttle > 0.5 && this.rpm > 4000) this.boost = Math.min(1, this.boost + dt * (0.6 + (this.rpm - 4000) / 4000));
    else this.boost = Math.max(0, this.boost - dt * (I.throttle > 0.5 ? 0.6 : 2.6));
    if (wasBoost > 0.45 && I.throttle < 0.3 && this.lastThrottle >= 0.5) this.events.push('blowoff');
    this.lastThrottle = I.throttle;
    // ---------- nitro ----------
    this.nitroOn = I.nitro && this.nitro > 0.01 && !race.countdown && I.throttle > 0.1;
    if (this.nitroOn) this.nitro = Math.max(0, this.nitro - dt * 0.24);
    // ---------- drive ----------
    this.limiter = this.rpm >= s.redline && this.gear > 0;
    let thr = race.countdown || race.done ? 0 : I.throttle;
    if (this.limiter && Math.floor(performance.now() / 60) % 2) thr = 0;   // rev limiter bounce
    if (this.shiftT > 0) thr = 0;
    // traction control (AI always, you in AUTO): ease off the power while the driven wheels are sliding
    if ((this.ai || this.auto) && this.slip > 0.16 && Math.abs(v) > 5 && !I.handbrake) thr *= Math.max(0.35, 1 - (this.slip - 0.16) * 3);
    let F = this.engineForce(thr);
    if (this.gear === -1) F = I.brake > 0.5 ? -this.engineForce(I.brake) * 0.5 : 0;
    const driven = s.drive === 'rwd' ? [2, 3] : s.drive === 'fwd' ? [0, 1] : [0, 1, 2, 3];
    for (let i = 0; i < 4; i++) vc.setWheelEngineForce(i, driven.includes(i) ? F / driven.length : 0);
    // brakes + handbrake (rear grip drops -> drift)
    const brake = this.gear === -1 ? 0 : I.brake * 38;
    for (let i = 0; i < 4; i++) vc.setWheelBrake(i, brake + (I.handbrake && i >= 2 ? 22 : 0));
    if (this.spinT > 0) this.spinT -= dt;
    const spinK = this.spinT > 0 ? 0.5 : 1, rearGrip = (I.handbrake ? s.grip * 0.42 : s.grip) * spinK;
    vc.setWheelFrictionSlip(0, s.grip * spinK); vc.setWheelFrictionSlip(1, s.grip * spinK);
    vc.setWheelFrictionSlip(2, rearGrip); vc.setWheelFrictionSlip(3, rearGrip);
    // arcade drift stability: the car can rotate into a slide but not spin round; let go of the handbrake and it straightens up
    const av = this.body.angvel(), maxYaw = I.handbrake ? 2.0 : 1.6;
    if (Math.abs(av.y) > maxYaw) this.body.setAngvel({ x: av.x, y: Math.sign(av.y) * maxYaw, z: av.z }, true);
    if (!I.handbrake && this.slip > 0.35 && Math.abs(v) > 8) this.body.setAngvel({ x: av.x, y: av.y * (1 - dt * 2.5), z: av.z }, true);
    // steering: less lock at speed, eased
    const maxA = s.steer * (1 - Math.min(0.68, Math.abs(v) / 65));
    const want = I.steer * maxA;
    this.steerA += Math.max(-dt * 3.2, Math.min(dt * 3.2, want - this.steerA));
    vc.setWheelSteering(0, this.steerA); vc.setWheelSteering(1, this.steerA);
    // downforce + air drag (top speed comes from here)
    const df = 3.2 * sp * sp, drag = s.drag * sp * sp * (this.nitroOn ? 0.75 : 1);
    this.body.applyImpulse({ x: -lv.x / (sp || 1) * drag * dt, y: -df * dt * (grounded ? 1 : 0.2), z: -lv.z / (sp || 1) * drag * dt }, true);
    vc.updateVehicle(dt, undefined, this.K3.phys.groups(this.K3.phys.G_CHAR, this.K3.phys.G_WORLD));
    // ---------- drift / air / slipstream: refill nitro ----------
    const right = rotate(this.rot(), { x: 1, y: 0, z: 0 }), lat = lv.x * right.x + lv.z * right.z;
    this.slip = Math.atan2(Math.abs(lat), Math.abs(v) + 0.1);
    this.drift = grounded >= 2 && sp > 12 && this.slip > 0.22 ? this.slip : 0;
    if (this.drift) this.nitro = Math.min(1, this.nitro + dt * 0.16 * Math.min(2, this.drift * 3));
    this.air = grounded === 0 ? this.air + dt : 0;
    if (this.air > 0.25) this.nitro = Math.min(1, this.nitro + dt * 0.25);
    if (this.perfectT > 0) this.perfectT -= dt;
    if (this.launchT > 0) this.launchT -= dt;
    // flipped or stuck on its side for 2 s: back on the road
    const upv = rotate(this.rot(), { x: 0, y: 1, z: 0 });
    this.upsideT = upv.y < 0.3 ? this.upsideT + dt : 0;
    if (this.upsideT > 2) { this.upsideT = 0; this.events.push('reset'); }
    // wheel spin for the visuals
    for (let i = 0; i < 4; i++) this.spin[i] += (v / this.wheelR) * dt * (driven.includes(i) && this.nitroOn ? 1.1 : 1);
  }
  // online: someone else drives this car - it follows the network (kinematic: solid, but not simulated here)
  setRemote(on, vel = null) {
    const R = this.K3.R;
    this.remote = on;
    this.body.setBodyType(on ? R.RigidBodyType.KinematicPositionBased : R.RigidBodyType.Dynamic, true);
    // a car following the network can't be pushed (infinite mass): touching it would stop you like a wall.
    // So it is not solid here - the game gives soft bumps instead (bumpCircles)
    this.col.setSensor(on);
    if (!on && vel) this.body.setLinvel(vel, true);
  }
  follow(p, q, dt) {
    this.prev = { p: this.pos(), q: this.rot() };
    this.body.setNextKinematicTranslation(p); this.body.setNextKinematicRotation(q);
    for (let i = 0; i < 4; i++) this.spin[i] += (this.speed / this.wheelR) * dt;
  }
  // two circles (front + back) covering the car on the ground, in world space: cheap, soft car-to-car bumps
  bumpCircles() {
    const F = this.footprint, p = this.pos(), q = this.rot(), r = F.hx * 0.95, d = Math.max(0, F.hz - r);
    const c = rotate(q, { x: F.x, y: 0, z: F.z }), f = rotate(q, { x: 0, y: 0, z: 1 }), l = Math.hypot(f.x, f.z) || 1;
    return [-1, 1].map((k) => ({ x: p.x + c.x + (f.x / l) * d * k, z: p.z + c.z + (f.z / l) * d * k, r, y: p.y }));
  }
  // launch: called at GREEN - revs in the green band = perfect launch, too many = wheelspin
  launch() {
    const r = this.rpm / this.spec.redline;
    if (r > 0.6 && r < 0.84) { this.launchT = 1.1; this.events.push('launch'); }
    else if (r >= 0.84) { this.launchT = 0; this.spinT = 0.7; this.events.push('spin'); }   // too many revs: wheelspin (grip comes back in step)
  }
  // sync the model with the physics (interpolated)
  render(alpha) {
    const p0 = this.prev.p, p1 = this.pos(), q0 = this.prev.q, q1 = this.rot();
    this.node.position.set(p0.x + (p1.x - p0.x) * alpha, p0.y + (p1.y - p0.y) * alpha, p0.z + (p1.z - p0.z) * alpha);
    this.node.rotationQuaternion = V.Quaternion.Slerp(new V.Quaternion(q0.x, q0.y, q0.z, q0.w), new V.Quaternion(q1.x, q1.y, q1.z, q1.w), alpha);
    this.wheels.forEach((w, i) => {
      if (!w) return;
      const susp = this.remote ? this.rest - 0.05 : this.vc.wheelSuspensionLength(i) ?? this.rest;
      w.position.y = (this.wpos[i].y + this.rest - susp) / SCALE;
      w.rotationQuaternion = null;
      w.rotation.set(this.spin[i], i < 2 ? this.steerA : 0, 0);
    });
  }
  dispose() { this.K3.world.removeVehicleController?.(this.vc); this.K3.world.removeRigidBody(this.body); this.node.dispose(); this.sound?.stop(); }
}

export function rotate(q, v) {
  const ix = q.w * v.x + q.y * v.z - q.z * v.y, iy = q.w * v.y + q.z * v.x - q.x * v.z, iz = q.w * v.z + q.x * v.y - q.y * v.x, iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  return { x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x };
}

// ---------- engine sound: two detuned oscillators through a filter that opens with the revs, turbo whistle, tyre screech ----------
export class EngineSound {
  constructor(raw, { main = true } = {}) {
    const { ac, out } = raw; this.ac = ac;
    this.g = ac.createGain(); this.g.gain.value = 0; this.g.connect(out);
    this.f = ac.createBiquadFilter(); this.f.type = 'lowpass'; this.f.Q.value = 3; this.f.connect(this.g);
    this.o1 = ac.createOscillator(); this.o1.type = 'sawtooth'; this.o2 = ac.createOscillator(); this.o2.type = 'square'; this.o2.detune.value = 8;
    const g2 = ac.createGain(); g2.gain.value = 0.5; this.o2.connect(g2).connect(this.f); this.o1.connect(this.f);
    this.o1.start(); this.o2.start();
    this.main = main;
    if (main) {
      this.wg = ac.createGain(); this.wg.gain.value = 0; this.wg.connect(out);
      this.w = ac.createOscillator(); this.w.type = 'sine'; this.w.connect(this.wg); this.w.start();
      // noise source for tyre screech
      const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.n = ac.createBufferSource(); this.n.buffer = buf; this.n.loop = true;
      this.nf = ac.createBiquadFilter(); this.nf.type = 'bandpass'; this.nf.frequency.value = 1400; this.nf.Q.value = 1.2;
      this.ng = ac.createGain(); this.ng.gain.value = 0; this.n.connect(this.nf).connect(this.ng).connect(out); this.n.start();
    }
  }
  update(car, vol = 1) {
    const t = this.ac.currentTime, s = car.spec, r = car.rpm;
    const f = (r / 60) * 3;   // firing frequency of a 6-cylinder
    this.o1.frequency.setTargetAtTime(f, t, 0.03); this.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    this.f.frequency.setTargetAtTime(300 + (r / s.redline) * 2600 * (0.4 + car.input.throttle * 0.6), t, 0.05);
    this.g.gain.setTargetAtTime((0.05 + car.input.throttle * 0.06) * vol * (car.limiter ? 0.7 : 1), t, 0.05);
    if (this.main) {
      this.w.frequency.setTargetAtTime(2200 + car.boost * 2600, t, 0.05);
      this.wg.gain.setTargetAtTime(car.boost * 0.018 * car.input.throttle * vol, t, 0.08);
      this.ng.gain.setTargetAtTime((car.drift ? Math.min(0.09, car.drift * 0.18) : 0) * vol, t, 0.05);
    }
  }
  blowoff() { const ac = this.ac, b = ac.createBuffer(1, ac.sampleRate * 0.35, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const g = ac.createGain(); g.gain.value = 0.08; s.connect(f).connect(g).connect(this.g.context.destination); s.start(); }
  stop() { try { this.o1.stop(); this.o2.stop(); this.w?.stop(); this.n?.stop(); } catch (e) {} this.g.disconnect(); }
}
