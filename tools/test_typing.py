"""Typing tester.
Phone: tap the game, the hidden box gets focus (= the phone keyboard would open), type a word -> the game must get the letters.
Laptop: press P while a typing game is running -> it must type, not pause.

  python tools/test_typing.py [game ...]      (default: every game that reads typed letters)
"""
import sys, os, glob, re
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'http://localhost:8787/'
ids = [a for a in sys.argv[1:] if not a.startswith('--')] or sorted(
    os.path.splitext(os.path.basename(f))[0] for f in glob.glob(os.path.join(ROOT, 'games', '2d', '*.html'))
    if re.search(r'K\.keyboard|K\.typed', open(f, encoding='utf-8').read()))

SPY = """(() => { window.__typed = []; window.__paused = false;
  const t = K.typed; K.typed = () => { const r = t(); __typed.push(...r); return r; };
  const tx = K.text; K.text = (s, ...a) => { if (/^PAUSED/.test(String(s))) __paused = true; return tx(s, ...a); }; })()"""

ok = 0
with sync_playwright() as pw:
    b = pw.chromium.launch(channel='msedge')
    for gid in ids:
        res = []
        # phone
        ctx = b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True)
        p = ctx.new_page(); errs = []
        p.on('pageerror', lambda e, errs=errs: errs.append(str(e)[:160]))
        p.goto(f'{BASE}games/2d/{gid}.html', wait_until='load'); p.wait_for_timeout(900)
        p.touchscreen.tap(422, 200); p.wait_for_timeout(1500)
        p.evaluate(SPY)
        p.touchscreen.tap(422, 300); p.wait_for_timeout(300)
        focused = p.evaluate("document.activeElement?.className === 'xt-type'")
        if focused:
            p.keyboard.type('crane', delay=60); p.wait_for_timeout(500)
        got = re.sub(r'(.)\1+', r'\1', ''.join(p.evaluate('__typed')))  # games that read the keyboard twice a frame see each letter twice
        phone_ok = focused and 'CRANE' in got
        res.append(f"phone focus={focused} typed={got[:12]!r}")
        ctx.close()
        # laptop
        ctx = b.new_context(viewport={'width': 1280, 'height': 720})
        p = ctx.new_page()
        p.on('pageerror', lambda e, errs=errs: errs.append(str(e)[:160]))
        p.goto(f'{BASE}games/2d/{gid}.html', wait_until='load'); p.wait_for_timeout(900)
        p.mouse.click(640, 360); p.wait_for_timeout(1500)
        p.evaluate(SPY)
        p.keyboard.press('p'); p.wait_for_timeout(400)
        paused = p.evaluate('__paused'); gotp = 'P' in p.evaluate('__typed')
        p.keyboard.press('Escape'); p.wait_for_timeout(400)
        esc = p.evaluate('__paused')
        laptop_ok = not paused and esc
        res.append(f"laptop P-typed={gotp} P-paused={paused} Esc-pauses={esc}")
        ctx.close()
        good = phone_ok and laptop_ok and not errs
        ok += good
        print(('OK   ' if good else 'FAIL ') + gid.ljust(16) + ' | '.join(res) + (' ERR ' + errs[0] if errs else ''))
    b.close()
print(f'\n{ok}/{len(ids)} OK')
