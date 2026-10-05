// Builds a bank of Rush Hour puzzles (node tools/gen_rushhour.js > out). Each puzzle is the position
// farthest from any solution in its whole state space, so difficulty = exact minimum number of slides.
const N = 6;
const irand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const key = (cars) => cars.map((c) => (c.h ? c.x : c.y)).join(',');
function occ(cars) { const g = Array.from({ length: N }, () => Array(N).fill(-1)); cars.forEach((c, i) => { for (let k = 0; k < c.len; k++) g[c.y + (c.h ? 0 : k)][c.x + (c.h ? k : 0)] = i; }); return g; }
function neighbours(cs) {
  const g = occ(cs), out = [];
  cs.forEach((c, i) => {
    for (const dir of [-1, 1]) {
      let step = 1;
      while (true) {
        const nx = c.x + (c.h ? dir * step : 0), ny = c.y + (c.h ? 0 : dir * step);
        const tx = c.h ? (dir > 0 ? nx + c.len - 1 : nx) : nx, ty = c.h ? ny : dir > 0 ? ny + c.len - 1 : ny;
        if (tx < 0 || ty < 0 || tx >= N || ty >= N || (g[ty][tx] !== -1 && g[ty][tx] !== i)) break;
        const n = cs.map((o) => ({ ...o })); n[i].x = nx; n[i].y = ny; out.push(n);
        step++;
      }
    }
  });
  return out;
}
function hardest() {
  const cars = [{ x: 4, y: 2, len: 2, h: true }];
  const want = irand(9, 13);
  for (let t = 0; t < 300 && cars.length < want; t++) {
    const h = Math.random() < 0.5, len = Math.random() < 0.3 ? 3 : 2, x = irand(0, h ? N - len : N - 1), y = irand(0, h ? N - 1 : N - len);
    if (h && y === 2) continue;
    const g = occ(cars); let ok = true; for (let k = 0; k < len; k++) if (g[y + (h ? 0 : k)][x + (h ? k : 0)] !== -1) ok = false;
    if (ok) cars.push({ x, y, len, h });
  }
  const states = new Map(), list = [], edges = [];
  const add = (cs) => { const k = key(cs); if (states.has(k)) return states.get(k); const id = list.length; states.set(k, id); list.push(cs); return id; };
  add(cars);
  for (let i = 0; i < list.length && list.length < 60000; i++) edges[i] = neighbours(list[i]).map(add);
  if (list.length >= 60000) return null;
  const dist = new Array(list.length).fill(-1), q = [];
  list.forEach((cs, i) => { if (cs[0].x + cs[0].len === N) { dist[i] = 0; q.push(i); } });
  for (let qi = 0; qi < q.length; qi++) { const i = q[qi]; for (const j of edges[i] || []) if (dist[j] < 0) { dist[j] = dist[i] + 1; q.push(j); } }
  let far = 0; dist.forEach((d, i) => { if (d > dist[far]) far = i; });
  return { cars: list[far], d: dist[far] };
}
const bands = [[5, 8], [9, 12], [13, 16], [17, 40]], per = 10, bank = bands.map(() => []);
for (let t = 0; t < 20000 && bank.some((b) => b.length < per); t++) {
  const p = hardest(); if (!p) continue;
  const bi = bands.findIndex(([a, b]) => p.d >= a && p.d <= b);
  if (bi >= 0 && bank[bi].length < per) bank[bi].push(p);
}
const enc = (p) => p.d + ':' + p.cars.map((c) => `${c.x}${c.y}${c.len}${c.h ? 'h' : 'v'}`).join(' ');
console.log('const BANK = [');
bank.flat().forEach((p) => console.log(`  '${enc(p)}',`));
console.log('];');
console.error(bank.map((b) => b.length).join(' '));
