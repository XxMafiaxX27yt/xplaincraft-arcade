// REDLINE track: a closed spline (Catmull-Rom) turned into a road ribbon + kerbs + walls (Rapier trimeshes),
// grass, trees, grandstands, start gantry. The same spline is the AI racing line and the lap counter.
import { V, canvasTexture } from '../../kit3d/kit3d.js';

// the circuit (x, y, z): a 400 m main straight, a climb to a crest and a fast downhill, esses, a long sweeper, a hairpin
export const CIRCUIT = [
  [0, 0, -100], [0, 0, 60], [0, 0, 230], [14, 0, 330], [70, 1, 378], [150, 4, 392], [222, 10, 352], [262, 14, 272], [252, 9, 192],
  [205, 3, 145], [228, 1, 84], [196, 0, 26], [238, 0, -52], [252, 0, -150], [206, 0, -228], [126, 0, -258], [58, 0, -252], [12, 0, -208],
];
export const ROAD_W = 15, WALL_OFF = 10.5;

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return p1.map((_, i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3));
}
// evenly spaced samples every ~2 m around the loop: { x, y, z, dx, dz (unit dir), nx, nz (unit right), s (distance) }
export function sampleTrack(pts = CIRCUIT, step = 2) {
  const n = pts.length, dense = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < 40; k++) dense.push(catmull(pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n], k / 40));
  // re-sample by arc length
  const out = []; let acc = 0, need = 0;
  for (let i = 0; i < dense.length; i++) {
    const a = dense[i], b = dense[(i + 1) % dense.length], seg = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    while (need <= acc + seg) { const t = (need - acc) / seg; out.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, z: a[2] + (b[2] - a[2]) * t, s: need }); need += step; }
    acc += seg;
  }
  const L = acc;
  out.forEach((p, i) => {
    const q = out[(i + 1) % out.length], r = out[(i - 1 + out.length) % out.length];
    let dx = q.x - r.x, dz = q.z - r.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    Object.assign(p, { dx, dz, nx: dz, nz: -dx });   // right-hand side of the road
  });
  // curvature (for AI braking) and a smoothed grade
  out.forEach((p, i) => {
    const a = out[(i - 4 + out.length) % out.length], b = out[(i + 4) % out.length];
    const ang = Math.atan2(b.dx, b.dz) - Math.atan2(a.dx, a.dz); const w = Math.atan2(Math.sin(ang), Math.cos(ang));
    p.k = Math.abs(w) / 16;   // radians per metre
    p.turn = w;
  });
  out.length0 = L;
  return out;
}

