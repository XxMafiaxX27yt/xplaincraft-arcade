// PK: shared bits for the talk / vote / write party games (Telephone Draw, Fake Artist, Sketch Duel, Most Likely To,
// Word Bluff, The Spy). The host runs the clock and the phases; everyone else follows.
//
//   PK.players()            [{ id, name, col }] (online players, or `fake` players for solo / cover screens)
//   PK.me(), PK.host()      my id, am I the host (solo: always)
//   PK.go(s, ph, dur, data) host: switch everyone to phase `ph` for `dur` seconds (data travels with it)
//   PK.follow(s, d)         put in onNet: applies the host's phase switches; returns true if it was one
//   PK.type(s, key, max)    typing into s[key] (letters, digits, space, backspace); true when Enter is pressed
//   PK.box(...)             a text box with a caret      PK.tag(...) a player name chip
//   PK.bar(...)             time left bar                PK.board(...) the score list
//   PK.finish(s, pts)       end screen for everyone from a { id: points } table
(() => {
  const COL = ['#22e6ff', '#ff2bd6', '#3dffa0', '#ffd93a', '#ff8a3a', '#c45cff', '#ff3355', '#4f8bff'];
  const PK = { COL };
  let fake = null;
  PK.setFake = (list) => { fake = list; };
  PK.players = () => {
    const list = K.net ? K.net.players.map((p) => ({ id: p.id, name: p.username })) : fake || [{ id: 'me', name: 'YOU' }];
    return list.map((p, i) => ({ ...p, col: COL[i % COL.length] }));
  };
  PK.me = () => (K.net ? K.net.me : 'me');
  PK.host = () => !K.net || K.net.isHost;
  PK.send = (d, to) => K.net && K.net.send(d, to);
  PK.name = (id) => (PK.players().find((p) => p.id === id) || { name: '?' }).name;
  PK.col = (id) => (PK.players().find((p) => p.id === id) || { col: '#fff' }).col;

  PK.go = (s, ph, dur, data = null) => {
    s.ph = ph; s.t = dur; s.dur = dur; s.pd = data; s.phN = (s.phN || 0) + 1;
    PK.send({ t: '__ph', ph, dur, d: data, n: s.phN });
    s.onPhase?.(s);
  };
  PK.follow = (s, d) => {
    if (d.t !== '__ph') return false;
    if (PK.host()) return true;
    s.ph = d.ph; s.t = d.dur; s.dur = d.dur; s.pd = d.d; s.phN = d.n;
    s.onPhase?.(s);
    return true;
  };

  PK.type = (s, key, max = 40) => {
    let v = s[key] || '';
    for (const ch of K.typed()) if (v.length < max) v += ch.toLowerCase();
    for (let i = 0; i <= 9; i++) if (K.tap('Digit' + i, 'Numpad' + i) && v.length < max) v += i;
    if (K.tap('Space') && v && !v.endsWith(' ') && v.length < max) v += ' ';
    if (K.tap('Backspace')) v = v.slice(0, -1);
    s[key] = v;
    return K.tap('Enter', 'NumpadEnter') && v.trim().length > 0;
  };
  PK.box = (x, y, w, h, text, hint, active = true, col = '#22e6ff') => {
    K.rect(x, y, w, h, '#0b0a18', 10); K.stroke(x, y, w, h, active ? col : '#3a3570', 2, 10);
    const sz = Math.min(22, h * 0.45);
    const shown = text ? text.toUpperCase() : hint;
    K.text(shown + (active && Math.sin(K.time() * 8) > 0 ? '|' : ''), x + 16, y + h / 2 + 1, sz, text ? '#fff' : '#5d5a80', 'left', 'u');
    if (active && K.isTouch && !text) K.text('tap to type', x + w - 12, y + h / 2 + 1, 12, '#5d5a80', 'right', 'm');
  };
  PK.tag = (x, y, id, opt = {}) => {
    const col = PK.col(id), nm = id === PK.me() && !opt.real ? 'YOU' : PK.name(id), sz = opt.size || 14;
    K.circle(x + sz * 0.6, y, sz * 0.6, col);
    K.text(nm[0] || '?', x + sz * 0.6, y + 1, sz * 0.75, '#05040c', 'center', 'd');
    K.text(nm, x + sz * 1.5, y + 1, sz, opt.color || col, 'left', 'd');
  };
  PK.bar = (x, y, w, s) => {
    const f = s.dur ? K.clamp(s.t / s.dur, 0, 1) : 0;
    K.rect(x, y, w, 6, '#ffffff14', 3); K.rect(x, y, w * f, 6, f < 0.25 ? '#ff3355' : '#22e6ff', 3);
    K.text(String(Math.max(0, Math.ceil(s.t))), x + w + 10, y + 4, 16, f < 0.25 ? '#ff3355' : '#8e88b8', 'left', 'd');
  };
  PK.board = (pts, x, y, w, title = 'SCORES') => {
    const list = PK.players().slice().sort((a, b) => (pts[b.id] || 0) - (pts[a.id] || 0));
    K.rect(x, y, w, 40 + list.length * 26, '#15122c', 10);
    K.text(title, x + 14, y + 20, 12, '#8e88b8', 'left', 'd');
    list.forEach((p, i) => { PK.tag(x + 14, y + 46 + i * 26, p.id, { size: 13 }); K.text(String(pts[p.id] || 0), x + w - 14, y + 47 + i * 26, 14, '#ffd93a', 'right', 'd'); });
  };
  PK.finish = (s, pts, words = {}) => {
    if (s.over) return; s.over = true;
    const list = PK.players().slice().sort((a, b) => (pts[b.id] || 0) - (pts[a.id] || 0));
    const me = PK.me(), top = list[0], best = top ? pts[top.id] || 0 : 0;
    const tie = list.length > 1 && (pts[list[1].id] || 0) === best;
    const won = !!top && !tie && top.id === me && best > 0;
    const title = tie ? (list.filter((p) => (pts[p.id] || 0) === best).some((p) => p.id === me) ? "IT'S A TIE!" : 'A TIE AT THE TOP') : won ? (words.win || 'YOU WIN!') : `${top ? top.name : '?'} WINS`;
    K.end(s, { score: pts[me] || 0, won, stats: { won: won ? 1 : 0 }, title, text: list.map((p) => `${p.name} ${pts[p.id] || 0}`).join(' · ') });
  };
  // standalone page (no party): a short note instead of a broken game
  PK.needParty = (min) => {
    K.text('PARTY GAME', 480, 200, 40, '#fff', 'center', 'd', 16);
    K.text(`Start it from a party with ${min}+ players (MULTIPLAYER → make a party → pick this game).`, 480, 260, 18, '#8e88b8', 'center', 'u');
  };
  window.PK = PK;
})();
