# KEEP IT UP online (2 browsers): the same balloons on both screens, A keeps bopping, B does nothing -> B pops out
# first, A wins on both screens.
#   python tools/test_mp.py keep-it-up
import time, json

def fr(page):
    return next((f for f in page.frames if 'keep-it-up' in f.url), None)

def ev(page, js):
    return fr(page).evaluate(js)

R = {}
for pg in (A, B):
    t0 = time.time()
    while time.time() - t0 < 30:
        try:
            if ev(pg, 'window.__kiu && window.K && K.net'): break
        except Exception: pass
        pg.wait_for_timeout(300)
    ev(pg, "(() => { const e = K.end; K.end = (st, o) => { window.__end = o; return e(st, o); }; })()")
A.wait_for_timeout(1500)
R['sameFirstBalloon'] = ev(A, "Math.round(window.__kiu.balls[0]?.x || 0)") == ev(B, "Math.round(window.__kiu.balls[0]?.x || 0)")
# round 1 nobody plays: both pop out at the same moment with the same score (same balloons, same wind)
t0 = time.time()
while time.time() - t0 < 40 and not (ev(A, "window.__kiu.ended") and ev(B, "window.__kiu.ended")): A.wait_for_timeout(300)
R['idle_scores_A_B'] = [ev(A, "window.__kiu.result && window.__kiu.result.score"), ev(B, "window.__kiu.result && window.__kiu.result.score")]
# round 2: the host presses PLAY AGAIN; A taps the balloons with the mouse, B does nothing
A.wait_for_timeout(1500)
game_click(A, 345, 447)
A.wait_for_timeout(1500)
R['round2_started'] = [ev(A, "!window.__kiu.ended"), ev(B, "!window.__kiu.ended")]
t0 = time.time(); b_out = None
while time.time() - t0 < 60:
    pos = ev(A, "(() => { const s = window.__kiu; const b = s.balls.filter((b) => b.vy > 0 && b.y > 260).sort((a, b) => b.y - a.y)[0]; return b ? [b.x, b.y + b.vy * 0.08] : null; })()")
    if pos: game_click(A, pos[0], pos[1])
    if b_out is None and ev(B, "window.__kiu.out"): b_out = round(time.time() - t0, 1)
    if b_out is not None and time.time() - t0 > b_out + 3:
        ev(A, "window.__kiu.lives = 0")   # A stops after outlasting B
    if ev(A, "window.__kiu.ended") and ev(B, "window.__kiu.ended"): break
    A.wait_for_timeout(60)
R['B_out_after_s'] = b_out
R['A_bops'] = ev(A, "window.__kiu.bops")
R['scores_A_B'] = [ev(A, "window.__kiu.result && window.__kiu.result.score"), ev(B, "window.__kiu.result && window.__kiu.result.score")]
R['A_won'] = R['scores_A_B'][0] is not None and R['scores_A_B'][1] is not None and R['scores_A_B'][0] > R['scores_A_B'][1]
A.screenshot(path=os.path.join(OUT, 'mp_kiu_A.png'))
print(json.dumps(R, indent=1, default=str))
