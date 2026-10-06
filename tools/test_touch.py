"""Phone-controls tester: opens games as a touch phone (landscape), drags the on-screen joystick
in all four directions and presses every on-screen button, and checks that the game really
received each input (the kit's K.down / K.tap returned true for it).

  python tools/test_touch.py id1 id2 ...     these games
  python tools/test_touch.py --all           every game
Needs the server on :8787. Results: tools/out/touch.json + a summary on screen.
"""
import sys, os, glob, json
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'out')
os.makedirs(OUT, exist_ok=True)
BASE = 'http://localhost:8787/'
ids_all = [os.path.splitext(os.path.basename(f))[0] for f in sorted(glob.glob(os.path.join(ROOT, 'games', '2d', '*.html')))]
args = sys.argv[1:]
ids = ids_all if '--all' in args else [a for a in args if not a.startswith('--')]
LOCAL = '--local' in args

SPY = """(() => {
  window.__hits = new Set();
  const d = K.down, t = K.tap;
  K.down = (...c) => { const r = d(...c); if (r) c.forEach((x) => __hits.add(x)); return r; };
  K.tap = (...c) => { const r = t(...c); if (r) c.forEach((x) => __hits.add(x)); return r; };
  const pd = K.pad, add = (...c) => c.forEach((x) => __hits.add(x));
  K.pad = (n = 0) => { const r = pd(n), w = n === 1 ? 0 : K.local ? 1 : 2, pick = (ar, ws) => (w === 0 ? [ar] : w === 1 ? [ws] : [ar, ws]);
    if (r.x > 0) add(...pick('ArrowRight', 'KeyD')); if (r.x < 0) add(...pick('ArrowLeft', 'KeyA')); if (r.y > 0) add(...pick('ArrowDown', 'KeyS')); if (r.y < 0) add(...pick('ArrowUp', 'KeyW'));
    if (r.a) add(...pick('Enter', 'Space')); if (r.b) add(...pick('ShiftRight', 'ShiftLeft')); return r; };
})()"""
DIRS = {'right': (1, 0, {'ArrowRight', 'KeyD'}), 'left': (-1, 0, {'ArrowLeft', 'KeyA'}), 'up': (0, -1, {'ArrowUp', 'KeyW'}), 'down': (0, 1, {'ArrowDown', 'KeyS'})}


def touch(cdp, kind, x=None, y=None):
    pts = [] if kind == 'touchEnd' else [{'x': x, 'y': y, 'id': 1}]
    cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': pts})


def box(p, sel):
    return p.evaluate("""(s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent && getComputedStyle(e).display !== 'none')
      .map((e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, t: e.textContent }; })""", sel)


def hits(p):
    return set(p.evaluate('[...__hits]'))


def state(p):
    return p.evaluate("document.querySelector('.xt')?.classList.contains('on') ? 'play' : 'not-play'")


results = []
with sync_playwright() as pw:
    b = pw.chromium.launch(channel='msedge')
    for gid in ids:
        ctx = b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True, device_scale_factor=2)
        p = ctx.new_page()
        errs = []
        p.on('pageerror', lambda e, errs=errs: errs.append(str(e)[:200]))
        cdp = ctx.new_cdp_session(p)
        r = {'id': gid}
        try:
            p.goto(f'{BASE}games/2d/{gid}.html' + ('?local=2' if LOCAL else ''), wait_until='load')
            p.wait_for_timeout(900)
            touch(cdp, 'touchStart', 422, 200); touch(cdp, 'touchEnd')
            p.wait_for_timeout(1200)
            p.evaluate(SPY)
            sticks = box(p, '.xt.on .xt-stick')
            r['stick'] = len(sticks)
            r['dirs'] = {}
            for si, s in enumerate(sticks):
                for name, (dx, dy, want) in DIRS.items():
                    if LOCAL: want = {c for c in want if c.startswith('Key' if si == 0 else 'Arrow')}
                    p.evaluate('__hits.clear()')
                    touch(cdp, 'touchStart', s['x'], s['y'])
                    for k in range(1, 6): touch(cdp, 'touchMove', s['x'] + dx * s['w'] * 0.09 * k, s['y'] + dy * s['w'] * 0.09 * k)
                    p.wait_for_timeout(450)
                    got = hits(p)
                    touch(cdp, 'touchEnd'); p.wait_for_timeout(120)
                    other = {c for d in DIRS.values() for c in d[2]} - DIRS[name][2]
                    r['dirs'][f'{si}{name}'] = bool(got & want) and not (got & other)
            r['buttons'] = {}
            for bt in box(p, '.xt.on .xt-b'):
                p.evaluate('__hits.clear()')
                touch(cdp, 'touchStart', bt['x'], bt['y']); p.wait_for_timeout(250)
                got = hits(p)
                touch(cdp, 'touchEnd'); p.wait_for_timeout(150)
                r['buttons'][bt['t']] = sorted(got)[:4]
            r['state'] = state(p)
        except Exception as e:
            errs.append('HARNESS: ' + str(e).splitlines()[0][:160])
        r['errors'] = errs
        bad = []
        if r.get('dirs') and not all(r['dirs'].values()): bad.append('stick ' + ','.join(k for k, v in r['dirs'].items() if not v))
        dead = [k for k, v in r.get('buttons', {}).items() if not v]
        if dead: bad.append('buttons ' + ','.join(dead))
        if errs: bad.append('errors')
        r['bad'] = bad
        results.append(r)
        ctrl = ('stick' * min(1, r.get('stick', 0)) + ('x2 ' if r.get('stick', 0) > 1 else ' ') if r.get('stick') else '') + ' '.join(r.get('buttons', {}).keys())
        print(('FAIL ' if bad else 'OK   ') + gid.ljust(20) + ' [' + ctrl + '] ' + '; '.join(bad))
        ctx.close()
    b.close()
json.dump(results, open(os.path.join(OUT, 'touch.json'), 'w'), indent=1)
print(f"\n{sum(1 for r in results if not r['bad'])}/{len(results)} OK")
