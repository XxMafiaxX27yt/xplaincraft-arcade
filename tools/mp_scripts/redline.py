# REDLINE online (2 browsers): link, the leader picks 2 laps + START (2 players + 4 AI), same grid on both,
# both cars driven by the AI driver, the other car shows up where it really is (only a few metres / ~0.1 s behind),
# the race finishes with the same order on both screens, BACK TO LOBBY.
#   python tools/test_mp.py redline --q test
import time, json

def fr(page):
    return next((f for f in page.frames if 'redline' in f.url), None)

def ev(page, js):
    return fr(page).evaluate(js)

def wait(page, js, secs=20, step=250):
    t0 = time.time()
    while time.time() - t0 < secs:
        try:
            v = ev(page, js)
            if v: return v
        except Exception:
            pass
        page.wait_for_timeout(step)
    return None

R = {}
for pg in (A, B):
    wait(pg, 'window.__N && window.__R', 40)
    ev(pg, "(() => { window.__errs = []; addEventListener('error', (e) => window.__errs.push(String(e.message).slice(0, 200))); addEventListener('unhandledrejection', (e) => window.__errs.push('rej ' + String(e.reason).slice(0, 200))); const ce = console.error; console.error = (...a) => { window.__errs.push('ce ' + a.map(String).join(' ').slice(0, 200)); ce(...a); }; })()")
R['links'] = wait(A, "window.__N.allLinked() && window.__N.linkInfo().map((p) => p.link)", 25)
wait(A, "(() => { const b = document.querySelector('[data-go]'); return b && !b.disabled; })()", 25)
fr(A).click('[data-scope="h"][data-k="laps"][data-v="2"]'); A.wait_for_timeout(300)
fr(B).click('[data-scope="m"][data-k="car"][data-v="nova"]'); B.wait_for_timeout(1200)
R['B_pick_seen_by_A'] = ev(A, "(() => { const t = document.body.innerText; return t.includes('NOVA X'); })()")
fr(A).click('[data-go]')
A.wait_for_timeout(1500)
info = "(() => { const G = window.__R; return G.cars.map((c) => c.name + ':' + c.spec.name + (c.remote ? '*' : '')); })()"
R['grid'] = [ev(A, info), ev(B, info)]
R['laps'] = [ev(A, 'window.__R.laps'), ev(B, 'window.__R.laps')]
for pg in (A, B):
    ev(pg, "(() => { const G = window.__R; G.me.ai = true; G.me.skill = 0.9; })()")
wait(A, "window.__R.phase === 'live'", 10)
# B leaves the grid from the back behind the AI cars (other players' cars on B's screen): nobody gets stuck
spd = []
for i in range(8):
    A.wait_for_timeout(1000)
    spd.append(ev(B, "(() => { const G = window.__R, c = G.me, p = c.pos(); return [Math.round(c.speed * 3.6), Math.round(p.x), Math.round(p.z), G.cars.length, window.__N.players.length, window.__N.link(window.__N.players.find((x) => x.id !== window.__N.me)?.id), c.track.idx]; })()") + ev(A, "(() => { const G = window.__R, c = G.me; return [Math.round(c.speed * 3.6), window.__N.players.length]; })()"))
R['launch_B_kmh_x_z_cars_players_link_idx__A_kmh_players'] = spd
R['errs'] = [ev(A, 'window.__errs'), ev(B, 'window.__errs')]
A.wait_for_timeout(6000)
# where B really is vs where A draws it: metres apart and how many seconds of driving that is
lag = []
for i in range(5):
    b = ev(B, "(() => { const c = window.__R.me, p = c.pos(); return [p.x, p.z, c.speed, window.__R.me.nid]; })()")
    a = ev(A, f"(() => {{ const c = window.__R.cars.find((x) => x.nid === {json.dumps(b[3])}); const p = c.pos(); return [p.x, p.z]; }})()")
    d = ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
    lag.append([round(d, 1), round(b[2] * 3.6), round(d / max(1, b[2]), 2)])
    A.wait_for_timeout(700)
R['B_at_A_metres_kmh_seconds'] = lag
A.screenshot(path=os.path.join(OUT, 'mp_redline_A.png')); B.screenshot(path=os.path.join(OUT, 'mp_redline_B.png'))
t0 = time.time()
while time.time() - t0 < 200:
    if ev(A, "window.__R.phase === 'over'") and ev(B, "window.__R.phase === 'over'"): break
    A.wait_for_timeout(1000)
R['raceSecs'] = round(time.time() - t0)
res = "(() => [...document.querySelectorAll('.k3-screen .k3-sub')].map((e) => e.innerText)[0] || '')()"
R['results'] = [ev(A, res), ev(B, res)]
R['sameOrder'] = R['results'][0] == R['results'][1] and 'P1' in R['results'][0]
R['titles'] = [ev(A, "document.querySelector('.k3-title')?.innerText"), ev(B, "document.querySelector('.k3-title')?.innerText")]
if ev(A, "!!document.querySelector('[data-lobby]')"): fr(A).click('[data-lobby]')
B.wait_for_timeout(1500)
R['errs2'] = [ev(A, 'window.__errs'), ev(B, 'window.__errs')]
R['lobbyAgain'] = [ev(A, "!!document.querySelector('[data-go]')"), ev(B, "window.__R.phase === 'menu'")]
print(json.dumps(R, indent=1, default=str))
