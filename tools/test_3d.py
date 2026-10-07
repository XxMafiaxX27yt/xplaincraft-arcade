"""NOVEX 3D test harness - no 3D game ships without passing this.

  python tools/test_3d.py              (needs tools/serve.py on :8787)

Checks (NOVEX STRIKE): assets load, no JS errors, frame rate, NO WALL PHASING (sprint / slide / dash / jump into
every kind of wall for thousands of ticks, a capsule overlap test every tick), ramps + catwalk walkable end to end,
jump height, slide speed, hitscan damage + headshots + walls stopping bullets, a whole bot-vs-bot match plays out,
and phone controls (touch stick moves you, touch buttons exist). Screenshots go to tools/out/3d_*.png
"""
import sys, os, json, time
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8787/games/3d/novex-strike.html'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
results = []

def check(name, ok, info=''):
    results.append((name, bool(ok), info))
    print(('PASS ' if ok else 'FAIL ') + name + (('  ' + str(info)) if info else ''), flush=True)

# shared JS helpers injected into the page
HELPERS = r"""
window.T = (() => {
  const G = window.__S, K3 = window.__K3, R = K3.R;
  const pen = (f) => {   // is this fighter's capsule overlapping the world? (a smaller capsule than the real one)
    const p = f.feet(), h = f.ch.height;
    return K3.world.intersectionWithShape({ x: p.x, y: p.y + h / 2, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, new R.Capsule(Math.max(0.05, h / 2 - 0.4), 0.3), undefined, K3.phys.groups(0xffff, K3.phys.G_WORLD), f.ch.collider);
  };
  const solo = () => {   // a test fighter: the enemy bot, with its brain removed; everyone else switched off
    K3.paused = true; G.brains = []; G.phase = 'test';
    const X = G.fighters.find((f) => f.team === 1);
    for (const f of G.fighters) if (f !== X) { f.alive = false; f.ch.collider.setEnabled(false); }
    X.alive = true; X.ch.collider.setEnabled(true); X.dashT = 0; X.slideT = 0; X.ch.setHeight(1.8); X.vel = { x: 0, y: 0, z: 0 };
    X.input = { move: { x: 0, y: 0 }, jump: false, crouch: false, sprint: false, fire: false, fireTap: false, aim: false, reload: false, swap: -1, ability: false };
    return X;
  };
  return { G, K3, pen, solo };
})();
0;
"""

