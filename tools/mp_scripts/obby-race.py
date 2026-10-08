# OBBY RACE online (2 browsers + 2 bots): link, START, the same 4 racers on both, B's racer seen where it is,
# both players on the bot autopilot -> the race ends with the same results on both screens, BACK TO LOBBY.
#   python tools/test_mp.py obby-race --q test
import time, json

def fr(page):
    return next((f for f in page.frames if 'obby-race' in f.url), None)

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
    wait(pg, 'window.__N && window.__O', 40)
R['links'] = wait(A, "window.__N.allLinked() && window.__N.linkInfo().map((p) => p.link)", 25)
wait(A, "(() => { const b = document.querySelector('[data-go]'); return b && !b.disabled; })()", 25)
fr(A).click('[data-go]'); A.wait_for_timeout(1500)
info = "window.__O.players.map((P) => P.name + (P.remote ? '*' : '')).join(' ')"
R['racers'] = [ev(A, info), ev(B, info)]
for pg in (A, B):
    wait(pg, "window.__O.phase === 'count' || window.__O.phase === 'live'", 15)   # this browser's race has started
    ev(pg, "(() => { const G = window.__O; G.me.auto = true; G.me.skill = 0.95; })()")
wait(A, "window.__O.phase === 'live'", 10); A.wait_for_timeout(5000)
me = ev(B, "window.__O.me.nid")
pb = ev(B, "(() => { const p = window.__O.me.ch.pos(); return [p.x, p.z]; })()")
pa = ev(A, f"(() => {{ const p = window.__O.players.find((P) => P.nid === '{me}').ch.pos(); return [p.x, p.z]; }})()")
R['B_seen_err_m'] = round(((pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2) ** 0.5, 2)
t0 = time.time()
while time.time() - t0 < 200:
    if ev(A, "window.__O.phase === 'over'") and ev(B, "window.__O.phase === 'over'"): break
    A.wait_for_timeout(1000)
R['raceSecs'] = round(time.time() - t0)
st = "(() => { const G = window.__O; return { t: Math.round(G.t), phase: G.phase, fps: Math.round(window.__K3.fps()), P: G.players.map((P) => [P.name, P.wp, Math.round(P.best), P.falls, P.fin != null ? Math.round(P.fin) : null, P.auto ? 'auto' : P.bot ? 'bot' : P.remote ? 'remote' : '?']) }; })()"
R['stateA'] = ev(A, st); R['stateB'] = ev(B, st)
res = "(() => [...document.querySelectorAll('.k3-screen .k3-sub')].map((e) => e.innerText)[0] || '')()"
R['results'] = [ev(A, res), ev(B, res)]
R['sameOrder'] = R['results'][0].split(' · ')[0].split(' ')[1:2] == R['results'][1].split(' · ')[0].split(' ')[1:2]
A.screenshot(path=os.path.join(OUT, 'mp_obby_A.png'))
if ev(A, "!!document.querySelector('[data-lobby]')"): fr(A).click('[data-lobby]')
B.wait_for_timeout(1500)
R['lobbyAgain'] = [ev(A, "!!document.querySelector('[data-go]')"), ev(B, "window.__O.phase === 'menu'")]
print(json.dumps(R, indent=1, default=str))
