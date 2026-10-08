# FIND THE NEEDLE online (2 browsers): the same five haystacks on both screens, A clicks every needle quickly,
# B slowly (+ one wrong click) -> both finish, A wins on both screens.
#   python tools/test_mp.py find-the-needle
import time, json

def fr(page):
    return next((f for f in page.frames if 'find-the-needle' in f.url), None)

def ev(page, js):
    return fr(page).evaluate(js)

R = {}
for pg in (A, B):
    t0 = time.time()
    while time.time() - t0 < 30:
        try:
            if ev(pg, 'window.__ftn && window.K && K.net && window.__ftn.ready <= 0'): break
        except Exception: pass
        pg.wait_for_timeout(300)
R['sameStacks'] = ev(A, "window.__ftn.stacks.map((s) => Math.round(s.nx) + ',' + Math.round(s.ny)).join(' ')") == ev(B, "window.__ftn.stacks.map((s) => Math.round(s.nx) + ',' + Math.round(s.ny)).join(' ')")
NEEDLE = "(() => { const s = window.__ftn; if (s.done || s.found) return null; const st = s.stacks[s.r]; return [st.nx, st.ny]; })()"
game_click(B, 5, 530)   # B: one wrong click (snag)
R['B_snag'] = round(ev(B, 'window.__ftn.snag'), 1)
t0 = time.time(); lastB = time.time()
while time.time() - t0 < 90:
    n = ev(A, NEEDLE)
    if n: game_click(A, n[0], n[1])
    if time.time() - lastB > 2.5:
        n = ev(B, NEEDLE)
        if n and ev(B, 'window.__ftn.snag') <= 0: game_click(B, n[0], n[1]); lastB = time.time()
    if ev(A, 'window.__ftn.ended') and ev(B, 'window.__ftn.ended'): break
    A.wait_for_timeout(250)
R['ended'] = [ev(A, 'window.__ftn.ended'), ev(B, 'window.__ftn.ended')]
R['totals_A_B'] = [ev(A, 'window.__ftn.result && +window.__ftn.result.total.toFixed(1)'), ev(B, 'window.__ftn.result && +window.__ftn.result.total.toFixed(1)')]
R['B_sees_A_total'] = ev(B, "Object.values(window.__ftn.others).map((o) => o.total)")
A.screenshot(path=os.path.join(OUT, 'mp_ftn_A.png')); B.screenshot(path=os.path.join(OUT, 'mp_ftn_B.png'))
print(json.dumps(R, indent=1, default=str))