def page_with(pw, query, touch=False):
    b = pw.chromium.launch(channel='msedge', args=['--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}, has_touch=touch, is_mobile=touch)
    p = ctx.new_page()
    errs = []
    p.on('pageerror', lambda e: errs.append('PAGE ' + str(e)[:300]))
    p.on('console', lambda m: m.type == 'error' and 'favicon' not in m.text and '404' not in m.text and errs.append(m.text[:300]))
    p.on('response', lambda r: r.status >= 400 and 'favicon' not in r.url and errs.append(f'HTTP {r.status} {r.url}'))
    p.goto(BASE + query, wait_until='load')
    p.wait_for_function('window.__S && window.__S.me', timeout=30000)
    p.wait_for_timeout(1500)
    p.evaluate(HELPERS)
    return b, p, errs

with sync_playwright() as pw:
    # ---------- assets, errors, frame rate ----------
    b, p, errs = page_with(pw, '?test&auto=2v2')
    p.wait_for_timeout(3000)
    st = p.evaluate("[T.G.gunsLoaded(), T.K3.fps(), T.G.nav.nodes.length, T.G.fighters.length]")
    check('assets: 4 gun models loaded', st[0] == 4, st[0])
    check('frame rate > 40 fps (2v2, desktop quality)', st[1] > 40, round(st[1]))
    check('bots built a navigation map', st[2] > 500, st[2])
    p.screenshot(path=os.path.join(OUT, '3d_match.png'))

    # ---------- NO WALL PHASING ----------
    res = p.evaluate(r"""(() => {
      const { G, pen, solo } = T, X = solo();
      const cases = [];
      // run at walls, crates, the tunnel, the indoor block, pillars, ramp sides, outer walls - from many angles
      const spots = [[-20, 0], [-14.8, 0.5], [-3.2, 0.2], [0, 7.5], [-8, 6.5], [-11, 9], [-17, -4], [-14.5, -6], [-12, -8.1], [-6, -4], [0, -11.5], [-21, 13], [20, -13], [-10.5, 4.3], [-6.8, -0.4], [5, 2.6]];
      let worst = 0, bad = [];
      spots.forEach(([x, z], si) => {
        for (let k = 0; k < 8; k++) {
          X.dashT = 0; X.slideT = 0; X.ch.setHeight(1.8); X.ch.teleport(x, 0.05, z); X.vel = { x: 0, y: 0, z: 0 }; X.yaw = (k / 8) * Math.PI * 2 + si * 0.37;
          let pens = 0, first = null;
          G.simulate(150, (i) => {
            const I = X.input;
            I.move = { x: Math.sin(i * 0.05) * 0.4, y: 1 }; I.sprint = true;
            I.crouch = i % 50 > 30;                       // slides
            I.jump = i % 37 === 0;
            if (i % 45 === 10) { X.abilityCd = 0; X.abilityKind = 'dash'; I.ability = true; X.useAbility(); }
            X.yaw += Math.sin(i * 0.11) * 0.03;
            if (pen(X)) { pens++; if (!first) { const q = X.feet(); first = [i, +q.x.toFixed(2), +q.y.toFixed(2), +q.z.toFixed(2), X.ch.height, X.dashT > 0, X.slideT > 0, X.grounded]; } }
            const p = X.feet();
            if (Math.abs(p.x) > 22.1 || Math.abs(p.z) > 15.1 || p.y < -0.3) pens += 100;
          });
          if (pens) bad.push([x, z, k, pens, first]);
          worst = Math.max(worst, pens);
          cases.push(pens);
        }
      });
      return { cases: cases.length, bad: bad.slice(0, 6) };
    })()""")
    check('no wall phasing: 128 runs x 150 ticks of sprint / slide / dash / jump into walls', not res['bad'], res)

    # ---------- ramps + catwalk, jump, slide ----------
    res = p.evaluate(r"""(() => {
      const { G, solo } = T, X = solo(), out = {};
      X.ch.teleport(-16.5, 0.05, -10); X.input.move = { x: 0, y: 0 }; G.simulate(5); X.vel = { x: 0, y: 0, z: 0 }; X.yaw = Math.PI / 2;
      let topY = 0, maxX = -99;
      G.simulate(330, () => { X.input.move = { x: 0, y: 1 }; X.input.sprint = false; X.input.crouch = false; X.input.jump = false; const p = X.feet(); if (p.x > -6 && p.x < 6) topY = Math.max(topY, p.y); maxX = Math.max(maxX, p.x); });
      out.catwalkY = +topY.toFixed(2); out.endX = +maxX.toFixed(2); out.endY = +X.feet().y.toFixed(2);
      // jump height
      X.ch.teleport(0, 0.05, 3); X.vel = { x: 0, y: 0, z: 0 }; X.input.move = { x: 0, y: 0 }; G.simulate(10);
      let apex = 0; X.input.jump = true; G.simulate(1); X.input.jump = false; G.simulate(60, () => (apex = Math.max(apex, X.feet().y)));
      out.jump = +apex.toFixed(2);
      // slide: sprint, then crouch
      X.ch.teleport(-17, 0.05, 0); X.vel = { x: 0, y: 0, z: 0 }; X.yaw = Math.PI; X.ch.teleport(0, 0.05, 12.2 - 13); X.yaw = 0;
      X.ch.teleport(-2, 0.05, -6); X.yaw = Math.PI / 2;
      X.input.move = { x: 0, y: 1 }; X.input.sprint = true; G.simulate(40);
      const runSp = Math.hypot(X.vel.x, X.vel.z); X.input.crouch = true; G.simulate(3);
      out.sprint = +runSp.toFixed(2); out.slide = +Math.hypot(X.vel.x, X.vel.z).toFixed(2); out.sliding = X.slideT > 0;
      X.input.crouch = false; X.input.sprint = false;
      return out;
    })()""")
    check('ramp up to the catwalk (3 m)', abs(res['catwalkY'] - 3) < 0.15, res)
    check('across the catwalk and down the far ramp', res['endX'] > 13 and res['endY'] < 0.2, res)
    check('jump height about 1.2 m', 0.9 < res['jump'] < 1.5, res['jump'])
    check('sprint 8.5 m/s, slide ~10 m/s', 8.2 < res['sprint'] < 8.8 and res['sliding'] and res['slide'] > 9.3, res)

    # ---------- shooting ----------
    res = p.evaluate(r"""(() => {
      const { G, K3 } = T, me = G.me, X = T.solo(); const out = {};
      me.alive = true; me.ch.collider.setEnabled(true); G.mods = {};
      const aimAt = (pt) => { const e = me.eye(), dx = pt.x - e.x, dy = pt.y - e.y, dz = pt.z - e.z; me.yaw = Math.atan2(dx, dz); me.pitch = -Math.atan2(dy, Math.hypot(dx, dz)); };
      const setup = (prim, mx, mz, tx, tz) => { X.hp = 100; X.alive = true; X.ch.collider.setEnabled(true); X.ch.teleport(tx, 0.05, tz); X.vel = { x: 0, y: 0, z: 0 }; X.input.move = { x: 0, y: 0 };
        me.primary = prim; me.reset({ x: mx, z: mz, yaw: 0 }); me.arms.swapT = 0; G.simulate(2); };
      // SMG body shots at 8 m in the open
      setup('smg', -3, -1, 5, -1); const hb = () => X.hitboxes();
      let n = 0; G.simulate(40, () => { const b = hb().body; aimAt({ x: b.a.x, y: (b.a.y + b.b.y) / 2, z: b.a.z }); me.arms.bloom = 0; K3.input.sim.hold('Mouse0'); });
      K3.input.sim.release('Mouse0'); out.smgHp = Math.round(X.hp); out.smgAlive = X.alive;
      // pistol headshot = 48 at short range
      setup('smg', -3, -1, 3, -1); me.arms.cur = 1; me.arms.swapT = 0; G.simulate(1);
      aimAt(hb().head); me.arms.bloom = 0; K3.input.sim.press('Mouse0'); G.simulate(1); K3.input.sim.release('Mouse0');
      out.headHp = Math.round(X.hp);
      // a wall between: no damage (target hides behind the tall crate at x -3.2, z 1.8)
      setup('smg', -3.2, -2, -3.2, 4); G.simulate(1);
      G.simulate(30, () => { aimAt(hb().head); K3.input.sim.hold('Mouse0'); }); K3.input.sim.release('Mouse0');
      out.wallHp = Math.round(X.hp);
      return out;
    })()""")
    check('SMG kills at 8 m (17 a hit, 600 rpm)', not res['smgAlive'], res)
    check('pistol headshot does 48', res['headHp'] == 52, res)
    check('walls stop bullets', res['wallHp'] == 100, res)
    p.screenshot(path=os.path.join(OUT, '3d_shoot.png'))

    # ---------- a whole match, bots on both sides (you are a bot too) ----------
    p.evaluate("location.reload()"); p.wait_for_function('window.__S && window.__S.me', timeout=30000); p.wait_for_timeout(1500); p.evaluate(HELPERS)
    res = p.evaluate(r"""(async () => {
      const { G, K3 } = T; const { Brain } = await import('./strike/bot.js');
      K3.paused = true; G.brains.push(new Brain(G, G.me, 'normal'));
      const seen = []; let last = '';
      for (let chunk = 0; chunk < 160 && G.phase !== 'over'; chunk++) {
        G.simulate(300);
        if (G.phase === 'patch') { G.phaseT = 0; }
        const s = G.score.join('-'); if (s !== last) { seen.push(s + ' @' + Math.round(G.time)); last = s; }
      }
      return { phase: G.phase, score: G.score, rounds: G.round, seen, time: Math.round(G.time), kills: [...G.stats.values()].map((v) => v.k) };
    })()""")
    check('a full 2v2 match plays out to 5 (bots only)', res['phase'] == 'over' and max(res['score']) == 5, res)
    check('no JS errors (desktop run)', not errs, errs[:5])
    b.close()

    # ---------- phone controls ----------
    b, p, errs = page_with(pw, '?test&touch&auto=1v1', touch=True)
    p.wait_for_timeout(3500)   # past the 3 s freeze
    n = p.evaluate("T.K3.touchButtons.length")
    check('phone: touch buttons shown in a match', n >= 6, n)
    before = p.evaluate("(() => { const f = T.G.me.feet(); return [f.x, f.z]; })()")
    cdp = p.context.new_cdp_session(p)
    tp = lambda typ, x, y: cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': ([{'x': x, 'y': y, 'id': 1}] if typ != 'touchEnd' else [])})
    tp('touchStart', 200, 500)
    for i in range(1, 12): tp('touchMove', 200, 500 - i * 6); p.wait_for_timeout(60)
    p.wait_for_timeout(900); tp('touchEnd', 0, 0)
    after = p.evaluate("(() => { const f = T.G.me.feet(); return [f.x, f.z]; })()")
    moved = ((after[0] - before[0]) ** 2 + (after[1] - before[1]) ** 2) ** 0.5
    check('phone: left-side stick walks you forward', moved > 2, round(moved, 2))
    yaw0 = p.evaluate("T.G.me.yaw")
    tp('touchStart', 1000, 300)
    for i in range(1, 10): tp('touchMove', 1000 + i * 15, 300); p.wait_for_timeout(30)
    tp('touchEnd', 0, 0); p.wait_for_timeout(100)
    check('phone: right-side drag turns the view', abs(p.evaluate("T.G.me.yaw") - yaw0) > 0.2, round(p.evaluate("T.G.me.yaw") - yaw0, 3))
    p.screenshot(path=os.path.join(OUT, '3d_phone.png'))
    check('no JS errors (phone run)', not errs, errs[:5])
    b.close()

    # ---------- FLOORFALL ----------
    b = pw.chromium.launch(channel='msedge', args=['--ignore-gpu-blocklist'])
    p = b.new_page(viewport={'width': 1280, 'height': 720}); errs = []
    p.on('pageerror', lambda e: errs.append('PAGE ' + str(e)[:300]))
    p.on('response', lambda r: r.status >= 400 and 'favicon' not in r.url and errs.append(f'HTTP {r.status} {r.url}'))
    p.goto('http://localhost:8787/games/3d/floorfall.html?test&auto', wait_until='load'); p.wait_for_function('window.__F && window.__F.me', timeout=30000); p.wait_for_timeout(4000)
    res = p.evaluate(r"""(() => { const G = window.__F, K3 = window.__K3; K3.paused = true; const me = G.me, out = {};
      out.tiles = G.tiles.length; out.anims = Object.keys(me.av.groups).length;
      // stand on a fresh tile: I must not sink into it, and it must crack + drop me to the floor below
      const t = G.tiles.find((t) => t.l === 0 && t.ring === 4 && t.state === 'solid'); me.ch.teleport(t.x, 0.05, t.z); me.vel = { x: 0, y: 0, z: 0 };
      let minY = 9; for (let i = 0; i < 30; i++) { G.simulate(1); minY = Math.min(minY, me.ch.pos().y); }
      out.standY = +minY.toFixed(3); out.cracked = t.state;
      G.simulate(150); out.afterY = +me.ch.pos().y.toFixed(2);
      // a whole game (you are a bot too)
      me.bot = true; me.skill = 0.8; let n = 0; while (G.phase !== 'over' && n < 60 * 300) { G.simulate(60); n += 60; }
      out.phase = G.phase; out.secs = Math.round(G.t); out.places = G.players.map((P) => P.place).sort().join(',');
      return out; })()""")
    check('floorfall: 1300+ tiles, animated characters', res['tiles'] > 1200 and res['anims'] >= 10, res)
    check('floorfall: standing on a tile holds you up, then it cracks and drops you a floor', res['standY'] > -0.05 and res['afterY'] < -5, res)
    check('floorfall: a whole 8-player game ends with places 1-8', res['phase'] == 'over' and res['places'] == '1,2,3,4,5,6,7,8', res)
    check('floorfall: no JS errors', not errs, errs[:5])
    b.close()
    b = pw.chromium.launch(channel='msedge'); ctx = b.new_context(viewport={'width': 900, 'height': 420}, has_touch=True, is_mobile=True); p = ctx.new_page(); errs = []
    p.on('pageerror', lambda e: errs.append('PAGE ' + str(e)[:300]))
    p.goto('http://localhost:8787/games/3d/floorfall.html?test&touch&auto', wait_until='load'); p.wait_for_function('window.__F && window.__F.me', timeout=30000); p.wait_for_timeout(3600)
    before = p.evaluate("(() => { const q = window.__F.me.ch.pos(); return [q.x, q.z]; })()")
    cdp = p.context.new_cdp_session(p)
    tp = lambda typ, x, y: cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': ([{'x': x, 'y': y, 'id': 1}] if typ != 'touchEnd' else [])})
    tp('touchStart', 150, 300)
    for i in range(1, 10): tp('touchMove', 150, 300 - i * 6); p.wait_for_timeout(50)
    p.wait_for_timeout(700); tp('touchEnd', 0, 0)
    after = p.evaluate("(() => { const q = window.__F.me.ch.pos(); return [q.x, q.z]; })()")
    moved = ((after[0] - before[0]) ** 2 + (after[1] - before[1]) ** 2) ** 0.5
    check('floorfall phone: stick runs you, JUMP button shown', moved > 1.5 and p.evaluate("window.__K3.touchButtons.length") == 1, round(moved, 2))
    p.screenshot(path=os.path.join(OUT, '3d_floorfall_phone.png'))
    check('floorfall phone: no JS errors', not errs, errs[:5])
    b.close()

    # ---------- REDLINE ----------
    b = pw.chromium.launch(channel='msedge', args=['--ignore-gpu-blocklist'])
    p = b.new_page(viewport={'width': 1280, 'height': 720}); errs = []
    p.on('pageerror', lambda e: errs.append('PAGE ' + str(e)[:300]))
    p.on('response', lambda r: r.status >= 400 and 'favicon' not in r.url and errs.append(f'HTTP {r.status} {r.url}'))
    p.goto('http://localhost:8787/games/3d/redline.html?test&auto', wait_until='load'); p.wait_for_function('window.__R && window.__R.me', timeout=30000); p.wait_for_timeout(800)
    res = p.evaluate(r"""(() => { const G = window.__R, K3 = window.__K3; K3.paused = true; const me = G.me, out = {};
      const park = () => G.cars.filter((c) => c !== me).forEach((c, i) => c.place({ x: 600 + i * 20, y: 0, z: 600 }, 0));
      // launch control: manual box, revs climb while held -> release in the green = perfect launch
      me.auto = false; me.input = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false, up: false, down: false };
      let peak = 0; for (let i = 0; i < 90; i++) { me.input.throttle = 1; me.step(1 / 60, { countdown: true }); peak = Math.max(peak, me.rpm); }
      out.revUp = Math.round(peak);
      me.rpm = me.spec.redline * 0.72; me.events = []; me.launch(); out.perfectLaunch = me.events.includes('launch');
      me.rpm = me.spec.redline * 0.97; me.events = []; me.launch(); out.wheelspin = me.events.includes('spin');
      // straight-line run on the main straight: speed, turbo spool, gears, a perfect manual shift
      park(); me.place({ x: 0, y: 0, z: -95 }, 0); G.phase = 'live'; G.race.countdown = false; me.launchT = 0; me.auto = true;
      let maxV = 0, boostLow = 1, boostHigh = 0; me.events = [];
      let maxGear = 1;   // (the straight bends gently toward turn 1 after ~300 m - this run never steers, so stop before it)
      for (let i = 0; i < 320; i++) { me.input.throttle = 1; me.input.steer = 0; me.step(1 / 60, { countdown: false }); K3.world.step(); maxV = Math.max(maxV, me.speed); maxGear = Math.max(maxGear, me.gear); if (me.rpm < 3500) boostLow = Math.min(boostLow, me.boost); if (me.rpm > 6000) boostHigh = Math.max(boostHigh, me.boost); }
      out.kmh = Math.round(maxV * 3.6); out.gear = maxGear; out.boostLow = +boostLow.toFixed(2); out.boostHigh = +boostHigh.toFixed(2); out.onRoad = Math.abs(me.pos().x) < 7 && me.pos().y > -0.5;
      // manual box: accelerate in 1st until the needle is in the green zone, then shift up
      me.place({ x: 0, y: 0, z: -95 }, 0); me.auto = false; me.events = []; let k = 0;
      while ((k < 30 || me.rpm < me.spec.redline * 0.9) && k++ < 600) { me.input.throttle = 1; me.step(1 / 60, { countdown: false }); K3.world.step(); }
      me.input.up = true; me.step(1 / 60, { countdown: false }); me.input.up = false; out.perfectShift = me.events.includes('perfect'); out.shiftRpm = Math.round(me.rpm);
      // drifting fills nitro
      me.auto = true; me.place({ x: 0, y: 0, z: -95 }, 0); me.nitro = 0.2; for (let i = 0; i < 150; i++) { me.input.throttle = 1; me.step(1 / 60, { countdown: false }); K3.world.step(); }
      const n0 = me.nitro; for (let i = 0; i < 80; i++) { me.input.throttle = 1; me.input.steer = 1; me.input.handbrake = true; me.step(1 / 60, { countdown: false }); K3.world.step(); }
      me.input.handbrake = false; me.input.steer = 0; out.nitroGain = +(me.nitro - n0).toFixed(2);
      return out; })()""")
    check('redline: launch control (revs climb on the grid, green = perfect launch, too high = wheelspin)', res['revUp'] > 7000 and res['perfectLaunch'] and res['wheelspin'], res)
    check('redline: 0 -> 150+ km/h on the straight, gears shift, stays on the road', res['kmh'] > 150 and res['gear'] >= 3 and res['onRoad'], res)
    check('redline: turbo spools above 4000 rpm, empty below', res['boostHigh'] > 0.8 and res['boostLow'] < 0.2, res)
    check('redline: shifting at the redline = PERFECT SHIFT (manual)', res['perfectShift'], res)
    check('redline: drifting fills the nitro', res['nitroGain'] > 0.05, res)
    p.evaluate("location.reload()"); p.wait_for_function('window.__R && window.__R.me', timeout=30000); p.wait_for_timeout(500)
    res = p.evaluate(r"""(() => { const G = window.__R, K3 = window.__K3; K3.paused = true; G.me.ai = true; G.me.skill = 0.92; let n = 0;
      while (G.phase !== 'over' && n < 60 * 330) { G.simulate(60); n += 60; }
      return { phase: G.phase, t: Math.round(G.time), finished: G.finish.length, laps: G.cars.map((c) => c.track.laps.length) }; })()""")
    check('redline: a full 6-car, 3-lap race finishes (AI drives every car)', res['phase'] == 'over' and res['finished'] >= 4, res)
    check('redline: no JS errors', not errs, errs[:5])
    b.close()
    b = pw.chromium.launch(channel='msedge'); ctx = b.new_context(viewport={'width': 900, 'height': 420}, has_touch=True, is_mobile=True); p = ctx.new_page(); errs = []
    p.on('pageerror', lambda e: errs.append('PAGE ' + str(e)[:300]))
    p.goto('http://localhost:8787/games/3d/redline.html?test&touch&auto', wait_until='load'); p.wait_for_function('window.__R && window.__R.me', timeout=30000); p.wait_for_timeout(4800)
    btn = p.evaluate("(() => { const b = window.__K3.touchButtons.find((x) => x.a === 'gas'); const r = b.el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, window.__K3.touchButtons.length]; })()")
    cdp = p.context.new_cdp_session(p)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': btn[0], 'y': btn[1], 'id': 1}]})
    p.wait_for_timeout(2500)
    v = p.evaluate("Math.round(window.__R.me.speed * 3.6)")
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': btn[0], 'y': btn[1], 'id': 1}, {'x': 150, 'y': 250, 'id': 2}]})
    for i in range(1, 8): cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': btn[0], 'y': btn[1], 'id': 1}, {'x': 150 + i * 8, 'y': 250, 'id': 2}]}); p.wait_for_timeout(40)
    st = p.evaluate("window.__R.me.input.steer")
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    p.screenshot(path=os.path.join(OUT, '3d_redline_phone.png'))
    check('redline phone: GAS button drives, stick steers', v > 40 and st > 0.5 and btn[2] == 4, [v, st, btn[2]])
    check('redline phone: no JS errors', not errs, errs[:5])
    b.close()

fails = [r for r in results if not r[1]]
print(f'\n{len(results) - len(fails)}/{len(results)} passed')
sys.exit(1 if fails else 0)
