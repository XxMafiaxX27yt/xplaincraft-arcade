// FOUNDRY - the NOVEX STRIKE arena. 44 x 30 m, mirrored across x = 0 so both teams get the same map.
//   spawns at x = -17 (team A, cyan) and x = +17 (team B, magenta)
//   north lane (z +5..+13): tight indoor block (x 3..13 each side) with rooms, doorways, a courtyard between
//   middle (z -5..+5): open floor with offset cover
//   south lane (z -13..-5): ramps up to an exposed metal catwalk at 3 m (two ways up), cover under and beside it
//   bent tunnels (rubber floor = quiet steps) from each spawn into the south lane
//   outer rooms behind the spawns and corridors along the long edges: open in 2v2, shutters close them in 1v1 (~38 x 26)
// Every box is a mesh AND a Rapier collider: what you see is exactly what you collide with.
import { V, canvasTexture } from '../../kit3d/kit3d.js';

export const ARENA = { w: 44, d: 30 };
export const CATWALK = { y: 3, z: -10, w: 2.6, x: 7 };

export function buildArena(K3, mode = '2v2') {
  const S = K3.scene;
  const mats = makeMaterials(K3);
  const parts = {};
  const surf = new Map();
  const boxes = [];
  const add = (mat, x, y, z, w, h, d, { rot = null, surface = 'concrete', collide = true, uvScale = 0.5 } = {}) => {
    const faceUV = [
      new V.Vector4(0, 0, w * uvScale, h * uvScale), new V.Vector4(0, 0, w * uvScale, h * uvScale),
      new V.Vector4(0, 0, d * uvScale, h * uvScale), new V.Vector4(0, 0, d * uvScale, h * uvScale),
      new V.Vector4(0, 0, w * uvScale, d * uvScale), new V.Vector4(0, 0, w * uvScale, d * uvScale),
    ];
    const m = V.CreateBox('b', { width: w, height: h, depth: d, faceUV, wrap: true }, S);
    m.position.set(x, y, z);
    let q = null;
    if (rot) { m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0); const qq = V.Quaternion.FromEulerAngles(rot[0] || 0, rot[1] || 0, rot[2] || 0); q = { x: qq.x, y: qq.y, z: qq.z, w: qq.w }; }
    (parts[mat] = parts[mat] || []).push(m);
    if (collide) { const c = K3.phys.box(x, y, z, w / 2, h / 2, d / 2, q, { surface }); surf.set(c.handle, surface); boxes.push({ x, y, z, w, h, d, rot }); }
    return m;
  };
  // build the west half; the east half is the mirror image (x -> -x)
  const both = (mat, x, y, z, w, h, d, o = {}) => { add(mat, x, y, z, w, h, d, o); add(mat, -x, y, z, w, h, d, o.rot ? { ...o, rot: [o.rot[0] || 0, -(o.rot[1] || 0), -(o.rot[2] || 0)] } : o); };
  const W = ARENA.w / 2, D = ARENA.d / 2;

  // ---------- floor + outer walls ----------
  add('floor', 0, -0.25, 0, ARENA.w + 2, 0.5, ARENA.d + 2, { uvScale: 0.25 });
  add('wall', 0, 3, D + 0.5, ARENA.w + 2, 6, 1); add('wall', 0, 3, -D - 0.5, ARENA.w + 2, 6, 1);
  add('wall', W + 0.5, 3, 0, 1, 6, ARENA.d + 2); add('wall', -W - 0.5, 3, 0, 1, 6, ARENA.d + 2);

  // ---------- the outer ring (2v2): back rooms (|x| > 19) and edge corridors (|z| > 13) ----------
  for (const sx of [-1, 1]) {
    add('wall2', 19 * sx, 2.25, 0, 0.5, 4.5, 18);                                     // z -9..9
    add('wall2', 19 * sx, 2.25, 12.25, 0.5, 4.5, 1.5); add('wall2', 19 * sx, 2.25, -12.25, 0.5, 4.5, 1.5);   // doorways at |z| 9..11.5
  }
  for (const sz of [-1, 1]) {
    add('wall2', 0, 2.25, 13 * sz, 28, 4.5, 0.5);                                     // x -14..14
    both('wall2', -17.5, 2.25, 13 * sz, 3, 4.5, 0.5);                                 // x -19..-16 (doorways at |x| 14..16)
  }
  // 1v1: shutters close the ring (separate meshes + colliders, switched on by setMode)
  const shutters = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const [x, z, w, d] of [[19 * sx, 10.25 * sz, 0.4, 2.5], [15 * sx, 13 * sz, 2, 0.4]]) {
    const m = V.CreateBox('shutter', { width: w, height: 4.5, depth: d }, S); m.position.set(x, 2.25, z); m.material = mats.shutter; m.isPickable = false;
    const c = K3.phys.box(x, 2.25, z, w / 2, 2.25, d / 2, null, { surface: 'metal' }); surf.set(c.handle, 'metal');
    shutters.push({ m, c });
  }

  // ---------- north lane: the indoor block, x -13..-3 (mirrored), z 5..13, roof at 3.4 ----------
  both('wall', -13, 1.7, 6.25, 0.5, 3.4, 2.5);       // west face, z 5..7.5
  both('wall', -13, 1.7, 11, 0.5, 3.4, 4);           // west face, z 9..13   (doorway z 7.5..9 from the spawn side)
  both('wall', -11, 1.7, 5, 4, 3.4, 0.5);            // south face, x -13..-9
  both('wall', -5, 1.7, 5, 4, 3.4, 0.5);             // south face, x -7..-3  (doorway x -9..-7 from the middle)
  both('wall', -3, 1.7, 10.5, 0.5, 3.4, 5);          // east face, z 8..13    (doorway z 5..8 into the courtyard)
  both('wall2', -8.5, 1.7, 11.25, 0.4, 3.4, 3.5);    // inside: partition, z 9.5..13
  both('crate', -11, 0.5, 11.8, 2.4, 1, 0.9);        // inside: a counter
  both('roof', -8, 3.55, 9, 10.6, 0.3, 8.6);
  add('pillar', 0, 1.6, 9.5, 1.4, 3.2, 1.4);         // the courtyard pillar

  // ---------- middle: offset cover ----------
  both('crate', -3.2, 1, 1.8, 1.4, 2, 1.4);           // tall crates
  both('cover', -6.8, 0.55, -1.6, 3.2, 1.1, 0.7);    // low walls (crouch behind them)
  both('crate', -10.5, 0.6, 2.8, 1.2, 1.2, 1.2);
  both('cover', -14, 1, 0.5, 0.7, 2, 3.4);           // wall in front of each spawn
  add('cover', 0, 0.55, -3.1, 2.4, 1.1, 0.7);        // centre low wall, offset south

  // ---------- south lane: two ramps up to the catwalk (x -7..7 at 3 m) ----------
  const C = CATWALK;
  add('metal', 0, C.y - 0.15, C.z, C.x * 2, 0.3, C.w, { surface: 'metal' });
  const run = 7, len = Math.hypot(run, C.y), ang = Math.atan2(C.y, run);
  both('metal', -(C.x + run / 2) + 0.15 * Math.sin(ang), C.y / 2 - 0.15 * Math.cos(ang), C.z, len, 0.3, C.w, { rot: [0, 0, ang], surface: 'metal' });
  // knee-high railings: standing players are exposed up there, crouching ones are hidden
  add('rail', 0, C.y + 0.45, C.z - C.w / 2 + 0.05, C.x * 2, 0.9, 0.1, { surface: 'metal' });
  add('rail', 0, C.y + 0.45, C.z + C.w / 2 - 0.05, C.x * 2, 0.9, 0.1, { surface: 'metal' });
  for (const x of [-6, -2, 2, 6]) add('pillar', x, (C.y - 0.3) / 2, C.z, 0.4, C.y - 0.3, 0.4);
  both('crate', -5, 0.6, -6.4, 1.6, 1.2, 1.2);       // cover against the catwalk
  add('cover', 0, 0.55, -12.2, 2.6, 1.1, 0.7);
  both('crate', -16.5, 0.7, -11.2, 1.4, 1.4, 1.4);

  // ---------- bent tunnels: in from the north at x -18..-16, down to z -7, then east out at x -12.5 ----------
  const TH = 2.7;
  both('tunnel', -18.2, TH / 2, -5, 0.4, TH, 4.4);          // west wall, z -7.2..-2.8
  both('tunnel', -15.8, TH / 2, -3.9, 0.4, TH, 2.2);        // east wall of the down leg, z -5..-2.8
  both('tunnel', -15.35, TH / 2, -7.2, 6.1, TH, 0.4);       // south wall, x -18.4..-12.3
  both('tunnel', -14.15, TH / 2, -4.8, 3.3, TH, 0.4);       // north wall of the east leg, x -15.8..-12.5
  both('roof', -17, TH + 0.15, -5, 2.8, 0.3, 4.8);
  both('roof', -14.05, TH + 0.15, -6, 3.5, 0.3, 2.8);
  both('rubber', -17, 0.02, -5, 2.0, 0.04, 4.0, { surface: 'rubber' });
  both('rubber', -14.25, 0.02, -6, 3.5, 0.04, 2.0, { surface: 'rubber' });

  // ---------- neon trims (emissive, they glow) ----------
  const trim = (x, y, z, w, h, d, t) => add(t === 0 ? 'neonA' : t === 1 ? 'neonB' : 'neonY', x, y, z, w, h, d, { collide: false });
  for (const sx of [-1, 1]) {
    const t = sx < 0 ? 0 : 1;
    trim((W - 0.03) * sx, 4.6, 0, 0.06, 0.08, ARENA.d - 2, t);
    trim(17 * sx, 0.02, 0, 3.2, 0.02, 0.08, t); trim(17 * sx, 0.02, 3, 0.08, 0.02, 3, t); trim(17 * sx, 0.02, -3, 0.08, 0.02, 3, t);
    trim(8 * sx, 3.43, 4.72, 10, 0.06, 0.05, t);
    trim(19 * sx - 0.3 * sx, 4.3, 0, 0.05, 0.06, 18, t);
    trim(15.35 * sx, TH + 0.33, -7.42, 6, 0.05, 0.05, t);
  }
  trim(0, C.y + 0.015, C.z - C.w / 2 + 0.25, C.x * 2, 0.02, 0.06, 2); trim(0, C.y + 0.015, C.z + C.w / 2 - 0.25, C.x * 2, 0.02, 0.06, 2);

  // merge per material: a handful of draw calls for the whole arena
  const merged = [];
  for (const [k, list] of Object.entries(parts)) {
    const m = V.Mesh.MergeMeshes(list, true, true, undefined, false, false);
    if (!m) continue;
    m.material = mats[k]; m.isPickable = false; m.name = 'arena-' + k; m.freezeWorldMatrix(); m.receiveShadows = !k.startsWith('neon');
    if (K3.shadow && !k.startsWith('neon') && k !== 'floor' && k !== 'rubber') K3.shadow.addShadowCaster(m);
    merged.push(m);
  }
  const A = { boxes, meshes: merged, surfaceOf: (c) => (c && surf.get(c.handle)) || 'concrete' };
  A.setMode = (m) => {
    A.mode = m;
    shutters.forEach((s) => { s.m.setEnabled(m === '1v1'); s.c.setEnabled(m === '1v1'); });
    A.spawns = m === '1v1'
      ? [[{ x: -17, z: 0, yaw: Math.PI / 2 }], [{ x: 17, z: 0, yaw: -Math.PI / 2 }]]
      : [[{ x: -17, z: 2, yaw: Math.PI / 2 }, { x: -17, z: -2, yaw: Math.PI / 2 }], [{ x: 17, z: 2, yaw: -Math.PI / 2 }, { x: 17, z: -2, yaw: -Math.PI / 2 }]];
    A.bounds = m === '1v1' ? { x: 18.7, z: 12.7 } : { x: W - 0.4, z: D - 0.4 };
  };
  A.setMode(mode || '2v2');
  return A;
}

