# NOVEX STRIKE online (2 browsers): direct link, lobby -> START, movement shows up on the other screen,
# a client's shots are checked + applied by the host, the round ends the same on both, the patch pick starts round 2.
#   python tools/test_mp.py novex-strike --q test            (add &relay to force the backup link)
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
# 1. both games loaded, linked
for name, pg in (('A', A), ('B', B)):
    wait(pg, 'window.__N && window.__S', 30)
R['links'] = wait(A, "window.__N.allLinked() && window.__N.linkInfo().map((p) => p.link + ' ' + (p.rtt != null ? Math.round(p.rtt * 1000) + 'ms' : '?'))", 25)
R['linkB'] = ev(B, "window.__N.linkInfo().map((p) => p.link)")
# 2. the host (A) starts from the lobby
ok = wait(A, "(() => { const b = document.querySelector('[data-go]'); return b && !b.disabled; })()", 25)
R['startEnabled'] = bool(ok)
fr(A).click('[data-go]')
A.wait_for_timeout(1500)
R['phase'] = [ev(A, 'window.__S.phase'), ev(B, 'window.__S.phase')]
R['fighters'] = [ev(A, 'window.__S.fighters.map((f) => f.name + (f.remote ? "*" : ""))'), ev(B, 'window.__S.fighters.map((f) => f.name + (f.remote ? "*" : ""))')]
# 3. wait for FIGHT, B walks forward: A must see B where B is
wait(A, "window.__S.phase === 'live'", 8); wait(B, "window.__S.phase === 'live'", 8)
ev(B, "window.__K3.input.sim.hold('KeyW')"); B.wait_for_timeout(1200); ev(B, "window.__K3.input.sim.release('KeyW')"); B.wait_for_timeout(600)
pB = ev(B, "(() => { const p = window.__S.me.feet(); return [p.x, p.y, p.z]; })()")
pBatA = ev(A, f"(() => {{ const f = window.__S.fighters.find((x) => x.nid === window.__S.me.nid ? false : x.remote); const p = f.feet(); return [p.x, p.y, p.z]; }})()")
R['moveSync'] = {'B_says': [round(v, 2) for v in pB], 'A_sees': [round(v, 2) for v in pBatA], 'err_m': round(((pB[0] - pBatA[0]) ** 2 + (pB[2] - pBatA[2]) ** 2) ** 0.5, 2)}
# 4. B (a client) walks up to A and shoots: the host checks the claims and A loses HP on both screens
# two open floor spots 5-7 m apart that can see each other (from the bots' nav map)
spots = ev(A, """(() => { const G = window.__S, K3 = window.__K3, nodes = G.nav.nodes;
  for (let i = 0; i < 4000; i++) { const a = nodes[Math.floor(Math.random() * nodes.length)], b = nodes[Math.floor(Math.random() * nodes.length)];
    const d = Math.hypot(a.x - b.x, a.z - b.z); if (d < 5 || d > 7 || Math.abs(a.y - b.y) > 0.2 || a.y > 0.5) continue;
    const o = { x: a.x, y: a.y + 1.4, z: a.z }, v = { x: b.x - a.x, y: 0, z: b.z - a.z }; const l = Math.hypot(v.x, v.z); v.x /= l; v.z /= l;
    if (!K3.phys.ray(o, v, l)) return [[a.x, a.y, a.z], [b.x, b.y, b.z]]; }
  return null; })()""")
R['spots'] = spots
ev(A, f"window.__S.me.ch.teleport({spots[0][0]}, {spots[0][1]} + 0.05, {spots[0][2]})")
ev(B, f"(() => {{ const G = window.__S; G.me.ch.teleport({spots[1][0]}, {spots[1][1]} + 0.05, {spots[1][2]}); window.__aimAt = G.fighters.find((f) => f !== G.me); }})()")
B.wait_for_timeout(700)
hp0 = [ev(A, 'window.__S.me.hp'), ev(B, "window.__S.fighters.find((f) => f !== window.__S.me).hp")]
for i in range(40):
    ev(B, """(() => { const G = window.__S, me = G.me, a = window.__aimAt, e = me.eye(), p = a.feet(); const dx = p.x - e.x, dy = p.y + 1.1 - e.y, dz = p.z - e.z; me.yaw = Math.atan2(dx, dz); me.pitch = -Math.atan2(dy, Math.hypot(dx, dz)); window.__K3.input.sim.hold('Mouse0'); })()""")
    B.wait_for_timeout(50)
    if not ev(A, 'window.__S.me.alive'): break
ev(B, "window.__K3.input.sim.release('Mouse0')")
B.wait_for_timeout(800)
R['debugShot'] = ev(B, """(() => { const G = window.__S, me = G.me, a = window.__aimAt; const e = me.eye(), p = a.feet();
  return { ammo: me.arms.ammo, cur: me.arms.cur, list: me.arms.list, swapT: me.arms.swapT, me: [e.x, e.y, e.z].map((v) => +v.toFixed(2)), a: [p.x, p.y, p.z].map((v) => +v.toFixed(2)), aAlive: a.alive, phase: G.phase, sprint: me.sprinting, ss: me.sprintStop }; })()""")
R['meTeamB'] = ev(B, "window.__S.me.team")
R['hp_A_before'] = hp0
R['hp_A_after'] = [ev(A, 'window.__S.me.hp'), ev(B, "window.__S.fighters.find((f) => f !== window.__S.me).hp")]
R['A_alive'] = [ev(A, 'window.__S.me.alive'), ev(B, "window.__S.fighters.find((f) => f !== window.__S.me).alive")]
R['statsB'] = [ev(A, "(() => { const G = window.__S, b = G.fighters.find((f) => f !== G.me); return G.stats.get(b); })()"), ev(B, 'window.__S.stats.get(window.__S.me)')]
# 5. round over on both, same score; the loser (A, the host) picks a patch -> round 2 on both
wait(A, "window.__S.phase === 'patch' || window.__S.round === 2", 8)
R['score'] = [ev(A, 'window.__S.score'), ev(B, 'window.__S.score')]
R['phaseAfter'] = [ev(A, 'window.__S.phase'), ev(B, 'window.__S.phase')]
if ev(A, "!!document.querySelector('[data-p]')"):
    fr(A).click('[data-p]')
A.wait_for_timeout(1500)
R['round2'] = [ev(A, 'window.__S.round'), ev(B, 'window.__S.round')]
R['patch'] = [ev(A, 'window.__S.patchName'), ev(B, 'window.__S.patchName')]
R['A_alive_round2'] = [ev(A, 'window.__S.me.alive'), ev(B, "window.__S.fighters.find((f) => f !== window.__S.me).alive")]
A.wait_for_timeout(1200)
A.screenshot(path=os.path.join(OUT, 'mp_strike_A.png')); B.screenshot(path=os.path.join(OUT, 'mp_strike_B.png'))
R['errA'] = ev(A, "window.__errs || null");
print(json.dumps(R, indent=1, default=str))
