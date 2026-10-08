# LOOT RUN online co-op (2 browsers): START, the same facility + loot on both, B (not the host) picks up an item
# (the host grants it, A sees B carrying it), B carries it onto the ship -> banked on both screens.
#   python tools/test_mp.py loot-run --q test
import time, json

def fr(page):
    return next((f for f in page.frames if 'loot-run' in f.url), None)

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
    wait(pg, 'window.__N && window.__L', 40)
wait(A, "(() => { const b = document.querySelector('[data-go]'); return b && !b.disabled; })()", 25)
fr(A).click('[data-go]')
for pg in (A, B): wait(pg, "window.__L.phase === 'live'", 15)
same = "window.__L.items.map((i) => i.name + Math.round(i.x)).join(',') + window.__L.quota"
R['sameLoot'] = ev(A, same) == ev(B, same)
# B walks up to item 0 and presses E
ev(B, "(() => { const G = window.__L, it = G.items[0]; G.me.ch.teleport(it.x + 0.5, 0.1, it.z); })()"); B.wait_for_timeout(400)
ev(B, "window.__K3.input.sim.press('KeyE')"); B.wait_for_timeout(1200)
me = ev(B, "window.__L.me.nid")
R['B_carries'] = ev(B, "window.__L.me.carry.length")
R['A_sees_B_carry'] = ev(A, f"window.__L.items[0].by === '{me}'")
ev(B, "(() => { window.__L.me.ch.teleport(0, 0.1, -16); })()")
R['bank'] = [wait(A, "window.__L.bank", 8), wait(B, "window.__L.bank", 5)]
print(json.dumps(R, indent=1, default=str))
