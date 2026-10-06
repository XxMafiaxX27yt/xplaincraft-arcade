# Paint & Hide online check: B (hider) paints + moves, A (host, hunter) must see it; then A shoots B and both agree
def st(p, js):
    return p.evaluate("(() => { const K = document.querySelector('.gl-frame').contentWindow.K, s = K._state(); return " + js + "; })()")

A.wait_for_timeout(2500)
print('A', st(A, "[s.ph, s.round, s.p.map(p => p.name + (p.hunter ? '*' : ''))]"))
print('B', st(B, "[s.ph, s.round, s.p.map(p => p.name + (p.hunter ? '*' : ''))]"))
game_click(B, 120, 110)                       # eyedropper: pick a colour off the room
B.keyboard.down('KeyD'); B.wait_for_timeout(700); B.keyboard.up('KeyD')
L = st(B, "(() => { const m = s.p.find(p => p.me); return m.x > 540 && m.y > 230 ? 8 : 752; })()")
game_click(B, L + 24, 308)                    # paint one cell
game_click(B, L + 46, 479)                    # FILL
B.wait_for_timeout(1500)
mine = st(B, "(() => { const m = s.p.find(p => p.me); return [Math.round(m.x), Math.round(m.y), m.g[0], m.g[40], s.cur]; })()")
seen = st(A, "(() => { const m = s.p[1]; return [Math.round(m.x), Math.round(m.y), m.g[0], m.g[40]]; })()")
print('B sees itself', mine, '| A sees B', seen)
print('PAINT SYNC', 'OK' if mine[2] == seen[2] and abs(mine[0] - seen[0]) < 30 else 'MISMATCH')
A.evaluate("document.querySelector('.gl-frame').contentWindow.K._state().t = 0.3")
A.wait_for_timeout(1500)
ph = st(A, "[s.ph, Math.round(s.p[1].x), Math.round(s.p[1].y), s.shots]")
print('A after paint phase', ph)
game_click(A, ph[1], ph[2])
A.wait_for_timeout(1200)
print('after the shot  A:', st(A, "[s.shots, s.p[1].alive, s.marks.length]"), ' B:', st(B, "[s.shots, s.p[1].alive, s.marks.length]"))
A.screenshot(path=os.path.join(OUT, 'mp_A.png')); B.screenshot(path=os.path.join(OUT, 'mp_B.png'))
