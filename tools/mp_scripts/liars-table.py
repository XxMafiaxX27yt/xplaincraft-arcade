# Liar's Table online check: B gets a private hand, both humans take turns (play / call liar), the table keeps going
def st(p, js):
    return p.evaluate("(() => { const K = document.querySelector('.gl-frame').contentWindow.K, s = K._state(); return " + js + "; })()")

A.wait_for_timeout(3000)
print('B hand', st(B, "s.p.find(p => p.me).hand.join('')"), '| A sees counts', st(A, "s.p.map(p => p.hand.length)"), '| B sees counts', st(B, "s.p.map(p => p.n)"))
moves = 0
for i in range(80):
    for P, idx in ((A, 0), (B, 1)):
        info = st(P, "[s.ph, s.turn, !!s.last, s.p[" + str(idx) + "].alive, (s.p.find(p => p.me).hand || []).length, s.round]")
        if info[0] == 'turn' and info[1] == idx and info[3]:
            if info[2] and (i % 3 == 0 or info[4] == 0):
                game_click(P, 820, 512)                          # LIAR!
            else:
                n = info[4]; x = 480 - (n * 62) / 2 + 28
                game_click(P, x, 450); game_click(P, 820, 462)   # pick the first card, PLAY
            moves += 1
    A.wait_for_timeout(500)
    if st(A, "!!s.over"): break
print('human moves', moves, '| A', st(A, "[s.round, s.ph, s.log, s.p.map(p => (p.alive ? 'alive' : 'out') + ' sips ' + p.sips)]"))
print('B', st(B, "[s.round, s.ph, s.log]"))
A.screenshot(path=os.path.join(OUT, 'mp_A.png')); B.screenshot(path=os.path.join(OUT, 'mp_B.png'))
