# SPY GRID online (2 browsers): A = red spymaster (sees the key), B = red agent (does not), blue = bot team.
# A types a clue + number + SEND, B taps a red word (both see it revealed), B ENDS TURN, the bot team plays, red's clue turn comes back.
#   python tools/test_mp.py spy-grid
import time, json

def fr(page):
    return next((f for f in page.frames if 'spy-grid' in f.url), None)

def ev(page, js):
    return fr(page).evaluate(js)

def wait(page, js, secs=30):
    t0 = time.time()
    while time.time() - t0 < secs:
        try:
            v = ev(page, js)
            if v: return v
        except Exception: pass
        page.wait_for_timeout(250)
    return None

R = {}
for pg in (A, B):
    wait(pg, "window.__sg && window.__sg.pd && window.__sg.pd.roles && (window.__sg.ph === 'clue' || window.__sg.ph === 'guess')", 40)
R['roles'] = [ev(A, "JSON.stringify(window.__sg.pd.roles[K.net.me])"), ev(B, "JSON.stringify(window.__sg.pd.roles[K.net.me])")]
R['keys'] = [ev(A, "!!window.__sg.key"), ev(B, "!!window.__sg.key")]
# blue may start: wait for red's clue turn
wait(A, "window.__sg.ph === 'clue' && window.__sg.pd.turn === 'red'", 60)
A.keyboard.type('nebula'); game_click(A, 586, 516); game_click(A, 800, 516)   # number 2, SEND
R['clue'] = [wait(A, "window.__sg.ph === 'guess' && window.__sg.pd.clue.w", 8), wait(B, "window.__sg.ph === 'guess' && window.__sg.pd.clue.w", 8)]
i = ev(A, "window.__sg.pd.words.findIndex((w, i) => !window.__sg.pd.rev[i] && window.__sg.key[i] === 'red')")
game_click(B, 39 + (i % 5) * 178 + 85, 104 + (i // 5) * 76 + 35)
B.wait_for_timeout(1500)
R['revealed'] = [ev(A, f"window.__sg.pd.rev[{i}]"), ev(B, f"window.__sg.pd.rev[{i}]")]
R['left'] = [ev(A, "window.__sg.pd.left.red"), ev(B, "window.__sg.pd.left.red")]
game_click(B, 840, 516)   # END TURN
R['blueTurn'] = bool(wait(A, "window.__sg.pd.turn === 'blue'", 6))
R['backToRed'] = [bool(wait(A, "(window.__sg.ph === 'clue' && window.__sg.pd.turn === 'red') || window.__sg.ph === 'end'", 40)), ev(B, "window.__sg.ph + ' ' + window.__sg.pd.turn")]
B.screenshot(path=os.path.join(OUT, 'mp_sg_B.png'))
print(json.dumps(R, indent=1, default=str))
