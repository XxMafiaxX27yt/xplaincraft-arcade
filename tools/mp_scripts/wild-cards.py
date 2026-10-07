# Wild Cards online check: hands are private and match the host; the client plays a real turn (draws by clicking the
# deck); then everyone is handed to the bots and the game must finish on both screens.
import time
def st(p, js):
    return p.evaluate("(() => { const K = document.querySelector('.gl-frame').contentWindow.K, s = K._state(); return " + js + "; })()")
A.wait_for_timeout(2500)
print('A sees', st(A, "[s.ph, s.p.map(p => p.name + ':' + p.hand.length).join(' ')]"))
print('B sees', st(B, "[s.ph, s.p.map(p => p.name + ':' + (p.me ? p.hand.length : p.n)).join(' ')]"))
bi = st(B, "s.p.findIndex(p => p.me)")
hostHand = st(A, f"s.p[{bi}].hand.join(',')"); bHand = st(B, f"s.p[{bi}].hand.join(',')")
print('PRIVATE HAND', 'OK' if hostHand == bHand and st(B, "s.p.filter(p => !p.me).every(p => !p.hand.length)") else 'MISMATCH', hostHand)
# wait for B's turn, then B clicks the deck to draw
t0 = time.time()
while st(A, "s.turn") != bi and time.time() - t0 < 60: A.wait_for_timeout(400)
n0 = st(A, f"s.p[{bi}].hand.length"); d0 = st(A, "s.deck.length")
if st(A, "s.ph") == 'turn' and st(A, "s.turn") == bi:
    game_click(B, 375, 226); B.wait_for_timeout(1500)
    print('B drew: deck', d0, '->', st(A, "s.deck.length"), '| B hand (host view)', n0, '->', st(A, f"s.p[{bi}].hand.length"))
else: print('never got B turn', st(A, "[s.ph, s.turn]"))
# everyone becomes a bot: the game must finish on both screens
A.evaluate("(() => { const s = document.querySelector('.gl-frame').contentWindow.K._state(); s.p.forEach(p => p.bot = true); })()")
t0 = time.time()
while time.time() - t0 < 150 and st(A, "s.ph") != 'over': A.wait_for_timeout(1000)
B.wait_for_timeout(1500)
print('END A', st(A, "[s.ph, s.log[0]]"), '| B', st(B, "[s.ph, s.log[0]]"))
A.screenshot(path=os.path.join(OUT, 'mp_A.png')); B.screenshot(path=os.path.join(OUT, 'mp_B.png'))
