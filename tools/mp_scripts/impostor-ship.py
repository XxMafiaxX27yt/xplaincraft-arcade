# IMPOSTOR SHIP online (2 browsers + 4 bots): same roles on both screens, B walks and A sees it, B (not the host)
# presses the emergency button -> a meeting on both, both skip, the bots vote -> the eject screen on both -> play again.
#   python tools/test_mp.py impostor-ship
import time, json

def fr(page):
    return next((f for f in page.frames if 'impostor-ship' in f.url), None)

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
    wait(pg, "window.__is && window.__is.ph === 'play'", 40)
roles = "Object.values(window.__is.ents).map((e) => e.name + (e.imp ? '!' : '')).join(' ')"
R['roles'] = [ev(A, roles), ev(B, roles)]
R['sameRoles'] = R['roles'][0] == R['roles'][1]
# B walks right for a second: A must see B there
ev(B, "window.K.vhold ? 0 : 0")
B.keyboard.down('ArrowRight'); B.wait_for_timeout(1000); B.keyboard.up('ArrowRight'); B.wait_for_timeout(800)
me = ev(B, "K.net.me")
pb = ev(B, "[window.__is.ents[K.net.me].x, window.__is.ents[K.net.me].y]")
pa = ev(A, f"[window.__is.ents['{me}'].x, window.__is.ents['{me}'].y]")
R['B_moved_px'] = round(pb[0] - 1000 + 110, 1)
R['A_sees_B_err'] = round(((pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2) ** 0.5, 1)
# B (a client) presses the emergency button
ev(B, "(() => { const e = window.__is.ents[K.net.me]; e.x = 1000; e.y = 250; })()")
B.wait_for_timeout(400); B.keyboard.press('KeyE')
R['meeting'] = [bool(wait(A, "window.__is.ph === 'meet'", 8)), bool(wait(B, "window.__is.ph === 'meet'", 5))]
R['caller_is_B'] = ev(A, f"window.__is.pd.caller === '{me}'")
for pg in (A, B):
    game_click(pg, 480, 490)   # SKIP
B.wait_for_timeout(1500)
R['votes_seen_by_A'] = ev(A, "Object.keys(window.__is.votes).length")
R['eject'] = [bool(wait(A, "window.__is.ph === 'eject' || window.__is.ph === 'end'", 60)), bool(wait(B, "window.__is.ph === 'eject' || window.__is.ph === 'end'", 10))]
R['ejected'] = [ev(A, "window.__is.pd.out || 'nobody'"), ev(B, "window.__is.pd.out || 'nobody'")]
R['after'] = [wait(A, "window.__is.ph === 'play' || window.__is.ph === 'end' ? window.__is.ph : null", 15), wait(B, "window.__is.ph === 'play' || window.__is.ph === 'end' ? window.__is.ph : null", 10)]
A.screenshot(path=os.path.join(OUT, 'mp_is_A.png'))
print(json.dumps(R, indent=1, default=str))