export function buildTrack(K3, T, props) {
  const S = K3.scene, n = T.length;
  const W = ROAD_W / 2, KERB = 1.4;
  // ---------- road ribbon (+ kerbs) as one mesh and one trimesh collider ----------
  const ribbon = (offA, offB, yA, yB, vScale) => {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const p = T[i % n], v = (i * 2) / vScale;
      pos.push(p.x + p.nx * offA, p.y + yA, p.z + p.nz * offA, p.x + p.nx * offB, p.y + yB, p.z + p.nz * offB);
      uv.push(0, v, 1, v);
      if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }   // wound so the faces point up (lit from the sky)
    }
    return { pos, uv, idx };
  };
  const mesh = (name, r, mat) => {
    const m = new V.Mesh(name, S), vd = new V.VertexData();
    vd.positions = r.pos; vd.indices = r.idx; vd.uvs = r.uv; const normals = []; V.VertexData.ComputeNormals(r.pos, r.idx, normals); vd.normals = normals;
    vd.applyToMesh(m); m.material = mat; m.isPickable = false; m.receiveShadows = true; m.freezeWorldMatrix();
    return m;
  };
  // FIX_INTERNAL_EDGES: anything sliding over the road never catches on the edges between its triangles
  const tri = (r) => K3.world.createCollider(K3.R.ColliderDesc.trimesh(new Float32Array(r.pos), new Uint32Array(r.idx), K3.R.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(1.0).setCollisionGroups(K3.phys.groups(K3.phys.G_WORLD, 0xffff)));
  const asphalt = new V.StandardMaterial('asphalt', S);
  asphalt.diffuseTexture = canvasTexture(S, 256, 512, (c, w, h) => {
    c.fillStyle = '#34343c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const g = 40 + Math.random() * 40; c.fillStyle = `rgb(${g},${g},${g + 6})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    c.fillStyle = '#e8e8f0'; c.fillRect(4, 0, 6, h); c.fillRect(w - 10, 0, 6, h);            // edge lines
    c.fillStyle = '#d8d8e0'; for (let y = 0; y < h; y += 128) c.fillRect(w / 2 - 3, y, 6, 64);   // centre dashes
  });
  asphalt.diffuseTexture.uScale = 1; asphalt.diffuseTexture.vScale = 1; asphalt.specularColor = new V.Color3(0.15, 0.15, 0.15);
  const kerbMat = new V.StandardMaterial('kerb', S);
  kerbMat.diffuseTexture = canvasTexture(S, 64, 128, (c, w, h) => { c.fillStyle = '#e8e8ee'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8203c'; c.fillRect(0, 0, w, h / 2); });
  const road = ribbon(-W, W, 0.02, 0.02, 24);
  mesh('road', road, asphalt); tri(road);
  const kL = ribbon(-W - KERB, -W, 0.06, 0.02, 4), kR = ribbon(W, W + KERB, 0.02, 0.06, 4);
  mesh('kerbL', kL, kerbMat); mesh('kerbR', kR, kerbMat); tri(kL); tri(kR);
  // run-off: a strip of gravel-ish ground between kerbs and walls
  const runMat = new V.StandardMaterial('run', S); runMat.diffuseTexture = canvasTexture(S, 128, 128, (c, w, h) => { c.fillStyle = '#4c7a3a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 2500; i++) { c.fillStyle = Math.random() < 0.5 ? '#5a8a44' : '#3f6a30'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
  const rL = ribbon(-WALL_OFF, -W - KERB, 0, 0.06, 6), rR = ribbon(W + KERB, WALL_OFF, 0.06, 0, 6);
  mesh('runL', rL, runMat); mesh('runR', rR, runMat); tri(rL); tri(rR);
  // walls: vertical ribbons (tyre-wall look), solid
  const wallMat = new V.StandardMaterial('wall', S);
  wallMat.diffuseTexture = canvasTexture(S, 256, 64, (c, w, h) => { for (let x = 0; x < w; x += 32) { c.fillStyle = (x / 32) % 2 ? '#e8e8f0' : '#2a7aff'; c.fillRect(x, 0, 32, h); } c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(0, h - 8, w, 8); });
  const wall = (off) => {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) { const p = T[i % n], x = p.x + p.nx * off, z = p.z + p.nz * off, v = i / 2; pos.push(x, p.y - 0.5, z, x, p.y + 1.3, z); uv.push(v, 0, v, 1); if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const r = { pos, uv, idx }; const m = mesh('wall', r, wallMat); wallMat.backFaceCulling = false; wallMat.twoSidedLighting = true;   // one face set, lit from both sides
    K3.world.createCollider(K3.R.ColliderDesc.trimesh(new Float32Array(pos), new Uint32Array(idx)).setFriction(0.15).setRestitution(0.2).setCollisionGroups(K3.phys.groups(K3.phys.G_WORLD, 0xffff)));
  };
  wall(-WALL_OFF); wall(WALL_OFF);

  // ---------- ground + grass + hills far away ----------
  const ground = V.CreateGround('ground', { width: 1400, height: 1400, subdivisions: 2 }, S); ground.position.set(130, -0.6, 70);
  const gm = new V.StandardMaterial('grass', S); gm.diffuseTexture = canvasTexture(S, 256, 256, (c, w, h) => { c.fillStyle = '#3f7a32'; c.fillRect(0, 0, w, h); for (let i = 0; i < 6000; i++) { c.fillStyle = ['#4a8a3a', '#356a2a', '#5a9a44'][i % 3]; c.fillRect(Math.random() * w, Math.random() * h, 3, 3); } }); gm.diffuseTexture.uScale = gm.diffuseTexture.vScale = 120; gm.specularColor = V.Color3.Black();
  ground.material = gm; ground.receiveShadows = true; ground.isPickable = false;
  K3.phys.box(130, -1.1, 70, 700, 0.5, 700);
  // supports under raised parts of the track (so the climb is not floating); their tops stay under the road on slopes
  const fill = new V.StandardMaterial('fill', S); fill.diffuseColor = V.Color3.FromHexString('#5a6a4a'); fill.specularColor = V.Color3.Black();
  for (let i = 0; i < n; i += 3) { const p = T[i]; if (p.y < 0.8) continue; const top = p.y - 0.75, b = V.CreateBox('emb', { width: WALL_OFF * 2 + 6, height: top + 0.6, depth: 7 }, S); b.position.set(p.x, (top - 0.6) / 2, p.z); b.rotation.y = Math.atan2(p.dx, p.dz); b.material = fill; b.isPickable = false; b.freezeWorldMatrix(); }

  // ---------- scenery from the racing kit ----------
  // (the glTF root keeps its handedness fix; we move a parent node instead)
  const place = (name, x, y, z, ry, s) => { const src = props[name]; if (!src) return null; const inst = src.instantiateModelsToScene((nm) => nm, false, { doNotInstantiate: false }); const t = new V.TransformNode('prop-' + name, S); inst.rootNodes.forEach((r) => (r.parent = t)); t.position.set(x, y, z); t.rotation.y = ry; t.scaling.setAll(s); t.getChildMeshes().forEach((m) => { m.isPickable = false; }); return t; };
  const at = (i, side, off = 0) => { const p = T[((i % n) + n) % n]; return { x: p.x + p.nx * side, y: p.y, z: p.z + p.nz * side, ry: Math.atan2(p.dx, p.dz) + off }; };
  // grandstands along the main straight (left side), start gantry, banners, light posts, trees
  for (let k = 0; k < 6; k++) { const a = at(20 + k * 9, -WALL_OFF - 9); place('grandStandCovered', a.x, a.y, a.z, a.ry - Math.PI / 2, 9); }
  { const a = at(0, 0); place('overheadLights', a.x, a.y, a.z, a.ry, 13); }
  for (let i = 0; i < n; i += 12) { const s = i % 24 ? 1 : -1, a = at(i, s * (WALL_OFF + 1.2)); place(i % 36 === 0 ? 'bannerTowerRed' : 'lightPostModern', a.x, a.y, a.z, a.ry, i % 36 === 0 ? 6 : 9); }
  const trees = [];
  for (let k = 0; k < 260; k++) {
    const i = Math.floor(Math.random() * n), side = (Math.random() < 0.5 ? -1 : 1) * (WALL_OFF + 6 + Math.random() * 60), a = at(i, side);
    // keep trees off the track itself (another part of the loop may pass nearby)
    let ok = true; for (let j = 0; j < n; j += 3) { if (Math.hypot(T[j].x - a.x, T[j].z - a.z) < WALL_OFF + 4) { ok = false; break; } }
    if (ok) trees.push(place(Math.random() < 0.6 ? 'treeLarge' : 'treeSmall', a.x, -0.6, a.z, Math.random() * 6, 7 + Math.random() * 4));
  }
  for (let k = 0; k < 4; k++) { const a = at(n - 40 - k * 6, WALL_OFF + 22); place('pitsGarage', a.x, a.y - 0.05, a.z, a.ry + Math.PI / 2, 9); }
  { const a = at(60, -WALL_OFF - 3); place('billboardDouble_exclusive', a.x, a.y, a.z, a.ry - Math.PI / 2, 7); }
  { const a = at(Math.floor(n * 0.36), WALL_OFF + 3); place('billboard', a.x, a.y, a.z, a.ry + Math.PI / 2, 7); }
  // start / finish line
  const sl = V.CreateGround('startline', { width: ROAD_W, height: 2.2 }, S); const p0 = T[0]; sl.position.set(p0.x, p0.y + 0.035, p0.z); sl.rotation.y = Math.atan2(p0.dx, p0.dz);
  sl.material = (() => { const m = new V.StandardMaterial('chk', S); m.diffuseTexture = canvasTexture(S, 256, 32, (c, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { c.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; c.fillRect(x * 16, y * 16, 16, 16); } }); return m; })();
  return { trees };
}

// where on the loop is this point? search near the last known index (fast), returns { i, lat (metres right of centre) }
export function locate(T, p, hint = null) {
  const n = T.length; let best = 0, bd = 1e18;
  const range = hint == null ? n : 40, start = hint == null ? 0 : hint - 20;
  for (let k = 0; k < range; k++) { const i = (((start + k) % n) + n) % n, q = T[i], d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2 + ((q.y - p.y) * 2) ** 2; if (d < bd) { bd = d; best = i; } }
  const q = T[best];
  return { i: best, lat: (p.x - q.x) * q.nx + (p.z - q.z) * q.nz, d: Math.sqrt(bd) };
}
