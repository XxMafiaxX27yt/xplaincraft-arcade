"""Solo playthrough: plays a game to its end screen at high speed with simple 'human' input
(type a word + Enter, click around the middle), checks it really finishes without errors.

  python tools/test_playthrough.py game [game ...] [--max 120]   (seconds of real time per game)
"""
import sys, os, random
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'out')
args = sys.argv[1:]
MAX = int(args[args.index('--max') + 1]) if '--max' in args else 120
ids = [a for a in args if not a.startswith('--') and not a.isdigit()]
WORDS = ['sand', 'ghost', 'pizza', 'a tiny boat for cheese', 'loud', 'people', 'rocket', 'teacher']
ok = 0
with sync_playwright() as pw:
    b = pw.chromium.launch(channel='msedge')
    for gid in ids:
        p = b.new_page(viewport={'width': 960, 'height': 540})
        errs, ended = [], []
        p.on('pageerror', lambda e, errs=errs: errs.append(str(e)[:200]))
        p.add_init_script("window.__ends = []; window.addEventListener('message', (e) => { if (e.data && e.data.type === 'end') window.__ends.push(e.data); });")
        p.goto(f'http://localhost:8787/games/2d/{gid}.html?fast=6', wait_until='load'); p.wait_for_timeout(900)
        p.mouse.click(480, 300); p.wait_for_timeout(500)
        p.evaluate("(() => { const t = K.text; window.__over = false; K.text = (s, ...a) => { if (/PLAY AGAIN/.test(String(s))) window.__over = true; return t(s, ...a); }; const e = K.end; K.end = (st, o) => { window.__end = o; return e(st, o); }; })()")
        types = 'typing:' in open(os.path.join(ROOT, 'games', '2d', gid + '.html'), encoding='utf-8').read()
        t = 0
        while t < MAX * 1000:
            if p.evaluate('!!window.__end') or gid not in p.url: break   # stop at the end screen (never click EXIT / type into other pages)
            if types and random.random() < 0.5:
                p.keyboard.type(random.choice(WORDS), delay=5); p.keyboard.press('Enter')
            p.mouse.click(random.randint(120, 840), random.randint(150, 480))
            p.wait_for_timeout(250); t += 330
        end = p.evaluate('window.__end') if gid in p.url else None
        good = bool(end) and not errs
        ok += good
        print(('OK   ' if good else 'FAIL ') + gid.ljust(16) + (f" ended in {t/1000:.0f}s: {end.get('title')} | {end.get('text')}" if end else ' never reached the end') + (' | ERR ' + errs[0] if errs else ''))
        p.screenshot(path=os.path.join(OUT, f'end_{gid}.png'))
        p.close()
    b.close()
print(f'\n{ok}/{len(ids)} OK')
