# Letter Chain online check: players take turns adding real letters, both screens agree on the chain;
# then whoever is up plays an impossible letter and must be knocked out on both screens.
def st(p, js):
    return p.evaluate("(() => { const W = document.querySelector('.gl-frame').contentWindow, K = W.K, s = K._state(); return " + js + "; })()")
ids = {}
for name, pg in (('A', A), ('B', B)): ids[name] = pg.evaluate("document.querySelector('.gl-frame').contentWindow.K.net.me")
A.wait_for_timeout(3000)
for k in range(6):
    v = st(A, "[s.ph, s.pd && s.pd.who, s.pd && s.pd.chain]")
    if v[0] != 'turn': A.wait_for_timeout(1000); continue
    pg = A if v[1] == ids['A'] else B
    nx = pg.evaluate(f"(() => {{ const D = document.querySelector('.gl-frame').contentWindow.DICT; return D.next('{v[2]}').sort((a, b) => D.count('{v[2]}' + b) - D.count('{v[2]}' + a)); }})()")
    pg.keyboard.press('Key' + nx[0].upper()); pg.wait_for_timeout(900)
    print('chain A', st(A, "s.pd.chain"), '| B', st(B, "s.pd.chain"))
v = st(A, "[s.ph, s.pd.who, s.pd.chain]")
while v[0] != 'turn': A.wait_for_timeout(500); v = st(A, "[s.ph, s.pd.who, s.pd.chain]")
pg = A if v[1] == ids['A'] else B
bad = next(c for c in 'qxzjvkwbfghy' if not pg.evaluate(f"document.querySelector('.gl-frame').contentWindow.DICT.isPrefix('{v[2]}{c}')"))
pg.keyboard.press('Key' + bad.upper()); pg.wait_for_timeout(1200)
print('after bad letter A', st(A, "[s.ph, s.pd.why, s.pd.alive.length, s.pd.ex]"), '| B', st(B, "[s.ph, s.pd.why, s.pd.alive.length, s.pd.ex]"))
A.screenshot(path=os.path.join(OUT, 'mp_A.png')); B.screenshot(path=os.path.join(OUT, 'mp_B.png'))
