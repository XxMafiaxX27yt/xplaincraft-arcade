# Neon Brawl online check: both pick a fighter, the client walks + punches, the host must see it and the round must run on both
def st(p, js):
    return p.evaluate("(() => { const K = document.querySelector('.gl-frame').contentWindow.K, s = K._state(); return " + js + "; })()")

A.wait_for_timeout(2000)
A.keyboard.press('KeyJ'); B.keyboard.press('KeyD'); B.wait_for_timeout(200); B.keyboard.press('KeyJ')
A.wait_for_timeout(3500)
print('A', st(A, "[s.ph, s.sel, s.f && s.f.map(f => [f.c, Math.round(f.x), f.st])]"))
print('B', st(B, "[s.ph, s.sel, s.f && s.f.map(f => [f.c, Math.round(f.x), f.st])]"))
x0 = st(A, "Math.round(s.f[1].x)")
B.keyboard.down('KeyA'); B.wait_for_timeout(900); B.keyboard.up('KeyA')
x1 = st(A, "Math.round(s.f[1].x)")
print('client walked (host view)', x0, '->', x1, 'OK' if abs(x1 - x0) > 20 else 'NO MOVE')
B.keyboard.down('KeyD'); B.wait_for_timeout(1400); B.keyboard.up('KeyD')
seen = set()
for k in range(12):
    B.keyboard.press(['KeyJ', 'KeyK', 'KeyL'][k % 3]); B.wait_for_timeout(120)
    seen.add(st(A, "s.f[1].st + ':' + (s.f[1].mv || '')"))
print('client moves seen by host', sorted(seen))
print('hp A view', st(A, "s.f.map(f => Math.round(f.hp))"), 'B view', st(B, "s.f.map(f => Math.round(f.hp))"))
A.screenshot(path=os.path.join(OUT, 'mp_A.png')); B.screenshot(path=os.path.join(OUT, 'mp_B.png'))
