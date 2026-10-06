// DRAW: the shared sketch pad for the drawing party games (Draw & Guess, Telephone Draw, Fake Artist, Sketch Duel).
//
//   const pad = DRAW.pad({ x, y, w, h });       a pad at (x, y) in game units, the toolbar sits under it (2 rows, 76 px)
//   DRAW.pad({ ..., tools: false })             pen only, no toolbar (set pad.col / pad.size yourself)
//   pad.update(canDraw)     tools + drawing input (call every frame while it is your turn)
//   pad.take()              operations drawn since the last take() -> send them to the others
//   pad.apply(ops)          operations from someone else
//   pad.draw(showToolbar)   draws the picture (+ the toolbar when it is your turn)
//   pad.items               the whole picture (plain data, can be sent / stored and shown with DRAW.show)
//   pad.load(items) / pad.clear()
//   pad.onStroke = (item) => {}     called when you finish a stroke or a shape (Fake Artist: one stroke per turn)
//   DRAW.show(items, x, y, w, h, srcW, srcH)   a stored picture, scaled into a box
//
// Tools: pen, rainbow pen, eraser, line, box, circle, triangle, star, paint bucket, filled / outline shapes, undo, clear,
// 4 sizes, quick colours, a rainbow strip (any hue) and a shade strip (dark -> colour -> light).
(() => {
  const PAPER = '#f4f1ea', R = 2;
  const QUICK = ['#111111', '#ffffff', '#ff3355', '#ffd93a', '#3dffa0', '#4f8bff', '#8a5a2a'];
  const SIZES = [3, 7, 14, 28];
  const TOOLS = [['pen', '✎'], ['rainbow', '🌈'], ['eraser', '▱'], ['line', '╱'], ['rect', '▭'], ['circle', '◯'], ['tri', '△'], ['star', '☆'], ['bucket', '🪣']];
  const hsl = (h, s, l) => `hsl(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%)`;
  const rbCol = (h0, i) => hsl((h0 + i * 5) % 360, 95, 55);

  function shapePath(c, it) {
    const [x1, y1, x2, y2] = it.a, l = Math.min(x1, x2), t = Math.min(y1, y2), w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
    c.beginPath();
    if (it.sh === 'line') { c.moveTo(x1, y1); c.lineTo(x2, y2); return; }
    if (it.sh === 'rect') { c.rect(l, t, w, h); return; }
    if (it.sh === 'circle') { c.ellipse(l + w / 2, t + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2); return; }
    if (it.sh === 'tri') { c.moveTo(l + w / 2, t); c.lineTo(l + w, t + h); c.lineTo(l, t + h); c.closePath(); return; }
    if (it.sh === 'star') {
      const cx = l + w / 2, cy = t + h / 2;
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.42 : 1; const px = cx + Math.cos(a) * (w / 2) * r, py = cy + Math.sin(a) * (h / 2) * r; i ? c.lineTo(px, py) : c.moveTo(px, py); }
      c.closePath();
    }
  }
  function drawShape(c, it) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    shapePath(c, it);
    if (it.f && it.sh !== 'line') { c.fillStyle = it.c; c.fill(); }
    else { c.strokeStyle = it.c; c.lineWidth = it.w; c.stroke(); }
  }
  // one pen segment (from point index i-1 to i)
  function seg(c, it, i) {
    const p = it.pts;
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
    // grow the fill one pixel under the line edges so no pale halo is left
    c.putImageData(img, 0, 0);
  }

  function raster(w, h) {
    const cv = document.createElement('canvas'); cv.width = w * R; cv.height = h * R;
    const c = cv.getContext('2d', { willReadFrequently: true }); c.setTransform(R, 0, 0, R, 0, 0);
    const wipe = () => { c.fillStyle = PAPER; c.fillRect(0, 0, w, h); };
    const paint = (it, from = 0) => {
      if (it.k === 'p') for (let i = from; i < it.pts.length; i += 2) seg(c, it, i);
      else if (it.k === 's') drawShape(c, it);
      else if (it.k === 'b') bucket(cv, c, it.x, it.y, it.c);
    };
    const redraw = (items) => { wipe(); items.forEach((it) => paint(it)); };
    wipe();
    return { cv, c, paint, redraw };
  }

  function pad(o) {
    const P = { x: o.x, y: o.y, w: o.w, h: o.h, items: [], out: [], tool: 'pen', size: 7, hue: 0, shade: 0.5, col: '#111111', filled: false, onStroke: null };
    const ras = raster(o.w, o.h);
    let cur = null, drag = null, picking = null;
    const TB = { y1: o.y + o.h + 8, y2: o.y + o.h + 48 };
    const inPad = (m) => m.x >= P.x && m.x <= P.x + P.w && m.y >= P.y && m.y <= P.y + P.h;
    const local = (m) => [Math.round(K.clamp(m.x - P.x, 0, P.w)), Math.round(K.clamp(m.y - P.y, 0, P.h))];
    const fromShade = () => { const l = 8 + P.shade * 84; P.col = hsl(P.hue, P.shade > 0.92 ? 0 : 95, l); };
    // toolbar layout (row 1: tools, filled, undo, clear, sizes; row 2: quick colours, rainbow strip, shade strip, colour)
    const lay = () => {
      const r1 = TOOLS.map(([t], i) => ({ t, x: P.x + i * 42, y: TB.y1, w: 38, h: 34 }));
      let x = P.x + TOOLS.length * 42 + 4;
      const fill = { x, y: TB.y1, w: 38, h: 34 }; x += 42;
      const undo = { x, y: TB.y1, w: 38, h: 34 }; x += 42;
      const clear = { x, y: TB.y1, w: 46, h: 34 }; x += 54;
      const sizes = SIZES.map((sz, i) => ({ sz, x: x + i * 30, y: TB.y1, w: 26, h: 34 }));
      const quick = QUICK.map((c, i) => ({ c, x: P.x + i * 28, y: TB.y2, w: 24, h: 26 }));
      const hueX = P.x + QUICK.length * 28 + 6, hueW = Math.max(120, P.w - (hueX - P.x) - 210);
      const hue = { x: hueX, y: TB.y2, w: hueW, h: 26 };
      const shade = { x: hueX + hueW + 10, y: TB.y2, w: 160, h: 26 };
      const swatch = { x: shade.x + 170, y: TB.y2, w: 30, h: 26 };
      return { r1, fill, undo, clear, sizes, quick, hue, shade, swatch };
    };
    const push = (op) => P.out.push(op);
    const add = (it, send) => { P.items.push(it); ras.paint(it); if (send) push(it.k === 'p' ? { o: 'n', k: 'p', c: it.c, w: it.w, rb: it.rb, pts: it.pts.slice() } : { o: 'i', it }); };

    P.update = (can) => {
      const m = K.mouse;
      if (!can) { cur = null; drag = null; picking = null; return; }
      const L = lay();
      if (m.clicked && o.tools !== false) {
        const hit = (r) => K.inRect(m.x, m.y, r);
        let used = true;
        const tb = L.r1.find(hit);
        if (tb) { P.tool = tb.t; if (P.tool === 'eraser') P.size = Math.max(P.size, 14); K.sfx('click'); }
        else if (hit(L.fill)) { P.filled = !P.filled; K.sfx('click'); }
        else if (hit(L.undo)) { if (P.items.length) { P.items.pop(); ras.redraw(P.items); push({ o: 'u' }); K.sfx('whoosh'); } }
        else if (hit(L.clear)) { P.items = []; ras.redraw(P.items); push({ o: 'c' }); K.sfx('whoosh'); }
        else if (L.sizes.find(hit)) { P.size = L.sizes.find(hit).sz; K.sfx('click'); }
        else if (L.quick.find(hit)) { P.col = L.quick.find(hit).c; if (P.tool === 'eraser' || P.tool === 'rainbow') P.tool = 'pen'; K.sfx('click'); }
        else if (hit(L.hue)) picking = 'hue';
        else if (hit(L.shade)) picking = 'shade';
        else used = false;
        if (used && !picking) return;
      }
      if (picking) {
        if (picking === 'hue') { P.hue = K.clamp((m.x - L.hue.x) / L.hue.w, 0, 1) * 360; }
        else P.shade = K.clamp((m.x - L.shade.x) / L.shade.w, 0, 1);
        fromShade(); if (P.tool === 'eraser') P.tool = 'pen';
        if (!m.down) picking = null;
        return;
      }
      const shape = ['line', 'rect', 'circle', 'tri', 'star'].includes(P.tool);
      if (P.tool === 'bucket') {
        if (m.clicked && inPad(m)) { const [x, y] = local(m); add({ k: 'b', x, y, c: P.col }, true); K.sfx('pop'); P.onStroke?.(P.items[P.items.length - 1]); }
        return;
      }
      if (shape) {
        if (m.down && inPad(m) && !drag) { const [x, y] = local(m); drag = { x, y }; }
        if (drag) {
          const [x, y] = local(m); drag.ex = x; drag.ey = y;
          if (!m.down) {
            if (Math.hypot(drag.ex - drag.x, drag.ey - drag.y) > 4) { const it = { k: 's', sh: P.tool, c: P.col, w: P.size, f: P.filled, a: [drag.x, drag.y, drag.ex, drag.ey] }; add(it, true); P.onStroke?.(it); }
            drag = null;
          }
        }
        return;
      }
      // pen / rainbow / eraser
      if (m.down && (cur || inPad(m))) {
        const p = local(m);
        if (!cur) {
          cur = { k: 'p', c: P.tool === 'eraser' ? PAPER : P.col, w: P.size, pts: p.slice() };
          if (P.tool === 'rainbow') cur.rb = Math.round(P.hue);
          add(cur, true);
          return;
        }
        const n = cur.pts.length;
        if (Math.hypot(cur.pts[n - 2] - p[0], cur.pts[n - 1] - p[1]) > 2) {
          cur.pts.push(p[0], p[1]); ras.paint(cur, n);
          const last = P.out[P.out.length - 1];
          if (last && (last.o === 'p' || (last.o === 'n' && last.pts))) last.pts.push(p[0], p[1]); else push({ o: 'p', pts: p.slice() });
        }
      } else if (cur) { const done = cur; cur = null; P.onStroke?.(done); }
    };
    P.take = () => { const o = P.out; P.out = []; return o; };
    P.apply = (ops) => {
      for (const op of ops || []) {
        if (op.o === 'n') { const it = { k: 'p', c: op.c, w: op.w, pts: op.pts.slice() }; if (op.rb != null) it.rb = op.rb; P.items.push(it); ras.paint(it); }
        else if (op.o === 'p') { const it = P.items[P.items.length - 1]; if (it && it.k === 'p') { const n = it.pts.length; it.pts.push(...op.pts); ras.paint(it, n); } }
        else if (op.o === 'i') { P.items.push(op.it); ras.paint(op.it); }
        else if (op.o === 'u') { P.items.pop(); ras.redraw(P.items); }
        else if (op.o === 'c') { P.items = []; ras.redraw(P.items); }
      }
    };
    P.load = (items) => { P.items = JSON.parse(JSON.stringify(items || [])); ras.redraw(P.items); cur = null; drag = null; };
    P.clear = () => P.load([]);
    P.draw = (toolbar) => {
      const c = K.ctx();
      c.drawImage(ras.cv, P.x, P.y, P.w, P.h);
      K.stroke(P.x, P.y, P.w, P.h, '#ffffff22', 2, 6);
      if (drag && drag.ex != null) {
        c.save(); c.translate(P.x, P.y); c.globalAlpha = 0.7;
        drawShape(c, { sh: P.tool, c: P.col, w: P.size, f: P.filled, a: [drag.x, drag.y, drag.ex, drag.ey] });
        c.restore();
      }
      if (!toolbar || o.tools === false) return;
      const L = lay(), m = K.mouse;
      L.r1.forEach((b, i) => {
        const on = P.tool === b.t;
        K.rect(b.x, b.y, b.w, b.h, on ? '#22e6ff' : '#24203f', 6);
        K.text(TOOLS[i][1], b.x + b.w / 2, b.y + b.h / 2 + 1, b.t === 'rainbow' || b.t === 'bucket' ? 16 : 18, on ? '#05040c' : '#fff', 'center', 'u');
      });
      K.rect(L.fill.x, L.fill.y, L.fill.w, L.fill.h, '#24203f', 6);
      if (P.filled) K.rect(L.fill.x + 10, L.fill.y + 8, 18, 18, P.col, 3); else K.stroke(L.fill.x + 10, L.fill.y + 8, 18, 18, P.col === '#111111' ? '#fff' : P.col, 3, 3);
      K.rect(L.undo.x, L.undo.y, L.undo.w, L.undo.h, '#24203f', 6); K.text('↶', L.undo.x + 19, L.undo.y + 18, 20, '#fff', 'center', 'u');
      K.rect(L.clear.x, L.clear.y, L.clear.w, L.clear.h, '#3a1424', 6); K.text('CLEAR', L.clear.x + 23, L.clear.y + 18, 10, '#ff8aa0', 'center', 'd');
      L.sizes.forEach((b) => { K.rect(b.x, b.y, b.w, b.h, P.size === b.sz ? '#22e6ff44' : '#ffffff11', 5); K.circle(b.x + b.w / 2, b.y + b.h / 2, Math.min(11, b.sz / 2 + 1), '#fff'); });
      L.quick.forEach((b) => { K.rect(b.x, b.y, b.w, b.h, b.c, 5); if (P.col === b.c && P.tool !== 'eraser') K.stroke(b.x - 2, b.y - 2, b.w + 4, b.h + 4, '#22e6ff', 2, 6); });
      // rainbow strip
      const g = c.createLinearGradient(L.hue.x, 0, L.hue.x + L.hue.w, 0);
      for (let i = 0; i <= 12; i++) g.addColorStop(i / 12, hsl(i * 30, 95, 55));
      c.fillStyle = g; c.beginPath(); c.roundRect(L.hue.x, L.hue.y, L.hue.w, L.hue.h, 6); c.fill();
      K.rect(L.hue.x + (P.hue / 360) * L.hue.w - 2, L.hue.y - 3, 4, L.hue.h + 6, '#fff', 2);
      // shade strip for the chosen hue
      const g2 = c.createLinearGradient(L.shade.x, 0, L.shade.x + L.shade.w, 0);
      g2.addColorStop(0, hsl(P.hue, 95, 8)); g2.addColorStop(0.5, hsl(P.hue, 95, 50)); g2.addColorStop(0.92, hsl(P.hue, 95, 85)); g2.addColorStop(1, '#ffffff');
      c.fillStyle = g2; c.beginPath(); c.roundRect(L.shade.x, L.shade.y, L.shade.w, L.shade.h, 6); c.fill();
      K.rect(L.shade.x + P.shade * L.shade.w - 2, L.shade.y - 3, 4, L.shade.h + 6, '#fff', 2);
      // current colour
      if (P.tool === 'rainbow') { const g3 = c.createLinearGradient(L.swatch.x, 0, L.swatch.x + 30, 0); [0, 60, 120, 200, 280].forEach((h, i) => g3.addColorStop(i / 4, hsl(h, 95, 55))); c.fillStyle = g3; c.beginPath(); c.roundRect(L.swatch.x, L.swatch.y, 30, 26, 6); c.fill(); }
      else K.rect(L.swatch.x, L.swatch.y, 30, 26, P.tool === 'eraser' ? PAPER : P.col, 6);
      K.stroke(L.swatch.x, L.swatch.y, 30, 26, '#fff', 2, 6);
      if (inPad(m) && P.tool !== 'bucket' && !K.isTouch) { c.strokeStyle = '#0006'; c.lineWidth = 1; c.beginPath(); c.arc(m.x, m.y, P.size / 2 + 1, 0, Math.PI * 2); c.stroke(); }
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
