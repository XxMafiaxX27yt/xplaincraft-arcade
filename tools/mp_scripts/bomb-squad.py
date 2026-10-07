# BOMB SQUAD online (2 browsers): round 1 the host defuses (B reads the manual), round 2 B defuses (one wrong wire =
# a strike seen by both, then the right answers); both screens must agree; the game ends "2 / 2 BOMBS DEFUSED" on both.
#   python tools/test_mp.py bomb-squad
import time, json

def fr(page):
    return next((f for f in page.frames if 'bomb-squad' in f.url), None)

def ev(page, js):
    return fr(page).evaluate(js)

def wait(page, js, secs=30, step=250):
    t0 = time.time()
    while time.time() - t0 < secs:
        try:
            v = ev(page, js)
            if v: return v
        except Exception:
            pass
        page.wait_for_timeout(step)
    return None

SOLVE = r"""(() => { const s = window.__bs, st = s.st, B = st.bomb;
  B.mods.forEach((M, i) => {
    if (M.done) return;
    if (M.kind === 'wires') doAct(s, i, { i: wireAnswer(M.w, B) });
    if (M.kind === 'button') { const h = buttonAnswer(M, B); doAct(s, i, h === 'tap' ? { how: 'tap' } : { how: 'hold', digits: STRIP[M.strip][1] }); }
    if (M.kind === 'keypad') M.order.forEach((sym) => doAct(s, i, { i: M.syms.indexOf(sym) }));
    if (M.kind === 'flash') for (let stg = 0; stg < 3; stg++) for (let k = 0; k <= stg; k++) doAct(s, i, { c: FLASH[hasVowel(B) ? 'vowel' : 'none'][Math.min(2, st.strikes)][M.seq[k]] });
    if (M.kind === 'wheels') doAct(s, i, { word: M.word });
  });
  return B.mods.map((M) => M.kind + ':' + M.done).join(' '); })()"""
R = {}
for pg in (A, B):
    wait(pg, 'window.__bs && window.K', 30)
    ev(pg, "(() => { const e = K.end; K.end = (st, o) => { window.__end = o; return e(st, o); }; })()")
# round 1: A (the host, first in the party) defuses
wait(A, "window.__bs.ph === 'bomb'", 30); wait(B, "window.__bs.ph === 'bomb'", 10)
R['r1_defuser'] = [ev(A, "window.__bs.pd.def === K.net.me"), ev(B, "window.__bs.pd.def === K.net.me")]
R['B_sees_manual'] = ev(B, "window.__bs.pd.def !== K.net.me && !window.__bs.manual")
A.screenshot(path=os.path.join(OUT, 'mp_bs_A_defuser.png')); B.screenshot(path=os.path.join(OUT, 'mp_bs_B_expert.png'))
R['r1_solve'] = ev(A, SOLVE)
wait(B, "window.__bs.ph === 'res'", 10)
R['r1_res'] = [ev(A, "window.__bs.pd.win"), ev(B, "window.__bs.pd.win")]
# round 2: B defuses - a wrong wire first (a strike on both screens), then the right answers
wait(B, "window.__bs.ph === 'bomb' && window.__bs.round === 2", 30); wait(A, "window.__bs.ph === 'bomb'", 10)
R['r2_defuser'] = [ev(A, "window.__bs.pd.def === K.net.me"), ev(B, "window.__bs.pd.def === K.net.me")]
R['r2_wrong'] = ev(B, "(() => { const s = window.__bs, B = s.st.bomb, i = B.mods.findIndex((M) => M.kind === 'wires'); if (i < 0) { const j = B.mods.findIndex((M) => M.kind === 'wheels'); if (j < 0) return 'none'; doAct(s, j, { word: 'XXXXX' }); return 'wheels'; } const M = B.mods[i]; doAct(s, i, { i: (wireAnswer(M.w, B) + 1) % M.w.length }); return 'wire'; })()")
B.wait_for_timeout(1500)
R['strikes_after_wrong'] = [ev(A, "window.__bs.st.strikes"), ev(B, "window.__bs.st.strikes")]
R['wheel_kept'] = ev(B, "(() => { const s = window.__bs, M = s.st.bomb.mods.find((M) => M.kind === 'wheels'); if (!M) return 'no wheels'; M.pos[0] = (M.pos[0] + 1) % 5; const p = M.pos.join(''); return new Promise((r) => setTimeout(() => r(M.pos.join('') === p ? 'kept' : 'reset'), 1600)); })()")
R['r2_solve'] = ev(B, SOLVE)
wait(A, "window.__bs.ph === 'res'", 10)
R['r2_res'] = [ev(A, "window.__bs.pd.win"), ev(B, "window.__bs.pd.win")]
R['hostSolved'] = ev(A, "window.__bs.pd.st.bomb.mods.map((M) => M.done).join(',')")
# the end
for pg in (A, B):
    wait(pg, "window.__end", 30)
R['end'] = [ev(A, "window.__end && window.__end.title"), ev(B, "window.__end && window.__end.title")]
R['score'] = [ev(A, "window.__end && window.__end.score"), ev(B, "window.__end && window.__end.score")]
print(json.dumps(R, indent=1, default=str))
