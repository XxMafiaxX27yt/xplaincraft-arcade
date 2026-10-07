# Murder Mystery online check: B gets a secret role, moves, and (made sheriff) fires a shot the host sees
def st(p, js):
    return p.evaluate("(() => { const K = document.querySelector('.gl-frame').contentWindow.K, s = K._state(); return " + js + "; })()")

A.wait_for_timeout(1500)
print('roles on host', st(A, "s.p.map(p => p.name + ':' + p.role)"), '| B thinks it is', st(B, "s.role"))
A.evaluate("""(() => { const s = document.querySelector('.gl-frame').contentWindow.K._state(); s.p.forEach((p, i) => { p.role = i === 2 ? 'murderer' : 'inno'; p.gun = false; }); s.p[1].role = 'sheriff'; s.p[1].gun = true; s.roleT = 0; })()""")
print('host after swap', st(A, "[s.p.map(p => p.role), +s.time.toFixed(1), s.roleT]"))
A.wait_for_timeout(3500)
print('host later', st(A, "[s.p.map(p => p.role), +s.time.toFixed(1)]"))
print('B role now', st(B, "s.role"), '| B gun on B', st(B, "s.p[1].gun"))
B.keyboard.down('KeyD'); B.wait_for_timeout(700); B.keyboard.up('KeyD'); B.wait_for_timeout(400)
print('B pos  B:', st(B, "[Math.round(s.p[1].x), Math.round(s.p[1].y)]"), ' A:', st(A, "[Math.round(s.p[1].x), Math.round(s.p[1].y)]"))
game_click(B, 700, 270); A.wait_for_timeout(250)
print('shots seen by A right after B fired:', st(A, "s.shots.length"), '| B cooldown on host', st(A, "+s.p[1].cd.toFixed(1)"))
A.wait_for_timeout(1500)
print('alive  A:', st(A, "s.p.map(p => p.alive ? 1 : 0).join('')"), ' B:', st(B, "s.p.map(p => p.alive ? 1 : 0).join('')"))
A.screenshot(path=os.path.join(OUT, 'mp_A.png')); B.screenshot(path=os.path.join(OUT, 'mp_B.png'))