// TRAINING RANGE: a 26 x 74 m hall far away from the arena (x = 300). You stand at z = -30 looking down range (+z).
export const RANGE = { x: 300, z0: -30 };
export function buildRange(K3) {
  const S = K3.scene, mats = makeMaterials(K3), parts = {};
  const add = (mat, x, y, z, w, h, d, collide = true) => {
    const m = V.CreateBox('r', { width: w, height: h, depth: d, wrap: true, faceUV: [0, 1, 2, 3, 4, 5].map((i) => new V.Vector4(0, 0, (i < 2 ? w : i < 4 ? d : w) * 0.5, (i < 4 ? h : d) * 0.5)) }, S);
    m.position.set(x, y, z); (parts[mat] = parts[mat] || []).push(m);
    if (collide) K3.phys.box(x, y, z, w / 2, h / 2, d / 2, null, { surface: 'concrete' });
  };
  const X = RANGE.x;
  add('floor', X, -0.25, 0, 28, 0.5, 76);
  add('wall', X, 3, 37.5, 28, 6, 1); add('wall', X, 3, -37.5, 28, 6, 1); add('wall', X + 13.5, 3, 0, 1, 6, 76); add('wall', X - 13.5, 3, 0, 1, 6, 76);
  // firing line counter + lane dividers
  add('cover', X, 0.5, RANGE.z0 + 1.6, 10, 1, 0.5);
  for (const d of [5, 10, 20, 30, 45]) { add(d === 20 || d === 45 ? 'neonB' : 'neonA', X, 0.01, RANGE.z0 + d, 24, 0.02, 0.08, false); }
  for (const [d, x] of [[12, -6], [25, 5], [36, 0]]) add('crate', X + x, 0.6, RANGE.z0 + d, 1.4, 1.2, 1.2);
  for (const [k, list] of Object.entries(parts)) { const m = V.Mesh.MergeMeshes(list, true, true); if (m) { m.material = mats[k]; m.freezeWorldMatrix(); m.isPickable = false; } }
  // distance signs
  for (const d of [5, 10, 20, 30, 45]) {
    const p = V.CreatePlane('sign', { width: 1.6, height: 0.7 }, S); p.position.set(X - 11, 2.4, RANGE.z0 + d); p.rotation.y = -Math.PI / 2 + 0.6;
    const t = canvasTexture(S, 256, 112, (c, w, h) => { c.fillStyle = '#0c0a1e'; c.fillRect(0, 0, w, h); c.strokeStyle = '#22e6ff'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6); c.fillStyle = '#fff'; c.font = 'bold 64px Orbitron, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(d + ' m', w / 2, h / 2 + 4); });
    const m = new V.StandardMaterial('sign', S); m.emissiveTexture = t; m.disableLighting = true; m.backFaceCulling = false; p.material = m;
  }
  return { spawn: { x: X, z: RANGE.z0, yaw: 0 } };
}

function makeMaterials(K3) {
  const S = K3.scene, M = {};
  const std = (name, col, { tex = null, emissive = null, spec = 0.08 } = {}) => {
    const m = new V.StandardMaterial(name, S);
    m.diffuseColor = V.Color3.FromHexString(col); m.specularColor = new V.Color3(spec, spec, spec);
    if (tex) m.diffuseTexture = tex;
    if (emissive) { m.emissiveColor = V.Color3.FromHexString(emissive); m.disableLighting = true; }
    return m;
  };
  const noise = (c, w, h, a = 0.03) => { for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * a})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };
  const grid = (bg, line, accent) => canvasTexture(S, 256, 256, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h); noise(c, w, h, 0.025);
    c.strokeStyle = line; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3);
    c.strokeStyle = accent; c.lineWidth = 1; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
  });
  const panel = (bg, edge) => canvasTexture(S, 256, 256, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = edge; c.fillRect(0, 0, w, 6); c.fillRect(0, h - 6, w, 6);
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.strokeRect(8, 14, w - 16, h - 28); noise(c, w, h);
  });
  M.floor = std('floor', '#a8a6c4', { tex: grid('#24223a', '#3a3760', '#2e2c4c') });
  M.wall = std('wall', '#d0cce8', { tex: panel('#3e3b5c', '#4c4874') });
  M.wall2 = std('wall2', '#c0cce8', { tex: panel('#343a58', '#405078') });
  M.roof = std('roof', '#9a98b8', { tex: panel('#2a2842', '#34314f') });
  M.crate = std('crate', '#ffffff', { tex: panel('#a8562a', '#d07a3a') });
  M.cover = std('cover', '#ffffff', { tex: panel('#2f5e64', '#3d8088') });
  M.pillar = std('pillar', '#ffffff', { tex: panel('#4a4766', '#5a5680') });
  M.metal = std('metal', '#ffffff', { spec: 0.35, tex: canvasTexture(S, 128, 128, (c, w, h) => { c.fillStyle = '#5c6274'; c.fillRect(0, 0, w, h); c.strokeStyle = '#717a90'; c.lineWidth = 2; for (let i = 0; i < w; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); } noise(c, w, h, 0.05); }) });
  M.rail = std('rail', '#ffd93a', { spec: 0.4 });
  M.shutter = std('shutter', '#ffffff', { tex: canvasTexture(S, 128, 128, (c, w, h) => { c.fillStyle = '#5a5050'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 12) { c.fillStyle = '#463e3e'; c.fillRect(0, y, w, 3); } c.fillStyle = '#ffd93a'; c.fillRect(0, h - 12, w, 12); c.fillStyle = '#222'; for (let x = 0; x < w; x += 24) c.fillRect(x, h - 12, 12, 12); }) });
  M.tunnel = std('tunnel', '#ffffff', { tex: panel('#2b2a3e', '#1f6a78') });
  M.rubber = std('rubber', '#3a3434');
  M.neonA = std('neonA', '#22e6ff', { emissive: '#22e6ff' });
  M.neonB = std('neonB', '#ff2bd6', { emissive: '#ff2bd6' });
  M.neonY = std('neonY', '#ffd93a', { emissive: '#ffd93a' });
  return M;
}
