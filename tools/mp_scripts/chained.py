# CHAINED online (2 browsers, one chain): link, START, both chained on both screens, A runs away from B -> the
# chain holds A within its length (A's screen) and drags B a little toward A (B's own screen).
#   python tools/test_mp.py chained --q test
import time, json

def fr(page):
    return next((f for f in page.frames if 'chained' in f.url), None)

def ev(page, js):
    return fr(page).evaluate(js)

def wait(page, js, secs=30):
    t0 = time.time()
    while time.time() - t0 < secs:
        try:
            v = ev(page, js)
            if v: return v
        except Exception: pass
        page.wait_for_timeout(250)
    return None

R = {}
for pg in (A, B):
    wait(pg, 'window.__N && window.__C', 40)
R['links'] = wait(A, "window.__N.allLinked() && window.__N.linkInfo().map((p) => p.link)", 25)
wait(A, "(() => { const b = document.querySelector('[data-go]'); return b && !b.disabled; })()", 25)
fr(A).click('[data-go]')
for pg in (A, B): wait(pg, "window.__C.phase === 'live'", 15)
R['chain'] = [ev(A, "window.__C.players.map((P) => P.name + (P.remote ? '*' : '')).join(' - ')"), ev(B, "window.__C.players.map((P) => P.name + (P.remote ? '*' : '')).join(' - ')")]
b0 = ev(B, "(() => { const p = window.__C.me.ch.pos(); return [p.x, p.z]; })()")
# A runs straight away (+x) for 2.5 s
ev(A, "(() => { const G = window.__C; G.me.remote = false; G.__noInput = true; G.__run = setInterval(() => { G.me.input.x = -1; G.me.input.y = 0; }, 5); })()")
A.wait_for_timeout(2500)
gapA = ev(A, "(() => { const [a, b] = window.__C.players.map((P) => P.ch.pos()); return Math.hypot(a.x - b.x, a.z - b.z); })()")
b1 = ev(B, "(() => { const p = window.__C.me.ch.pos(); return [p.x, p.z]; })()")
R['gap_on_A_m'] = round(gapA, 2)
R['B_dragged_m'] = round(((b1[0] - b0[0]) ** 2 + (b1[1] - b0[1]) ** 2) ** 0.5, 2)
print(json.dumps(R, indent=1, default=str))
