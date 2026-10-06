# Generic party-game player for two browsers: both type short answers + Enter, click around, scribble on the
# drawing pad and press DONE, until the game's end screen shows on both. Then both final score lines must match.
# Used by the per-game scripts:  exec(open(os.path.join(HERE, 'mp_scripts', '_party.py')).read())
import random, time

def frame(page):
    return next((f for f in page.frames if GAME in f.url), None)

for pg in (A, B):
    frame(pg).evaluate("(() => { const e = K.end; K.end = (st, o) => { window.__end = o; return e(st, o); }; })()")

types = 'typing:' in open(os.path.join(HERE, '..', 'games', '2d', GAME + '.html'), encoding='utf-8').read()
words = ['sand', 'loud', 'pizza', 'ghost', 'cat', 'a tiny boat', 'rocket', 'people']
t0, limit, ends = time.time(), globals().get('LIMIT', 240), {}
shots = [float(x) for x in os.environ.get('MP_SHOTS', '').split(',') if x]
while time.time() - t0 < limit:
    for name, pg in (('A', A), ('B', B)):
        if name in ends: continue
        fr = frame(pg)
        if not fr: ends[name] = {'text': '(game closed)', 'title': 'closed at %.0fs' % (time.time() - t0)}; continue
        e = fr.evaluate('window.__end || null')
        if e: ends[name] = e; continue
        r = random.random()
        if r < 0.35 and types:
            pg.keyboard.type(random.choice(words), delay=5); pg.keyboard.press('Enter')
        elif r < 0.6:
            x, y = random.randint(60, 600), random.randint(110, 400)
            game_drag(pg, [(x, y), (x + random.randint(-120, 120), y + random.randint(-80, 80)), (x + random.randint(-120, 120), y + random.randint(-80, 80))])
        elif r < 0.7:
            game_click(pg, 810, 465)   # DONE / buttons on the right
        else:
            game_click(pg, random.randint(120, 840), random.randint(140, 470))
    if len(ends) == 2: break
    while shots and time.time() - t0 > shots[0]:
        k = shots.pop(0); A.screenshot(path=os.path.join(OUT, f'mpshot_{GAME}_{int(k)}_A.png')); B.screenshot(path=os.path.join(OUT, f'mpshot_{GAME}_{int(k)}_B.png'))
    A.wait_for_timeout(150)

print('END A:', ends.get('A', {}).get('text'), '|', ends.get('A', {}).get('title'))
print('END B:', ends.get('B', {}).get('text'), '|', ends.get('B', {}).get('title'))
print('PARTY RESULT:', 'OK same scores' if len(ends) == 2 and ends['A'].get('text') == ends['B'].get('text') else 'MISMATCH / NOT FINISHED', f'({time.time() - t0:.0f}s)')
