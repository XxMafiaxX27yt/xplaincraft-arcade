// NOVEX 3D kit: the shared base for the 3D games (Babylon.js + Rapier, from vendor.js).
//
//   import { boot, V } from '../kit3d/kit3d.js';
//   const K3 = await boot({ title, actions, touch, quality });   engine + scene + physics + input + audio + shell UI
//   K3.scene / K3.engine / K3.canvas / K3.world (Rapier) / K3.R (RAPIER)
//   K3.input.move            {x, y} from WASD / arrows / left touch stick (y = forward)
//   K3.input.look()          {x, y} mouse / right-side touch drag since the last call (radians, sensitivity applied)
//   K3.input.down('fire')    an action is held      K3.input.tap('reload')   pressed this frame
//   K3.phys.box(...)         static box collider      K3.phys.ray(o, d, max, opts)   world raycast
//   K3.phys.character(...)   kinematic capsule with Rapier's character controller (steps, slopes, no wall phasing)
//   K3.audio.load(map) / K3.audio.play(name, {vol, rate, at})
//   K3.loop(update, fixed)   fixed 60 Hz simulation + one render per frame (alpha for interpolation)
//   K3.shell.*               title / pause / end screens, XC (arcade SDK) start + end
//   window.__K3              the same object, for the automated 3D tests
import * as V from './vendor.js';
export { V };
const { RAPIER } = V;

const CSS = `
.k3-root{position:fixed;inset:0;overflow:hidden;background:#05040c;font-family:'Rajdhani','Segoe UI',sans-serif;color:#e8e6ff;user-select:none;-webkit-user-select:none;touch-action:none}
.k3-root canvas{position:absolute;inset:0;width:100%;height:100%;outline:none;touch-action:none}
.k3-ui{position:absolute;inset:0;pointer-events:none}
.k3-ui *{pointer-events:auto}
.k3-hud{position:absolute;inset:0;pointer-events:none}
.k3-hud *{pointer-events:none}
.k3-screen{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(ellipse at center,rgba(20,14,48,.82),rgba(3,2,10,.94));text-align:center;padding:16px;overflow:auto}
.k3-title{font-family:'Orbitron','Segoe UI',sans-serif;font-weight:900;font-size:clamp(30px,7vw,72px);letter-spacing:4px;background:linear-gradient(90deg,#22e6ff,#ff2bd6);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 18px rgba(34,230,255,.35))}
.k3-sub{color:#8e88b8;font-size:clamp(13px,2.2vw,17px);max-width:720px;line-height:1.35}
.k3-btn{font-family:'Orbitron','Segoe UI',sans-serif;font-weight:700;letter-spacing:2px;font-size:clamp(13px,2vw,16px);padding:12px 26px;border-radius:10px;border:1px solid rgba(34,230,255,.55);background:rgba(17,13,36,.9);color:#fff;cursor:pointer;min-width:150px}
.k3-btn:hover{box-shadow:0 0 22px rgba(34,230,255,.35);border-color:#22e6ff}
.k3-btn.primary{background:linear-gradient(90deg,#22b8ff,#c13bff);border:0}
.k3-btn.sel{border-color:#ffd93a;box-shadow:0 0 18px rgba(255,217,58,.35)}
.k3-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.k3-label{font-family:'Orbitron','Segoe UI',sans-serif;font-size:12px;letter-spacing:3px;color:#8e88b8;margin-top:6px}
.k3-load{position:absolute;left:50%;top:60%;transform:translateX(-50%);width:min(320px,70vw);height:6px;border-radius:3px;background:#1d1838;overflow:hidden}
.k3-load i{display:block;height:100%;width:0;background:linear-gradient(90deg,#22e6ff,#ff2bd6);transition:width .2s}
.k3-touch{position:absolute;inset:0;pointer-events:none}
.k3-stick{position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;border:2px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);display:none;pointer-events:none}
.k3-stick i{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(34,230,255,.45);box-shadow:0 0 16px rgba(34,230,255,.5)}
.k3-tbtn{position:absolute;border-radius:50%;border:2px solid rgba(255,255,255,.3);background:rgba(17,13,36,.55);color:#fff;font-family:'Orbitron','Segoe UI',sans-serif;font-weight:700;font-size:11px;letter-spacing:1px;display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none}
.k3-tbtn.on{background:rgba(34,230,255,.35);border-color:#22e6ff}
.k3-tbtn.big{font-size:13px}
.k3-pausebtn{position:absolute;top:10px;right:10px;width:44px;height:44px;border-radius:50%;border:2px solid rgba(255,255,255,.3);background:rgba(17,13,36,.6);color:#fff;font-size:18px;pointer-events:auto}
`;

