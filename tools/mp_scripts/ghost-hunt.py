# Ghost Hunt online check: both get the same ghost; B walks + toggles a light + marks the journal; A (host) must see it all
def st(p, js):
    return p.evaluate("(() => { const K = document.querySelector('.gl-frame').contentWindow.K, s = K._state(); return " + js + "; })()")

A.wait_for_timeout(3000)
print('A ghost', st(A, "[s.ready, s.groom, s.type && s.type[0]]"), '| B ghost', st(B, "[s.ready, s.groom, s.type && s.type[0]]"))
B.keyboard.down('KeyD'); B.wait_for_timeout(1800); B.keyboard.up('KeyD')     # walk into the foyer
B.wait_for_timeout(600)
print('B pos on B', st(B, "[Math.round(s.p[1].x), Math.round(s.p[1].y)]"), '| on A', st(A, "[Math.round(s.p[1].x), Math.round(s.p[1].y)]"))
B.keyboard.press('KeyE'); B.wait_for_timeout(900)                              # light switch in the foyer
print('foyer light  A:', st(A, "!!s.lights.f"), ' B:', st(B, "!!s.lights.f"))
B.keyboard.press('KeyJ'); B.wait_for_timeout(300); game_click(B, 290, 137); game_click(B, 545, 140); B.wait_for_timeout(1200)
print('journal  A:', st(A, "JSON.stringify(s.jr)"), ' B:', st(B, "JSON.stringify(s.jr)"))
A.screenshot(path=os.path.join(OUT, 'mp_A.png')); B.screenshot(path=os.path.join(OUT, 'mp_B.png'))
