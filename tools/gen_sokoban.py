"""Generates solvable Sokoban levels by pulling crates backwards from a solved state, then checks each
with a forward solver and keeps a spread of difficulties. Prints a JS LEVELS array.
  python tools/gen_sokoban.py [count] [seed]
"""
import random, sys
from collections import deque

def solve(walls, targets, crates, p, limit=600000):
    start = (p, frozenset(crates)); seen = {start}; q = deque([(start, 0)]); goal = frozenset(targets)
    while q:
        (pp, cs), d = q.popleft()
        if cs == goal: return d
        if len(seen) > limit: return None
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (pp[0] + dx, pp[1] + dy)
            if n in walls: continue
            ncs = cs
            if n in cs:
                b = (n[0] + dx, n[1] + dy)
                if b in walls or b in cs: continue
                ncs = (cs - {n}) | {b}
            st = (n, ncs)
            if st not in seen: seen.add(st); q.append((st, d + 1))
    return None

def make(w, h, n, rnd):
    walls = {(x, y) for x in range(w) for y in range(h) if x in (0, w - 1) or y in (0, h - 1)}
    for _ in range(rnd.randint(1, (w * h) // 9)):
        walls.add((rnd.randint(2, w - 3), rnd.randint(2, h - 3)))
    free = [(x, y) for x in range(1, w - 1) for y in range(1, h - 1) if (x, y) not in walls]
    if len(free) < n + 4: return None
    targets = set(rnd.sample(free, n)); crates = set(targets)
    p = rnd.choice([c for c in free if c not in crates])
    for _ in range(rnd.randint(120, 400)):
        dx, dy = rnd.choice(((1, 0), (-1, 0), (0, 1), (0, -1)))
        n2 = (p[0] + dx, p[1] + dy)
        if n2 in walls or n2 in crates: continue
        behind = (p[0] - dx, p[1] - dy)
        if behind in crates and rnd.random() < 0.8:
            crates.remove(behind); crates.add(p)   # pull the crate after us
        p = n2
    if crates & targets: return None
    return walls, targets, crates, p

def render(w, h, walls, targets, crates, p):
    rows = []
    for y in range(h):
        r = ''
        for x in range(w):
            c = (x, y)
            if c in walls: r += '#'
            elif c == p: r += '+' if c in targets else '@'
            elif c in crates: r += '*' if c in targets else '$'
            elif c in targets: r += '.'
            else: r += ' '
        rows.append(r.rstrip() if False else r)
    return rows

count = int(sys.argv[1]) if len(sys.argv) > 1 else 10
rnd = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 7)
plan = [(6, 5, 1), (7, 5, 2), (7, 6, 2), (7, 7, 2), (8, 6, 3), (8, 7, 3), (8, 8, 3), (9, 7, 3), (9, 8, 4), (10, 8, 4)][:count]
out = []
for i, (w, h, n) in enumerate(plan):
    want = min(8 + i * 4, 30)
    best = None
    for _ in range(8000):
        lv = make(w, h, n, rnd)
        if not lv: continue
        d = solve(*lv)
        if d is None or d < want: continue
        best = (d, render(w, h, *lv)); break
    if not best: print('failed level', i, file=sys.stderr); continue
    out.append(best)
    print(f'// level {i + 1}: {best[0]} moves', file=sys.stderr)
print('const LEVELS = [')
for d, rows in out: print('  [' + ', '.join(repr(r) for r in rows) + '],')
print('];')