export async function boot(opts = {}) {
  const K3 = { opts, t: 0, frame: 0 };
  window.__K3 = K3;
  const Q = new URLSearchParams(location.search);
  K3.test = Q.has('test');
  K3.isTouch = Q.has('touch') || (!Q.has('mouse') && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window));

  // ---------- DOM ----------
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  document.body.style.margin = '0';
  const root = document.createElement('div'); root.className = 'k3-root'; document.body.appendChild(root);
  const canvas = document.createElement('canvas'); canvas.tabIndex = 0; root.appendChild(canvas);
  const hud = document.createElement('div'); hud.className = 'k3-hud'; root.appendChild(hud);
  const touchEl = document.createElement('div'); touchEl.className = 'k3-touch'; root.appendChild(touchEl);
  const ui = document.createElement('div'); ui.className = 'k3-ui'; root.appendChild(ui);
  Object.assign(K3, { root, canvas, hud, ui, touchEl });

  // ---------- engine + scene ----------
  const engine = new V.Engine(canvas, !K3.isTouch, { preserveDrawingBuffer: K3.test, stencil: true, powerPreference: 'high-performance', antialias: !K3.isTouch }, true);
  const dpr = window.devicePixelRatio || 1;
  // quality: phones render at a lower resolution (hardware scaling) and drop shadows / glow detail
  K3.quality = Q.get('q') || opts.quality || (K3.isTouch ? 'low' : 'high');
  const scaleFor = (q) => (q === 'low' ? Math.max(1, dpr / 1.25) : q === 'med' ? Math.max(1, dpr / 1.5) : 1);
  engine.setHardwareScalingLevel(scaleFor(K3.quality) * (K3.quality === 'high' ? 1 / Math.min(dpr, 1.5) : 1));
  const scene = new V.Scene(engine);
  scene.skipPointerMovePicking = true;
  scene.autoClear = true;
  scene.clearColor = new V.Color4(0.02, 0.016, 0.05, 1);
  Object.assign(K3, { engine, scene });
  window.addEventListener('resize', () => engine.resize());

  // ---------- physics ----------
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -opts.gravity || -18, z: 0 });
  world.timestep = 1 / 60;
  K3.R = RAPIER; K3.world = world;
  // groups: bit 0 = world, bit 1 = characters. ray filters use these.
  const G_WORLD = 0x0001, G_CHAR = 0x0002;
  const groups = (member, filter) => (member << 16) | filter;
  K3.phys = {
    G_WORLD, G_CHAR, groups,
    box(cx, cy, cz, hx, hy, hz, rot = null, tag = null) {
      const d = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(cx, cy, cz).setCollisionGroups(groups(G_WORLD, 0xffff));
      if (rot) d.setRotation(rot);
      const c = world.createCollider(d); c.userData = tag; return c;
    },
    remove(c) { if (c) world.removeCollider(c, false); },
    // world raycast: { dist, point, normal, collider } or null
    ray(o, dir, max = 200, { chars = false, exclude = null } = {}) {
      const r = new RAPIER.Ray(o, dir);
      const hit = world.castRayAndGetNormal(r, max, true, undefined, groups(0xffff, chars ? G_WORLD | G_CHAR : G_WORLD), exclude || undefined);
      if (!hit) return null;
      const t = hit.timeOfImpact ?? hit.toi;
      return { dist: t, point: { x: o.x + dir.x * t, y: o.y + dir.y * t, z: o.z + dir.z * t }, normal: hit.normal, collider: hit.collider };
    },
    // a kinematic capsule driven by Rapier's character controller
    character({ x, y, z, radius = 0.4, height = 1.8, step = 0.35, slope = 46 }) {
      const half = (h) => Math.max(0.05, h / 2 - radius);
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + height / 2, z));
      let col = world.createCollider(RAPIER.ColliderDesc.capsule(half(height), radius).setCollisionGroups(groups(G_CHAR, G_WORLD | G_CHAR)), body);
      const ctl = world.createCharacterController(0.03);
      ctl.enableAutostep(step, 0.2, false);
      ctl.enableSnapToGround(0.35);
      ctl.setMaxSlopeClimbAngle((slope * Math.PI) / 180);
      ctl.setMinSlopeSlideAngle(((slope + 4) * Math.PI) / 180);
      ctl.setApplyImpulsesToDynamicBodies(false);
      ctl.setSlideEnabled(true);
      const C = {
        body, ctl, radius, height, grounded: false, vel: { x: 0, y: 0, z: 0 },
        get collider() { return col; },
        // feet position
        pos() { const t = body.translation(); return { x: t.x, y: t.y - C.height / 2, z: t.z }; },
        // move by a wanted displacement; returns the real one (walls / floors stop it)
        move(dx, dy, dz) {
          ctl.computeColliderMovement(col, { x: dx, y: dy, z: dz }, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, groups(G_CHAR, G_WORLD | G_CHAR));
          const m = ctl.computedMovement(), t = body.translation();
          body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
          body.setTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z }, true);
          C.grounded = ctl.computedGrounded();
          // what did we touch? walls (steep) and ceilings, as outward normals - slopes and floors are not walls
          C.walls = []; C.ceiling = false;
          for (let i = 0, n = ctl.numComputedCollisions(); i < n; i++) {
            const c = ctl.computedCollision(i); if (!c) continue;
            const nm = c.normal1;
            if (Math.abs(nm.y) < 0.7) C.walls.push({ x: nm.x, y: nm.y, z: nm.z }); else if (nm.y < -0.7) C.ceiling = true;
          }
          return m;
        },
        // the collider must move right now too, or the next move() checks walls at the old spot and can push into one
        teleport(px, py, pz) { body.setTranslation({ x: px, y: py + C.height / 2, z: pz }, true); body.setNextKinematicTranslation({ x: px, y: py + C.height / 2, z: pz }); world.propagateModifiedBodyPositionsToColliders(); C.vel = { x: 0, y: 0, z: 0 }; },
        // change height (crouch); refuses to stand up under a ceiling
        setHeight(h) {
          if (Math.abs(h - C.height) < 0.01) return true;
          const p = C.pos();
          if (h > C.height) {
            const up = world.castShape({ x: p.x, y: p.y + C.height - radius, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 1, z: 0 }, new RAPIER.Ball(radius * 0.95), 0, h - C.height, true, undefined, groups(G_CHAR, G_WORLD), col);
            if (up) return false;
          }
          world.removeCollider(col, false);
          col = world.createCollider(RAPIER.ColliderDesc.capsule(half(h), radius).setCollisionGroups(groups(G_CHAR, G_WORLD | G_CHAR)), body);
          C.height = h; body.setTranslation({ x: p.x, y: p.y + h / 2, z: p.z }, true); world.propagateModifiedBodyPositionsToColliders();
          return true;
        },
        destroy() { world.removeCollider(col, false); world.removeRigidBody(body); world.removeCharacterController(ctl); },
      };
      col.userData = C;
      return C;
    },
  };

  // ---------- input ----------
  const keys = new Set(), pressed = new Set();
  const look = { x: 0, y: 0 };
  K3.settings = Object.assign({ sens: 1.5, touchSens: 1.0, invertY: false, fov: 90, autoFire: false }, JSON.parse(localStorage.getItem('k3_settings') || '{}'));
  K3.saveSettings = () => localStorage.setItem('k3_settings', JSON.stringify(K3.settings));
  const actions = opts.actions || {};
  const inp = {
    move: { x: 0, y: 0 },
    keys, locked: false,
    look() { const o = { x: look.x, y: look.y }; look.x = 0; look.y = 0; return o; },
    down: (a) => (actions[a] || []).some((k) => keys.has(k)) || touchHeld.has(a),
    tap: (a) => (actions[a] || []).some((k) => pressed.has(k)) || touchTapped.has(a),
    key: (k) => keys.has(k),
    // tests drive the game through these
    sim: { hold: (k) => keys.add(k), release: (k) => keys.delete(k), press: (k) => { keys.add(k); pressed.add(k); }, look: (x, y) => { look.x += x; look.y += y; } },
  };
  K3.input = inp;
  const onKey = (e, d) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.code;
    if (d) { if (!keys.has(k)) pressed.add(k); keys.add(k); } else keys.delete(k);
    if (K3.playing && ['Space', 'ArrowUp', 'ArrowDown', 'Tab', 'ControlLeft'].includes(k)) e.preventDefault();
  };
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousedown', (e) => {
    if (K3.isTouch) return;
    if (K3.playing && !inp.locked && !K3.test) canvas.requestPointerLock?.();
    const k = 'Mouse' + e.button; if (!keys.has(k)) pressed.add(k); keys.add(k);
  });
  window.addEventListener('mouseup', (e) => keys.delete('Mouse' + e.button));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    inp.locked = document.pointerLockElement === canvas;
    if (!inp.locked && K3.playing && !K3.isTouch && !K3.test) K3.shell.pause();
  });
  window.addEventListener('mousemove', (e) => {
    if (!inp.locked) return;
    const s = 0.0011 * K3.settings.sens * (K3.lookScale || 1);
    look.x += e.movementX * s; look.y += e.movementY * s * (K3.settings.invertY ? -1 : 1);
  });

  // touch: floating stick on the left, drag to look on the right, buttons from opts.touch
  const touchHeld = new Set(), touchTapped = new Set();
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, lookT = { id: null, x: 0, y: 0 };
  let stickEl = null;
  K3.touchButtons = [];
  K3.setTouchButtons = (list) => {
    K3.touchButtons.forEach((b) => b.el.remove()); K3.touchButtons = [];
    if (!K3.isTouch) return;
    for (const b of list) {
      const el = document.createElement('div'); el.className = 'k3-tbtn' + (b.big ? ' big' : ''); el.textContent = b.label;
      const sz = b.size || 64; Object.assign(el.style, { width: sz + 'px', height: sz + 'px', right: b.right + 'px', bottom: b.bottom + 'px' });
      if (b.top != null) { el.style.bottom = ''; el.style.top = b.top + 'px'; }
      let tid = null;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); const t = e.changedTouches[0]; tid = t.identifier; if (b.toggle) { if (touchHeld.has(b.a)) touchHeld.delete(b.a); else touchHeld.add(b.a); } else touchHeld.add(b.a); touchTapped.add(b.a); el.classList.toggle('on', touchHeld.has(b.a)); b.lookToo && (lookT.id = tid, lookT.x = t.clientX, lookT.y = t.clientY); }, { passive: false });
      const end = (e) => { for (const t of e.changedTouches) if (t.identifier === tid) { if (!b.toggle) touchHeld.delete(b.a); el.classList.toggle('on', touchHeld.has(b.a)); if (lookT.id === tid) lookT.id = null; tid = null; } };
      el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
      el.addEventListener('touchmove', (e) => { if (!b.lookToo) return; e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === lookT.id) { const s = 0.0055 * K3.settings.touchSens * (K3.lookScale || 1); look.x += (t.clientX - lookT.x) * s; look.y += (t.clientY - lookT.y) * s; lookT.x = t.clientX; lookT.y = t.clientY; } }, { passive: false });
      touchEl.appendChild(el); K3.touchButtons.push({ ...b, el });
    }
  };
  if (K3.isTouch) {
    stickEl = document.createElement('div'); stickEl.className = 'k3-stick'; stickEl.innerHTML = '<i></i>'; touchEl.appendChild(stickEl);
    const knob = stickEl.firstChild;
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.42 && stick.id == null) { stick.id = t.identifier; stick.ox = t.clientX; stick.oy = t.clientY; stick.x = stick.y = 0; stickEl.style.display = 'block'; stickEl.style.left = t.clientX + 'px'; stickEl.style.top = t.clientY + 'px'; knob.style.transform = ''; }
        else if (lookT.id == null) { lookT.id = t.identifier; lookT.x = t.clientX; lookT.y = t.clientY; }
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === stick.id) { let dx = t.clientX - stick.ox, dy = t.clientY - stick.oy; const d = Math.hypot(dx, dy), m = 50; if (d > m) { dx *= m / d; dy *= m / d; } stick.x = dx / m; stick.y = -dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`; }
        if (t.identifier === lookT.id) { const s = 0.0055 * K3.settings.touchSens * (K3.lookScale || 1); look.x += (t.clientX - lookT.x) * s; look.y += (t.clientY - lookT.y) * s; lookT.x = t.clientX; lookT.y = t.clientY; }
      }
    }, { passive: false });
    const tend = (e) => { for (const t of e.changedTouches) { if (t.identifier === stick.id) { stick.id = null; stick.x = stick.y = 0; stickEl.style.display = 'none'; } if (t.identifier === lookT.id) lookT.id = null; } };
    canvas.addEventListener('touchend', tend); canvas.addEventListener('touchcancel', tend);
  }
  const readMove = () => {
    let x = 0, y = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    if (stick.id != null) { x = stick.x; y = stick.y; const m = Math.hypot(x, y); if (m < 0.15) x = y = 0; }
    inp.move = { x, y };
  };

  // ---------- audio ----------
  let ac = null, master = null;
  const bufs = {};
  const audio = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = (window.XC ? XC.volume : 0.6); master.connect(ac.destination); } catch (e) { return null; } } if (ac.state === 'suspended') ac.resume(); return ac; };
  K3.audio = {
    async load(map) {
      const a = audio(); if (!a) return;
      await Promise.all(Object.entries(map).map(async ([k, url]) => { try { const r = await fetch(url); bufs[k] = await a.decodeAudioData(await r.arrayBuffer()); } catch (e) { console.warn('sound', k, e); } }));
    },
    // at: {x,y,z} world position -> quieter with distance and panned left/right from the listener
    play(name, { vol = 1, rate = 1, at = null } = {}) {
      const a = audio(), b = bufs[name]; if (!a || !b) return;
      const src = a.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
      const g = a.createGain(); let v = vol;
      let out = g;
      if (at && K3.listener) {
        const L = K3.listener, dx = at.x - L.x, dz = at.z - L.z, d = Math.hypot(dx, at.y - L.y, dz);
        v *= 1 / (1 + d * 0.09);
        if (a.createStereoPanner) { const p = a.createStereoPanner(); const side = (dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw)) / Math.max(1, d); p.pan.value = Math.max(-0.85, Math.min(0.85, side)); g.connect(p); out = p; }
      }
      g.gain.value = v; src.connect(g); out.connect(master); src.start();
    },
    tone(freq, dur = 0.08, type = 'square', vol = 0.05, slide = 0) {
      const a = audio(); if (!a) return;
      const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = freq; if (slide) o.frequency.linearRampToValueAtTime(freq + slide, a.currentTime + dur);
      g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur); o.connect(g).connect(master); o.start(); o.stop(a.currentTime + dur + 0.02);
    },
    unlock: () => audio(),
    // raw Web Audio access for synthesized sounds (engines etc.): { ac, out }
    raw: () => { const a = audio(); return a ? { ac: a, out: master } : null; },
  };

  // ---------- assets ----------
  K3.loadGLB = async (url) => {
    const i = url.lastIndexOf('/');
    return V.LoadAssetContainerAsync(url.slice(i + 1), scene, { rootUrl: url.slice(0, i + 1) });
  };

  // ---------- loop ----------
  K3.loop = (update, render) => {
    let acc = 0, last = performance.now();
    const STEP = 1 / 60;
    engine.runRenderLoop(() => {
      const now = performance.now(); let dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (K3.test && K3.fixedDt) dt = K3.fixedDt;
      readMove();
      if (!K3.paused) {
        acc += dt;
        let n = 0;
        while (acc >= STEP && n < 6) { update(STEP); world.step(); acc -= STEP; n++; K3.t += STEP; pressed.clear(); touchTapped.clear(); }
        if (n === 6) acc = 0;
      }
      render?.(acc / STEP, dt);
      scene.render();
      K3.frame++;
    });
  };
  K3.fps = () => engine.getFps();

  // ---------- shell: title, pause, end ----------
  const screen = (html) => { ui.innerHTML = html ? `<div class="k3-screen">${html}</div>` : ''; return ui.firstChild; };
  K3.shell = {
    screen,
    loading(f) { let el = root.querySelector('.k3-load'); if (!el) { el = document.createElement('div'); el.className = 'k3-load'; el.innerHTML = '<i></i>'; root.appendChild(el); } el.firstChild.style.width = Math.round(f * 100) + '%'; if (f >= 1) setTimeout(() => el.remove(), 250); },
    // again = back from SETTINGS: show the pause screen again (the game is already paused)
    pause(again = false) {
      if (!K3.playing || (K3.paused && !again)) return;
      K3.paused = true; keys.clear();
      const el = screen(`<div class="k3-title" style="font-size:40px">PAUSED</div>
        <div class="k3-row"><button class="k3-btn primary" data-r>RESUME</button><button class="k3-btn" data-s>SETTINGS</button><button class="k3-btn" data-q>QUIT</button></div>
        <div class="k3-sub">${K3.isTouch ? '' : 'click RESUME to lock the mouse again · Esc to pause'}</div>`);
      el.querySelector('[data-r]').onclick = () => K3.shell.resume();
      el.querySelector('[data-s]').onclick = () => K3.shell.settings(() => K3.shell.pause(true));
      el.querySelector('[data-q]').onclick = () => (window.XC ? XC.exit() : history.back());
    },
    resume() { screen(''); K3.paused = false; if (!K3.isTouch && !K3.test) canvas.requestPointerLock?.(); canvas.focus(); },
    settings(back) {
      const S = K3.settings;
      const el = screen(`<div class="k3-title" style="font-size:34px">SETTINGS</div>
        <div class="k3-label">MOUSE SENSITIVITY <b data-v="sens">${S.sens.toFixed(2)}</b></div><input type="range" min="0.1" max="5" step="0.05" value="${S.sens}" data-k="sens" style="width:min(360px,80vw)">
        <div class="k3-label">TOUCH SENSITIVITY <b data-v="touchSens">${S.touchSens.toFixed(2)}</b></div><input type="range" min="0.2" max="3" step="0.05" value="${S.touchSens}" data-k="touchSens" style="width:min(360px,80vw)">
        <div class="k3-label">FIELD OF VIEW <b data-v="fov">${S.fov}</b></div><input type="range" min="80" max="105" step="1" value="${S.fov}" data-k="fov" style="width:min(360px,80vw)">
        <div class="k3-row"><label class="k3-sub"><input type="checkbox" data-c="invertY" ${S.invertY ? 'checked' : ''}> invert look up/down</label><label class="k3-sub"><input type="checkbox" data-c="autoFire" ${S.autoFire ? 'checked' : ''}> auto-fire on phones</label></div>
        <div class="k3-row"><button class="k3-btn primary" data-b>BACK</button></div>`);
      el.querySelectorAll('[data-k]').forEach((r) => (r.oninput = () => { S[r.dataset.k] = Number(r.value); el.querySelector(`[data-v="${r.dataset.k}"]`).textContent = r.dataset.k === 'fov' ? S.fov : S[r.dataset.k].toFixed(2); K3.saveSettings(); K3.onSettings?.(); }));
      el.querySelectorAll('[data-c]').forEach((c) => (c.onchange = () => { S[c.dataset.c] = c.checked; K3.saveSettings(); K3.onSettings?.(); }));
      el.querySelector('[data-b]').onclick = () => back();
    },
  };
  window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && K3.playing) (K3.paused ? K3.shell.resume() : K3.shell.pause()); });
  if (K3.isTouch) { const pb = document.createElement('button'); pb.className = 'k3-pausebtn'; pb.textContent = 'II'; pb.onclick = () => (K3.paused ? K3.shell.resume() : K3.shell.pause()); ui.parentNode.appendChild(pb); K3.pauseBtn = pb; }
  K3.xc = window.XC ? await XC.ready() : null;
  return K3;
}

// a canvas-drawn texture (grid floors, signs) as a Babylon texture
export function canvasTexture(scene, w, h, draw, { repeat = 1, nearest = false } = {}) {
  const t = new V.DynamicTexture('dt', { width: w, height: h }, scene, true, nearest ? V.Texture.NEAREST_SAMPLINGMODE : V.Texture.TRILINEAR_SAMPLINGMODE);
  const c = t.getContext(); draw(c, w, h); t.update(true);
  t.wrapU = t.wrapV = V.Texture.WRAP_ADDRESSMODE; t.uScale = t.vScale = repeat; t.anisotropicFilteringLevel = 8;
  return t;
}
