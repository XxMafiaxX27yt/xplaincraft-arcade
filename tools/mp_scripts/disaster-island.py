# DISASTER ISLAND online (2 browsers + bots): START, the same disaster on both screens, the host's strikes reach
# the other player, a death on B's screen shows on A's, the game still ends the same for both.
#   python tools/test_mp.py disaster-island --q test
import time, json

def fr(page):
    return next((f for f in page.frames if 'disaster-island' in f.url), None)

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
    wait(pg, 'window.__N && window.__D', 40)
wait(A, "(() => { const b = document.querySelector('[data-go]'); return b && !b.disabled; })()", 25)
fr(A).click('[data-go]')
for pg in (A, B): wait(pg, "window.__D.phase === 'live'", 15)
R['players'] = [ev(A, "window.__D.players.length"), ev(B, "window.__D.players.length")]
R['disaster'] = [wait(A, "window.__D.dz && window.__D.dz.kind", 20), wait(B, "window.__D.dz && window.__D.dz.kind", 5)]
# wait for a disaster with strikes (meteors / lightning) and see them on B
R['B_got_strikes'] = bool(wait(B, "window.__D.hz.length > 0", 60))
# B drowns / falls out (forced): A must see B out
ev(B, "(() => { const G = window.__D; G.me.under = 3; G.dz = G.dz || { kind: 'flood', t0: G.t, max: 9 }; })()")
me = ev(B, "window.__D.me.nid")
R['A_sees_B_out'] = bool(wait(A, f"!window.__D.players.find((P) => P.nid === '{me}').alive", 8))
for pg in (A, B): wait(pg, "window.__D.phase === 'over'", 170)
place = "(() => window.__D.players.map((P) => P.name + '#' + P.place).sort().join(' '))()"
R['places'] = [ev(A, place), ev(B, place)]
R['same'] = R['places'][0] == R['places'][1]
print(json.dumps(R, indent=1, default=str))
