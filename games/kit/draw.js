// DRAW: the shared sketch pad for the drawing party games (Draw & Guess, Telephone Draw, Fake Artist, Sketch Duel, Mandala).
//
//   const pad = DRAW.pad({ x, y, w, h });       a pad at (x, y) in game units, the toolbar sits under it (2 rows, 76 px)
//   DRAW.pad({ ..., tools: false })             pen only, no toolbar (set pad.col / pad.size yourself)
//   pad.sym = 8; pad.mirror = true             mandala mode: every new stroke / shape / fill is copied around the centre
//   pad.update(canDraw)     tools + drawing input (call every frame while it is your turn)
//   pad.take()              operations drawn since the last take() -> send them to the others
//   pad.apply(ops)          operations from someone else
//   pad.draw(showToolbar)   draws the picture (+ the toolbar when it is your turn)
//   pad.items               the whole picture (plain data, can be sent / stored and shown with DRAW.show)
//   pad.load(items) / pad.clear()
//   pad.onStroke = (item) => {}     called when you finish a stroke or a shape (Fake Artist: one stroke per turn)
//   DRAW.show(items, x, y, w, h, srcW, srcH)   a stored picture, scaled into a box
//
// Tools: pen, spray, rainbow pen, eraser, SHAPES (16: line, arrow, box, rounded box, circle, two triangles, diamond,
// pentagon, hexagon, star, heart, cloud, speech bubble, moon, lightning), paint bucket, eyedropper, filled / outline,
// undo, clear, 5 sizes, 14 quick colours + your recent colours, and the 🎨 palette (60 colours, any hue, any shade).
(() => {
  const PAPER = '#f4f1ea', R = 2;
  const QUICK = ['#111111', '#ffffff', '#8a8a96', '#ff3355', '#ff8a3a', '#ffd93a', '#9ae63a', '#2ecc71', '#22e6ff', '#4f8bff', '#8b5cf6', '#ff2bd6', '#8a5a2a', '#f0c8a0'];
  // the big palette: 12 hues x 4 shades, then greys and skin / earth tones
  const PAL = [];
  for (const [s, l] of [[95, 84], [95, 64], [90, 48], [85, 30]]) for (const h of [0, 20, 40, 55, 80, 120, 160, 185, 210, 240, 275, 310]) PAL.push(`hsl(${h},${s}%,${l}%)`);
  PAL.push('#000000', '#2a2a30', '#55555e', '#8a8a96', '#b8b8c2', '#e2e2e8', '#ffffff', '#ffe0c4', '#f0c8a0', '#d8a07a', '#a8724e', '#6a4028');
  const SIZES = [2, 5, 9, 16, 30];
  const SHAPES = [['line', '╱'], ['arrow', '➜'], ['rect', '▭'], ['rrect', '▢'], ['circle', '◯'], ['tri', '△'], ['rtri', '◺'], ['diamond', '◇'], ['penta', '⬠'], ['hexa', '⬡'], ['star', '☆'], ['heart', '♡'], ['cloud', '☁'], ['speech', '💬'], ['moon', '☾'], ['bolt', '⚡']];
  const TOOLS = [['pen', '✎'], ['spray', '∴'], ['rainbow', '🌈'], ['eraser', '▱'], ['shape', ''], ['bucket', '🪣'], ['pick', '💧']];
  const hsl = (h, s, l) => `hsl(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%)`;
  const rbCol = (h0, i) => hsl((h0 + i * 5) % 360, 95, 55);
  const rnd = (seed) => { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };

  function poly(c, pts, l, t, w, h) { pts.forEach(([px, py], i) => (i ? c.lineTo(l + px * w, t + py * h) : c.moveTo(l + px * w, t + py * h))); c.closePath(); }
  function ngon(c, n, l, t, w, h) { for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / n, px = l + w / 2 + (Math.cos(a) * w) / 2, py = t + h / 2 + (Math.sin(a) * h) / 2; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); }
  function shapePath(c, it) {
    const [x1, y1, x2, y2] = it.a, l = Math.min(x1, x2), t = Math.min(y1, y2), w = Math.abs(x2 - x1), h = Math.abs(y2 - y1), cx = l + w / 2, cy = t + h / 2;
    c.beginPath();
    switch (it.sh) {
      case 'line': case 'arrow': c.moveTo(x1, y1); c.lineTo(x2, y2); return;
      case 'rect': c.rect(l, t, w, h); return;
      case 'rrect': c.roundRect(l, t, w, h, Math.min(w, h) * 0.22); return;
      case 'circle': c.ellipse(cx, cy, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2); return;
      case 'tri': poly(c, [[0.5, 0], [1, 1], [0, 1]], l, t, w, h); return;
      case 'rtri': poly(c, [[0, 0], [0, 1], [1, 1]], l, t, w, h); return;
      case 'diamond': poly(c, [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], l, t, w, h); return;
      case 'penta': ngon(c, 5, l, t, w, h); return;
      case 'hexa': ngon(c, 6, l, t, w, h); return;
      case 'star': for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.42 : 1, px = cx + Math.cos(a) * (w / 2) * r, py = cy + Math.sin(a) * (h / 2) * r; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); return;
      case 'heart':
        c.moveTo(cx, t + h * 0.3);
        c.bezierCurveTo(cx, t, l, t, l, t + h * 0.35); c.bezierCurveTo(l, t + h * 0.65, cx, t + h * 0.8, cx, t + h);
        c.bezierCurveTo(cx, t + h * 0.8, l + w, t + h * 0.65, l + w, t + h * 0.35); c.bezierCurveTo(l + w, t, cx, t, cx, t + h * 0.3); c.closePath(); return;
      case 'cloud':
        c.moveTo(l + w * 0.25, t + h * 0.9);
        c.bezierCurveTo(l - w * 0.06, t + h * 0.9, l - w * 0.02, t + h * 0.42, l + w * 0.22, t + h * 0.45);
        c.bezierCurveTo(l + w * 0.2, t + h * 0.02, l + w * 0.56, t - h * 0.02, l + w * 0.6, t + h * 0.26);
        c.bezierCurveTo(l + w * 0.7, t + h * 0.04, l + w * 1.0, t + h * 0.16, l + w * 0.86, t + h * 0.46);
        c.bezierCurveTo(l + w * 1.06, t + h * 0.52, l + w * 1.02, t + h * 0.92, l + w * 0.76, t + h * 0.9); c.closePath(); return;
      case 'speech': {
        const b = h * 0.74, r = Math.min(w, b) * 0.22;
        c.moveTo(l + r, t); c.lineTo(l + w - r, t); c.quadraticCurveTo(l + w, t, l + w, t + r); c.lineTo(l + w, t + b - r); c.quadraticCurveTo(l + w, t + b, l + w - r, t + b);
        c.lineTo(l + w * 0.42, t + b); c.lineTo(l + w * 0.16, t + h); c.lineTo(l + w * 0.24, t + b); c.lineTo(l + r, t + b); c.quadraticCurveTo(l, t + b, l, t + b - r); c.lineTo(l, t + r); c.quadraticCurveTo(l, t, l + r, t); c.closePath(); return;
      }
      case 'moon':
        c.moveTo(l + w * 0.62, t); c.bezierCurveTo(l - w * 0.18, t, l - w * 0.18, t + h, l + w * 0.62, t + h);
        c.bezierCurveTo(l + w * 0.2, t + h * 0.82, l + w * 0.2, t + h * 0.18, l + w * 0.62, t); c.closePath(); return;
      case 'bolt': poly(c, [[0.58, 0], [0.12, 0.56], [0.44, 0.56], [0.3, 1], [0.88, 0.38], [0.56, 0.38], [0.78, 0]], l, t, w, h); return;
    }
  }
  function drawShape(c, it) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    shapePath(c, it);
    const line = it.sh === 'line' || it.sh === 'arrow';
    if (it.f && !line) { c.fillStyle = it.c; c.fill(); }
    else { c.strokeStyle = it.c; c.lineWidth = it.w; c.stroke(); }
    if (it.sh === 'arrow') {
      const [x1, y1, x2, y2] = it.a, a = Math.atan2(y2 - y1, x2 - x1), L = Math.max(12, it.w * 3);
      c.fillStyle = it.c; c.beginPath(); c.moveTo(x2 + Math.cos(a) * it.w * 0.6, y2 + Math.sin(a) * it.w * 0.6);
      c.lineTo(x2 - Math.cos(a - 0.45) * L, y2 - Math.sin(a - 0.45) * L); c.lineTo(x2 - Math.cos(a + 0.45) * L, y2 - Math.sin(a + 0.45) * L); c.closePath(); c.fill();
    }
  }
  // one pen segment (from point index i-1 to i); spray strokes scatter dots around each point instead (same dots for everyone)
  function seg(c, it, i) {
    const p = it.pts;
    if (it.sp != null) {
      const r = rnd(it.sp * 7919 + i), rad = it.w * 1.6 + 4, n = 10 + Math.round(it.w * 1.5), ds = 1.6 + it.w * 0.12;
      c.fillStyle = it.c;
      for (let k = 0; k < n; k++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad; c.fillRect(p[i] + Math.cos(a) * d, p[i + 1] + Math.sin(a) * d, ds, ds); }
      return;
    }
    c.strokeStyle = it.rb != null ? rbCol(it.rb, i / 2) : it.c; c.lineWidth = it.w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    if (i === 0) { c.moveTo(p[0], p[1]); c.lineTo(p[0] + 0.1, p[1]); }
    else { c.moveTo(p[i - 2], p[i - 1]); c.lineTo(p[i], p[i + 1]); }
    c.stroke();
  }
  // paint bucket on the raster (scanline fill, tolerant of anti-aliased edges)
  function bucket(cv, c, x, y, col) {
    const W = cv.width, H = cv.height, px = Math.floor(x * R), py = Math.floor(y * R);
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    const img = c.getImageData(0, 0, W, H), d = img.data;
    const tmp = document.createElement('canvas').getContext('2d'); tmp.fillStyle = col; tmp.fillRect(0, 0, 1, 1);
    const [nr, ng, nb] = tmp.getImageData(0, 0, 1, 1).data;
    const i0 = (py * W + px) * 4, tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
    if (Math.abs(tr - nr) + Math.abs(tg - ng) + Math.abs(tb - nb) < 6) return;
    const same = (i) => Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) < 90;
    const seen = new Uint8Array(W * H), stack = [px, py];
    while (stack.length) {
      const sy = stack.pop(), sx = stack.pop();
      let lx = sx; while (lx > 0 && !seen[sy * W + lx - 1] && same((sy * W + lx - 1) * 4)) lx--;
      let up = false, dn = false;
      for (let xx = lx; xx < W; xx++) {
        const k = sy * W + xx;
        if (seen[k] || !same(k * 4)) break;
        seen[k] = 1; d[k * 4] = nr; d[k * 4 + 1] = ng; d[k * 4 + 2] = nb; d[k * 4 + 3] = 255;
        if (sy > 0) { const u = k - W; if (!seen[u] && same(u * 4)) { if (!up) { stack.push(xx, sy - 1); up = true; } } else up = false; }
        if (sy < H - 1) { const v = k + W; if (!seen[v] && same(v * 4)) { if (!dn) { stack.push(xx, sy + 1); dn = true; } } else dn = false; }
      }
    }
    c.putImageData(img, 0, 0);
  }

  // the copies of a symmetric item: rotations around the centre (and mirror images)
  const copies = (sy) => { if (!sy) return [[0, 1]]; const out = []; for (let k = 0; k < sy[0]; k++) { out.push([(k / sy[0]) * Math.PI * 2, 1]); if (sy[1]) out.push([(k / sy[0]) * Math.PI * 2, -1]); } return out; };
  function withSym(c, w, h, sy, fn) {
    if (!sy) return fn();
    for (const [a, m] of copies(sy)) { c.save(); c.translate(w / 2, h / 2); c.rotate(a); c.scale(m, 1); c.translate(-w / 2, -h / 2); fn(); c.restore(); }
  }
  function raster(w, h) {
    const cv = document.createElement('canvas'); cv.width = w * R; cv.height = h * R;
    const c = cv.getContext('2d', { willReadFrequently: true }); c.setTransform(R, 0, 0, R, 0, 0);
    const wipe = () => { c.fillStyle = PAPER; c.fillRect(0, 0, w, h); };
    const paint = (it, from = 0) => {
      if (it.k === 'p') withSym(c, w, h, it.sy, () => { for (let i = from; i < it.pts.length; i += 2) seg(c, it, i); });
      else if (it.k === 's') withSym(c, w, h, it.sy, () => drawShape(c, it));
      else if (it.k === 'b') for (const [a, m] of copies(it.sy)) { const dx = (it.x - w / 2) * m, dy = it.y - h / 2; bucket(cv, c, w / 2 + dx * Math.cos(a) - dy * Math.sin(a), h / 2 + dx * Math.sin(a) + dy * Math.cos(a), it.c); }
    };
    const redraw = (items) => { wipe(); items.forEach((it) => paint(it)); };
    const pick = (x, y) => { const d = c.getImageData(Math.floor(x * R), Math.floor(y * R), 1, 1).data; return '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join(''); };
    wipe();
    return { cv, c, paint, redraw, pick };
  }

  function pad(o) {
    const P = { x: o.x, y: o.y, w: o.w, h: o.h, items: [], out: [], tool: 'pen', shape: 'rect', size: 9, hue: 0, shade: 0.5, col: '#111111', filled: false, onStroke: null, sym: o.sym || 1, mirror: !!o.mirror, recent: [], popup: null };
    const symOf = () => (P.sym > 1 || P.mirror ? [P.sym, P.mirror ? 1 : 0] : undefined);
    const ras = raster(o.w, o.h);
    let cur = null, drag = null, picking = null;
    const TB = { y1: o.y + o.h + 8, y2: o.y + o.h + 48 };
    const inPad = (m) => m.x >= P.x && m.x <= P.x + P.w && m.y >= P.y && m.y <= P.y + P.h;
    const local = (m) => [Math.round(K.clamp(m.x - P.x, 0, P.w)), Math.round(K.clamp(m.y - P.y, 0, P.h))];
    const setCol = (c) => { P.col = c; if (P.tool === 'eraser' || P.tool === 'rainbow' || P.tool === 'pick') P.tool = 'pen'; P.recent = [c, ...P.recent.filter((x) => x !== c)].slice(0, 5); };
    const fromShade = () => { const l = 8 + P.shade * 84; P.col = hsl(P.hue, P.shade > 0.92 ? 0 : 95, l); };
    // toolbar: row 1 = tools, filled, undo, clear, sizes; row 2 = quick colours, 🎨 palette, current colour, recent colours
    const lay = () => {
      let x = P.x;
      const r1 = TOOLS.map(([t]) => { const b = { t, x, y: TB.y1, w: t === 'shape' ? 50 : 38, h: 34 }; x += b.w + 4; return b; });
      const fill = { x, y: TB.y1, w: 38, h: 34 }; x += 42;
      const undo = { x, y: TB.y1, w: 38, h: 34 }; x += 42;
      const clear = { x, y: TB.y1, w: 48, h: 34 }; x += 54;
      const sizes = SIZES.map((sz, i) => ({ sz, x: x + i * 28, y: TB.y1, w: 25, h: 34 }));
      const qw = Math.min(24, (P.w - 220) / QUICK.length - 3);
      const quick = QUICK.map((c, i) => ({ c, x: P.x + i * (qw + 3), y: TB.y2, w: qw, h: 26 }));
      x = P.x + QUICK.length * (qw + 3) + 4;
      const palBtn = { x, y: TB.y2, w: 40, h: 26 }; x += 46;
      const swatch = { x, y: TB.y2, w: 30, h: 26 }; x += 38;
      const recent = P.recent.map((c, i) => ({ c, x: x + i * 26, y: TB.y2, w: 22, h: 26 }));
      return { r1, fill, undo, clear, sizes, quick, palBtn, swatch, recent };
    };
    // pop-up panels drawn over the canvas: the 🎨 palette and the shape picker
    const palLay = () => {
      const cols = 12, sw = Math.min(44, (P.w - 40) / cols), shh = 26, gx = P.x + (P.w - cols * sw) / 2, gy = P.y + 34;
      const cells = PAL.map((c, i) => ({ c, x: gx + (i % cols) * sw, y: gy + Math.floor(i / cols) * shh, w: sw - 3, h: shh - 3 }));
      const by = gy + Math.ceil(PAL.length / cols) * shh + 10;
      return { cells, hue: { x: gx, y: by, w: cols * sw - 3, h: 22 }, shade: { x: gx, y: by + 30, w: cols * sw - 3, h: 22 }, close: { x: P.x + P.w - 40, y: P.y + 6, w: 32, h: 24 } };
    };
    const shpLay = () => { const cols = 8, bw = Math.min(70, (P.w - 40) / cols), gx = P.x + (P.w - cols * bw) / 2; return { cells: SHAPES.map(([id], i) => ({ id, x: gx + (i % cols) * bw, y: P.y + 60 + Math.floor(i / cols) * 74, w: bw - 6, h: 66 })), close: { x: P.x + P.w - 40, y: P.y + 6, w: 32, h: 24 } }; };
    const push = (op) => P.out.push(op);
    const add = (it, send) => { const sy = symOf(); if (sy) it.sy = sy; P.items.push(it); ras.paint(it); if (send) push(it.k === 'p' ? { o: 'n', k: 'p', c: it.c, w: it.w, rb: it.rb, sp: it.sp, sy: it.sy, pts: it.pts.slice() } : { o: 'i', it }); };

    P.update = (can) => {
      const m = K.mouse;
      if (!can) { cur = null; drag = null; picking = null; P.popup = null; return; }
      const hit = (r) => K.inRect(m.x, m.y, r);
      // a pop-up is open: it eats the clicks
      if (P.popup === 'pal') {
        const L = palLay();
        if (picking) { if (picking === 'hue') P.hue = K.clamp((m.x - L.hue.x) / L.hue.w, 0, 1) * 360; else P.shade = K.clamp((m.x - L.shade.x) / L.shade.w, 0, 1); fromShade(); if (!m.down) { setCol(P.col); picking = null; } return; }
        if (m.clicked) {
          const cell = L.cells.find(hit);
          if (cell) { setCol(cell.c); P.popup = null; K.sfx('click'); }
          else if (hit(L.hue)) picking = 'hue';
          else if (hit(L.shade)) picking = 'shade';
          else if (hit(L.close) || !inPad(m)) P.popup = null;
        }
        return;
      }
      if (P.popup === 'shape') {
        if (m.clicked) { const L = shpLay(), cell = L.cells.find(hit); if (cell) { P.shape = cell.id; P.tool = 'shape'; K.sfx('click'); } P.popup = null; }
        return;
      }
      const L = lay();
      if (m.clicked && o.tools !== false) {
        let used = true;
        const tb = L.r1.find(hit);
        if (tb) { if (tb.t === 'shape') P.popup = 'shape'; else { P.tool = tb.t; if (P.tool === 'eraser') P.size = Math.max(P.size, 16); } K.sfx('click'); }
        else if (hit(L.fill)) { P.filled = !P.filled; K.sfx('click'); }
        else if (hit(L.undo)) { if (P.items.length) { P.items.pop(); ras.redraw(P.items); push({ o: 'u' }); K.sfx('whoosh'); } }
        else if (hit(L.clear)) { P.items = []; ras.redraw(P.items); push({ o: 'c' }); K.sfx('whoosh'); }
        else if (L.sizes.find(hit)) { P.size = L.sizes.find(hit).sz; K.sfx('click'); }
        else if (L.quick.find(hit)) { setCol(L.quick.find(hit).c); K.sfx('click'); }
        else if (L.recent.find(hit)) { setCol(L.recent.find(hit).c); K.sfx('click'); }
        else if (hit(L.palBtn) || hit(L.swatch)) { P.popup = 'pal'; K.sfx('click'); }
        else used = false;
        if (used) return;
      }
      if (P.tool === 'pick') {
        if (m.clicked && inPad(m)) { const [x, y] = local(m); setCol(ras.pick(x, y)); K.sfx('click'); }
        return;
      }
      if (P.tool === 'bucket') {
        if (m.clicked && inPad(m)) { const [x, y] = local(m); add({ k: 'b', x, y, c: P.col }, true); K.sfx('pop'); P.onStroke?.(P.items[P.items.length - 1]); }
        return;
      }
      if (P.tool === 'shape') {
        if (m.down && inPad(m) && !drag) { const [x, y] = local(m); drag = { x, y }; }
        if (drag) {
          const [x, y] = local(m); drag.ex = x; drag.ey = y;
          if (!m.down) {
            if (Math.hypot(drag.ex - drag.x, drag.ey - drag.y) > 4) { const it = { k: 's', sh: P.shape, c: P.col, w: P.size, f: P.filled, a: [drag.x, drag.y, drag.ex, drag.ey] }; add(it, true); P.onStroke?.(it); }
            drag = null;
          }
        }
        return;
      }
      // pen / spray / rainbow / eraser
      if (m.down && (cur || inPad(m))) {
        const p = local(m);
        if (!cur) {
          cur = { k: 'p', c: P.tool === 'eraser' ? PAPER : P.col, w: P.size, pts: p.slice() };
          if (P.tool === 'rainbow') cur.rb = Math.round(P.hue);
          if (P.tool === 'spray') cur.sp = Math.floor(Math.random() * 1e6);
          add(cur, true);
          return;
        }
        const n = cur.pts.length;
        if (Math.hypot(cur.pts[n - 2] - p[0], cur.pts[n - 1] - p[1]) > (cur.sp != null ? 3 : 2)) {
          cur.pts.push(p[0], p[1]); ras.paint(cur, n);
          const last = P.out[P.out.length - 1];
          if (last && (last.o === 'p' || (last.o === 'n' && last.pts))) last.pts.push(p[0], p[1]); else push({ o: 'p', pts: p.slice() });
        }
      } else if (cur) { const done = cur; cur = null; P.onStroke?.(done); }
    };
    P.take = () => { const o = P.out; P.out = []; return o; };
    P.apply = (ops) => {
      for (const op of ops || []) {
        if (op.o === 'n') { const it = { k: 'p', c: op.c, w: op.w, pts: op.pts.slice() }; if (op.rb != null) it.rb = op.rb; if (op.sp != null) it.sp = op.sp; if (op.sy) it.sy = op.sy; P.items.push(it); ras.paint(it); }
        else if (op.o === 'p') { const it = P.items[P.items.length - 1]; if (it && it.k === 'p') { const n = it.pts.length; it.pts.push(...op.pts); ras.paint(it, n); } }
        else if (op.o === 'i') { P.items.push(op.it); ras.paint(op.it); }
        else if (op.o === 'u') { P.items.pop(); ras.redraw(P.items); }
        else if (op.o === 'c') { P.items = []; ras.redraw(P.items); }
      }
    };
    P.load = (items) => { P.items = JSON.parse(JSON.stringify(items || [])); ras.redraw(P.items); cur = null; drag = null; };
    P.clear = () => P.load([]);
    const shapeIcon = (c, id, x, y, w, h, col) => { c.save(); drawShape(c, { sh: id, c: col, w: 2.5, f: false, a: id === 'line' || id === 'arrow' ? [x, y + h, x + w, y] : [x, y, x + w, y + h] }); c.restore(); };
    P.draw = (toolbar) => {
      const c = K.ctx();
      c.drawImage(ras.cv, P.x, P.y, P.w, P.h);
      K.stroke(P.x, P.y, P.w, P.h, '#ffffff22', 2, 6);
      if (drag && drag.ex != null) {
        c.save(); c.translate(P.x, P.y); c.globalAlpha = 0.7;
        withSym(c, P.w, P.h, symOf(), () => drawShape(c, { sh: P.shape, c: P.col, w: P.size, f: P.filled, a: [drag.x, drag.y, drag.ex, drag.ey] }));
        c.restore();
      }
      if (!toolbar || o.tools === false) return;
      const L = lay(), m = K.mouse;
      L.r1.forEach((b, i) => {
        const on = P.tool === b.t || (b.t === 'shape' && P.popup === 'shape');
        K.rect(b.x, b.y, b.w, b.h, on ? '#22e6ff' : '#24203f', 6);
        if (b.t === 'shape') { shapeIcon(c, P.shape, b.x + 7, b.y + 8, 24, 18, on ? '#05040c' : '#fff'); K.text('▾', b.x + b.w - 8, b.y + b.h / 2 + 1, 10, on ? '#05040c' : '#8e88b8', 'center', 'u'); }
        else K.text(TOOLS[i][1], b.x + b.w / 2, b.y + b.h / 2 + 1, b.t === 'rainbow' || b.t === 'bucket' || b.t === 'pick' ? 15 : 18, on ? '#05040c' : '#fff', 'center', 'u');
      });
      K.rect(L.fill.x, L.fill.y, L.fill.w, L.fill.h, '#24203f', 6);
      if (P.filled) K.rect(L.fill.x + 10, L.fill.y + 8, 18, 18, P.col, 3); else K.stroke(L.fill.x + 10, L.fill.y + 8, 18, 18, P.col === '#111111' ? '#fff' : P.col, 3, 3);
      K.rect(L.undo.x, L.undo.y, L.undo.w, L.undo.h, '#24203f', 6); K.text('↶', L.undo.x + 19, L.undo.y + 18, 20, '#fff', 'center', 'u');
      K.rect(L.clear.x, L.clear.y, L.clear.w, L.clear.h, '#3a1424', 6); K.text('CLEAR', L.clear.x + 24, L.clear.y + 18, 10, '#ff8aa0', 'center', 'd');
      L.sizes.forEach((b) => { K.rect(b.x, b.y, b.w, b.h, P.size === b.sz ? '#22e6ff44' : '#ffffff11', 5); K.circle(b.x + b.w / 2, b.y + b.h / 2, Math.min(11, b.sz / 2 + 1), '#fff'); });
      L.quick.forEach((b) => { K.rect(b.x, b.y, b.w, b.h, b.c, 5); if (P.col === b.c && P.tool !== 'eraser') K.stroke(b.x - 2, b.y - 2, b.w + 4, b.h + 4, '#22e6ff', 2, 6); });
      // 🎨 palette button: a little rainbow
      const g = c.createLinearGradient(L.palBtn.x, 0, L.palBtn.x + L.palBtn.w, 0);
      for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, hsl(i * 60, 95, 55));
      c.fillStyle = g; c.beginPath(); c.roundRect(L.palBtn.x, L.palBtn.y, L.palBtn.w, L.palBtn.h, 6); c.fill();
      K.text('🎨', L.palBtn.x + L.palBtn.w / 2, L.palBtn.y + 14, 15, '#fff', 'center', 'u');
      if (P.tool === 'rainbow') { const g3 = c.createLinearGradient(L.swatch.x, 0, L.swatch.x + 30, 0); [0, 60, 120, 200, 280].forEach((h, i) => g3.addColorStop(i / 4, hsl(h, 95, 55))); c.fillStyle = g3; c.beginPath(); c.roundRect(L.swatch.x, L.swatch.y, 30, 26, 6); c.fill(); }
      else K.rect(L.swatch.x, L.swatch.y, 30, 26, P.tool === 'eraser' ? PAPER : P.col, 6);
      K.stroke(L.swatch.x, L.swatch.y, 30, 26, '#fff', 2, 6);
      L.recent.forEach((b) => { K.rect(b.x, b.y, b.w, b.h, b.c, 5); K.stroke(b.x, b.y, b.w, b.h, '#ffffff33', 1, 5); });
      if (inPad(m) && !P.popup && P.tool !== 'bucket' && P.tool !== 'pick' && !K.isTouch) { c.strokeStyle = '#0006'; c.lineWidth = 1; c.beginPath(); c.arc(m.x, m.y, (P.tool === 'spray' ? P.size * 1.6 + 4 : P.size / 2) + 1, 0, Math.PI * 2); c.stroke(); }
      // pop-ups
      if (P.popup) { K.alpha(0.95); K.rect(P.x, P.y, P.w, P.h, '#120e26', 8); K.alpha(1); K.stroke(P.x, P.y, P.w, P.h, '#22e6ff', 2, 8); }
      if (P.popup === 'pal') {
        const Q = palLay();
        K.text('PICK A COLOUR', P.x + 16, P.y + 18, 13, '#fff', 'left', 'd');
        Q.cells.forEach((b) => K.rect(b.x, b.y, b.w, b.h, b.c, 4));
        const gh = c.createLinearGradient(Q.hue.x, 0, Q.hue.x + Q.hue.w, 0); for (let i = 0; i <= 12; i++) gh.addColorStop(i / 12, hsl(i * 30, 95, 55));
        c.fillStyle = gh; c.beginPath(); c.roundRect(Q.hue.x, Q.hue.y, Q.hue.w, Q.hue.h, 6); c.fill(); K.rect(Q.hue.x + (P.hue / 360) * Q.hue.w - 2, Q.hue.y - 3, 4, Q.hue.h + 6, '#fff', 2);
        const gs = c.createLinearGradient(Q.shade.x, 0, Q.shade.x + Q.shade.w, 0); gs.addColorStop(0, hsl(P.hue, 95, 8)); gs.addColorStop(0.5, hsl(P.hue, 95, 50)); gs.addColorStop(0.92, hsl(P.hue, 95, 85)); gs.addColorStop(1, '#ffffff');
        c.fillStyle = gs; c.beginPath(); c.roundRect(Q.shade.x, Q.shade.y, Q.shade.w, Q.shade.h, 6); c.fill(); K.rect(Q.shade.x + P.shade * Q.shade.w - 2, Q.shade.y - 3, 4, Q.shade.h + 6, '#fff', 2);
        K.text('any colour: slide the rainbow, then the shade', Q.shade.x, Q.shade.y + 38, 11, '#8e88b8', 'left', 'u');
        K.rect(Q.close.x, Q.close.y, Q.close.w, Q.close.h, '#3a1424', 6); K.text('✕', Q.close.x + 16, Q.close.y + 13, 14, '#fff', 'center', 'u');
      }
      if (P.popup === 'shape') {
        const Q = shpLay();
        K.text('PICK A SHAPE', P.x + 16, P.y + 18, 13, '#fff', 'left', 'd'); K.text('then drag on the canvas · the ■ button switches filled / outline', P.x + 16, P.y + 40, 11, '#8e88b8', 'left', 'u');
        Q.cells.forEach((b) => { const on = P.shape === b.id; K.rect(b.x, b.y, b.w, b.h, on ? '#22e6ff' : '#24203f', 8); shapeIcon(c, b.id, b.x + b.w * 0.22, b.y + 12, b.w * 0.56, b.h - 24, on ? '#05040c' : '#fff'); });
        K.rect(Q.close.x, Q.close.y, Q.close.w, Q.close.h, '#3a1424', 6); K.text('✕', Q.close.x + 16, Q.close.y + 13, 14, '#fff', 'center', 'u');
      }
    };
    return P;
  }

  // a stored picture (items) shown in any box; rasters are cached per items array
  const cache = new WeakMap();
  function show(items, x, y, w, h, srcW, srcH) {
    let r = cache.get(items);
    if (!r) { r = raster(srcW, srcH); r.redraw(items); cache.set(items, r); }
    K.ctx().drawImage(r.cv, x, y, w, h);
  }

  window.DRAW = { pad, show, PAPER };
})();
