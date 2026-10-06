"""Two-player online test: two separate browsers log in as the QA accounts, one makes a party,
the other joins by code, the leader picks a game and starts, then both should be in the game.

  python tools/test_mp.py [game-id]        (default pong-duel; needs tools/serve.py on :8787)
Screenshots: tools/out/mp_A.png, mp_B.png
Accounts come from tools/qa_accounts.json (not in git): [["name", "password"], ["name", "password"]]
"""
import sys, os, time, json
from playwright.sync_api import sync_playwright

GAME = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'pong-duel'
BASE = 'http://localhost:8787/'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
with open(os.path.join(HERE, 'qa_accounts.json'), encoding='utf-8') as f:
    ACC = [tuple(a) for a in json.load(f)]


def login(p, user, pw):
    errs = []
    p.on('pageerror', lambda e: errs.append(str(e)[:300]))
    p.on('console', lambda m: m.type == 'error' and 'favicon' not in m.text and errs.append(m.text[:300]))
    p.goto(BASE, wait_until='load')
    p.wait_for_timeout(1200)
    p.keyboard.press('Enter')
    p.wait_for_selector('form.auth', timeout=20000)
    p.click('[data-tab=old]')
    p.fill('input[name=u]', user)
    p.fill('input[name=p]', pw)
    p.click('form.auth button[type=submit]')
    p.wait_for_selector('#app:not(.hidden) #topbar .tb-me', timeout=30000)
    p.wait_for_timeout(1500)
    return errs


with sync_playwright() as pw:
    b = pw.chromium.launch(channel='msedge')
    A = b.new_context(viewport={'width': 1280, 'height': 760}).new_page()
    B = b.new_context(viewport={'width': 1280, 'height': 760}).new_page()
    ea = login(A, *ACC[0])
    eb = login(B, *ACC[1])
    print('logged in')
    code = A.evaluate("""async () => { const P = await import('/js/party.js'); await P.createParty(); return P.party.code; }""")
    print('party', code)
    B.evaluate(f"""async () => {{ const P = await import('/js/party.js'); await P.joinParty('{code}'); }}""")
    A.wait_for_timeout(2500)
    members = A.evaluate("""async () => (await import('/js/party.js')).party.members.map(m => m.username)""")
    print('members seen by A:', members)
    B.evaluate("""async () => { const P = await import('/js/party.js'); P.sendChat('hello from B'); }""")
    A.wait_for_timeout(1200)
    chat = A.evaluate("""async () => (await import('/js/party.js')).party.chat.filter(c => !c.sys).map(c => c.from + ': ' + (c.text || c.sticker))""")
    print('chat at A:', chat)
    FAST = sys.argv[sys.argv.index('--fast') + 1] if '--fast' in sys.argv else None
    for pg in (A, B):
        # tests only: let 3+ player party games start with the two QA accounts, optionally run game time faster
        pg.evaluate(f"""async () => {{ const G = await import('/js/games.js'); const g = G.GAME['{GAME}']; g.minPlayers = Math.min(g.minPlayers || 2, 2); {"g.file = g.file.split('?')[0] + '?fast=" + FAST + "';" if FAST else ''} }}""")
    A.evaluate(f"""async () => {{ const P = await import('/js/party.js'); P.pickGame('{GAME}'); P.startGame(); }}""")
    A.wait_for_timeout(9000)
    for name, p in (('A', A), ('B', B)):
        fr = p.frame_locator('.gl-frame')
        st = p.evaluate("""() => { const f = document.querySelector('.gl-frame'); if (!f) return 'no frame'; try { const n = f.contentWindow.K && f.contentWindow.K.net; return n ? JSON.stringify({ i: n.index, me: n.me, ids: n.players.map(p => p.id + ':' + p.username), host: n.isHost }) : 'frame without net'; } catch (e) { return 'err ' + e; } }""")
        print(name, st)
    script = os.path.join(HERE, 'mp_scripts', GAME + '.py')
    if os.path.exists(script):
        # per-game play script: gets A, B, gp (game coords -> page coords), game_click, game_drag, OUT
        def gp(page, x, y):
            r = page.evaluate("(() => { const r = document.querySelector('.gl-frame').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()")
            sc = min(r[2] / 960, r[3] / 540)
            return r[0] + (r[2] - 960 * sc) / 2 + x * sc, r[1] + (r[3] - 540 * sc) / 2 + y * sc
        def game_click(page, x, y):
            page.mouse.click(*gp(page, x, y)); page.wait_for_timeout(80)
        def game_drag(page, pts):
            page.mouse.move(*gp(page, *pts[0])); page.mouse.down()
            for q in pts[1:]: page.mouse.move(*gp(page, *q), steps=4)
            page.wait_for_timeout(60); page.mouse.up(); page.wait_for_timeout(120)
        exec(open(script, encoding='utf-8').read(), {'A': A, 'B': B, 'gp': gp, 'game_click': game_click, 'game_drag': game_drag, 'OUT': OUT, 'os': os, 'GAME': GAME, 'HERE': HERE})
    else:
        # move both paddles a bit, let it play
        A.keyboard.down('ArrowDown'); B.keyboard.down('ArrowUp'); A.wait_for_timeout(1500); A.keyboard.up('ArrowDown'); B.keyboard.up('ArrowUp')
        A.wait_for_timeout(2500)
    A.screenshot(path=os.path.join(OUT, 'mp_A.png'))
    B.screenshot(path=os.path.join(OUT, 'mp_B.png'))
    print('errors A:', ea[:5])
    print('errors B:', eb[:5])
    A.evaluate("""async () => { const P = await import('/js/party.js'); await P.leaveParty(); }""")
    B.evaluate("""async () => { const P = await import('/js/party.js'); await P.leaveParty(); }""")
    b.close()
