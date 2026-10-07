# FLOORFALL online (2 browsers): link, START (8 on the floor: 2 players + 6 bots), same tiles + gold tiles on both,
# movement shows up on the other screen, cracked tiles match, a whole game ends with the same places on both, BACK TO LOBBY.
#   python tools/test_mp.py floorfall --q test
import time, json

def fr(page):
    return next((f for f in page.frames if 'floorfall' in f.url), None)

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
    wait(pg, 'window.__N && window.__F', 30)
R['links'] = wait(A, "window.__N.allLinked() && window.__N.linkInfo().map((p) => p.link + ' ' + (p.rtt != null ? Math.round(p.rtt * 1000) + 'ms' : '?'))", 25)
R['startEnabled'] = bool(wait(A, "(() => { const b = document.querySelector('[data-go]'); return b && !b.disabled; })()", 25))
fr(A).click('[data-go]')
A.wait_for_timeout(1500)
info = "(() => { const G = window.__F; return { n: G.players.length, names: G.players.map((P) => P.name + (P.remote ? '*' : '')), tiles: G.tiles.length, gold: G.tiles.filter((t) => t.bounce).map((t) => t.i).join(','), phase: G.phase }; })()"
ia, ib = ev(A, info), ev(B, info)
R['players'] = [ia['names'], ib['names']]
R['sameTiles'] = ia['tiles'] == ib['tiles'] and ia['gold'] == ib['gold']
R['tiles'] = ia['tiles']
wait(A, "window.__F.phase === 'live'", 8); wait(B, "window.__F.phase === 'live'", 8)
# B runs for a while
ev(B, "window.__K3.input.sim.hold('KeyW')"); B.wait_for_timeout(1400); ev(B, "window.__K3.input.sim.release('KeyW')"); B.wait_for_timeout(500)
pB = ev(B, "(() => { const p = window.__F.me.ch.pos(); return [p.x, p.y, p.z]; })()")
pBatA = ev(A, f"(() => {{ const G = window.__F, P = G.players.find((x) => x.nid === {json.dumps(ev(B, 'window.__F.me.nid'))}); const p = P.ch.pos(); return [p.x, p.y, p.z]; }})()")
R['moveSync_err_m'] = round(((pB[0] - pBatA[0]) ** 2 + (pB[2] - pBatA[2]) ** 2) ** 0.5, 2)
# tiles B cracked (B's side) must be cracked on A's side too
crackedB = set(ev(B, "window.__F.tiles.filter((t) => t.state !== 'solid').map((t) => t.i)"))
crackedA = set(ev(A, "window.__F.tiles.filter((t) => t.state !== 'solid').map((t) => t.i)"))
R['cracked'] = {'A': len(crackedA), 'B': len(crackedB), 'onlyB': len(crackedB - crackedA), 'onlyA': len(crackedA - crackedB)}
# let the game play out (both players stand still -> they fall when their tiles go; bots run)
t0 = time.time()
while time.time() - t0 < 120:
    if ev(A, "window.__F.phase === 'over'") and ev(B, "window.__F.phase === 'over'"): break
    A.wait_for_timeout(1000)
R['secs'] = round(time.time() - t0)
places = "window.__F.players.map((P) => P.name + '#' + P.place).sort().join(' ')"
R['places'] = [ev(A, places), ev(B, places)]
R['samePlaces'] = R['places'][0] == R['places'][1]
A.screenshot(path=os.path.join(OUT, 'mp_floorfall_A.png')); B.screenshot(path=os.path.join(OUT, 'mp_floorfall_B.png'))
# back to the lobby for everyone
if ev(A, "!!document.querySelector('[data-lobby]')"): fr(A).click('[data-lobby]')
B.wait_for_timeout(1500)
R['lobbyAgain'] = [ev(A, "!!document.querySelector('[data-go]')"), ev(B, "window.__F.phase === 'menu' && !!document.querySelector('[data-leave]')")]
print(json.dumps(R, indent=1, default=str))
