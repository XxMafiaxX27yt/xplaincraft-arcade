# NOVEX STRIKE online: the HOST quits in the middle of a 2v2 round -> the other player becomes the host,
# the host's fighter becomes a bot, the bots keep fighting and the round still ends.
#   MP_SCRIPT=tools/mp_scripts/_strike_leave.py python tools/test_mp.py novex-strike --q test
import time, json

def fr(page):
    return next((f for f in page.frames if 'novex-strike' in f.url), None)

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
    wait(pg, 'window.__N && window.__S', 30)
wait(A, "(() => { const b = document.querySelector('[data-go]'); return b && !b.disabled; })()", 25)
fr(A).click('[data-scope="h"][data-k="mode"][data-v="2v2"]'); A.wait_for_timeout(400)
fr(A).click('[data-go]')
wait(B, "window.__S.phase === 'live'", 12)
R['before'] = ev(B, "(() => { const G = window.__S; return { host: window.__N.isHost, fighters: G.fighters.map((f) => f.name + (f.remote ? '*' : '')), brains: G.brains.length }; })()")
# the host leaves the game (back to the arcade)
A.evaluate("document.querySelector('[data-exit]').click()")
t0 = time.time()
R['B_host_after_s'] = None
while time.time() - t0 < 15:
    if ev(B, 'window.__N.isHost'): R['B_host_after_s'] = round(time.time() - t0, 1); break
    B.wait_for_timeout(300)
B.wait_for_timeout(1000)
R['after'] = ev(B, "(() => { const G = window.__S; return { host: window.__N.isHost, players: window.__N.players.length, fighters: G.fighters.map((f) => f.name + (f.remote ? '*' : '')), brains: G.brains.length, phase: G.phase, round: G.round }; })()")
# the round must still finish (bots fight it out; B's own fighter stands still)
r0 = ev(B, 'window.__S.round')
end = wait(B, f"window.__S.phase === 'end' || window.__S.phase === 'patch' || window.__S.round > {r0} || window.__S.phase === 'over'", 75, 500)
R['roundEnded'] = bool(end)
R['score'] = ev(B, 'window.__S.score')
B.screenshot(path=os.path.join(OUT, 'mp_strike_leave_B.png'))
print(json.dumps(R, indent=1, default=str))
