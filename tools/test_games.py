"""Automatic game tester + cover maker.

  python tools/test_games.py id1 id2 ...     test these games
  python tools/test_games.py --new           test games that have no cover yet
  python tools/test_games.py --all           test everything

For each game: load standalone, start, play random inputs ~7s, check for JS errors and that
the screen keeps changing, then save games/covers/<id>.png (from ?cover=1) and a gameplay
shot. Contact sheets go to tools/out/sheet_*.png for review. Needs the server on :8787.
"""
import sys, os, json, glob, random, hashlib, io
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'out')
COV = os.path.join(ROOT, 'games', 'covers')
os.makedirs(OUT, exist_ok=True); os.makedirs(COV, exist_ok=True)
BASE = 'http://localhost:8787/'

files = sorted(glob.glob(os.path.join(ROOT, 'games', '2d', '*.html')))
ids_all = [os.path.splitext(os.path.basename(f))[0] for f in files]
args = sys.argv[1:]
if '--all' in args: ids = ids_all
elif '--new' in args: ids = [i for i in ids_all if not os.path.exists(os.path.join(COV, i + '.png'))]
else: ids = [a for a in args if not a.startswith('--')]

KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'Enter', 'KeyZ', 'KeyX', 'ShiftLeft', 'Digit1', 'Digit2', 'Digit3']
results = []
covers, plays = [], []

def canvas_hash(page):
    try:
        return page.evaluate("(()=>{const c=document.querySelector('canvas');const x=c.getContext('2d');const d=x.getImageData(0,0,c.width,c.height).data;let h=0;for(let i=0;i<d.length;i+=997)h=(h*31+d[i])|0;return h})()")
    except Exception:
        return None

with sync_playwright() as pw:
    b = pw.chromium.launch(channel='msedge')
    for gid in ids:
        errs = []
        ctx = b.new_context(viewport={'width': 960, 'height': 540})
        p = ctx.new_page()
        p.on('pageerror', lambda e, errs=errs: errs.append(str(e)[:300]))
        p.on('console', lambda m, errs=errs: m.type == 'error' and 'favicon' not in m.text and 'Failed to load resource' not in m.text and errs.append(m.text[:300]))
        r = {'id': gid}
        try:
            p.goto(f'{BASE}games/2d/{gid}.html', wait_until='load')
            p.wait_for_timeout(1300)
            h0 = canvas_hash(p)
            p.keyboard.press('Space'); p.wait_for_timeout(300)
            hashes = set()
            held = set()
            for step in range(70):
                act = random.random()
                if act < 0.45:
                    k = random.choice(KEYS)
                    if k in held: p.keyboard.up(k); held.discard(k)
                    else: p.keyboard.down(k); held.add(k)
                elif act < 0.85:
                    x, y = random.randint(40, 920), random.randint(40, 500)
                    p.mouse.move(x, y)
                    if random.random() < 0.7: p.mouse.click(x, y)
                else:
                    x, y = random.randint(40, 920), random.randint(40, 500)
                    p.mouse.move(x, y); p.mouse.down(); p.mouse.move(x + random.randint(-150, 150), y + random.randint(-150, 150), steps=4); p.mouse.up()
                p.wait_for_timeout(100)
                if step % 10 == 5: hashes.add(canvas_hash(p))
                if step == 35:
                    shot = os.path.join(OUT, f'play_{gid}.png'); p.screenshot(path=shot); plays.append((gid, shot))
            for k in held: p.keyboard.up(k)
            r['frames_changing'] = len(hashes) > 1
            p.goto(f'{BASE}games/2d/{gid}.html?cover=1', wait_until='load')
            p.wait_for_timeout(2600)
            png = p.screenshot()
            im = Image.open(io.BytesIO(png)).convert('RGB').resize((480, 270), Image.LANCZOS)
            cpath = os.path.join(COV, gid + '.png'); im.save(cpath, optimize=True)
            covers.append((gid, cpath))
        except Exception as e:
            errs.append('HARNESS: ' + str(e).splitlines()[0][:200])
        r['errors'] = errs
        r['ok'] = not errs and r.get('frames_changing', False)
        results.append(r)
        print(('OK  ' if r['ok'] else 'FAIL'), gid, '' if r['ok'] else json.dumps({k: v for k, v in r.items() if k != 'id'})[:400], flush=True)
        ctx.close()
    b.close()

def sheet(items, name, w=320, h=180, cols=5):
    if not items: return
    rows = (len(items) + cols - 1) // cols
    S = Image.new('RGB', (cols * w, rows * (h + 18)), (10, 8, 20))
    from PIL import ImageDraw
    d = ImageDraw.Draw(S)
    for i, (gid, path) in enumerate(items):
        try: im = Image.open(path).convert('RGB').resize((w, h))
        except Exception: continue
        x, y = (i % cols) * w, (i // cols) * (h + 18)
        S.paste(im, (x, y + 18)); d.text((x + 4, y + 3), gid, fill=(230, 230, 255))
    S.save(os.path.join(OUT, name))

for k in range(0, len(covers), 20): sheet(covers[k:k + 20], f'sheet_covers_{k // 20}.png')
for k in range(0, len(plays), 20): sheet(plays[k:k + 20], f'sheet_play_{k // 20}.png')
fails = [r for r in results if not r['ok']]
print(f'\n{len(results) - len(fails)}/{len(results)} passed')
json.dump(results, open(os.path.join(OUT, 'results.json'), 'w'), indent=1)
