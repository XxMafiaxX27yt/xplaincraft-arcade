// CARDS: playing cards for the card games (Solitaire style).
//   CARDS.deck(decks = 1, suits = [0, 1, 2, 3])  shuffled cards { s, r, up, id } (s 0-3 = ♠ ♥ ♦ ♣, r 0-12 = A..K)
//   CARDS.draw(c, x, y, w, h, opt)               a card face (or back if !c.up); opt: { hl: colour, dim: true }
//   CARDS.slot(x, y, w, h, label)                an empty place
//   CARDS.red(c), CARDS.RANKS, CARDS.SUITS
(() => {
  const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const red = (c) => c.s === 1 || c.s === 2;
  let uid = 0;
  function deck(decks = 1, suits = [0, 1, 2, 3]) {
    const out = [];
    const per = (decks * 4) / suits.length; // e.g. Spider 1 suit = 8 copies of spades
    for (let k = 0; k < per; k++) for (const s of suits) for (let r = 0; r < 13; r++) out.push({ s, r, up: false, id: uid++ });
    return K.shuffle(out);
  }
  function draw(c, x, y, w = 70, h = 98, opt = {}) {
    if (!c.up) {
      K.rect(x, y, w, h, '#3a2f8e', 7); K.stroke(x + 4, y + 4, w - 8, h - 8, '#8b5cf6', 2, 5);
      if (h > 50) K.text('✦', x + w / 2, y + h / 2, Math.min(22, w * 0.3), '#8b5cf6');
      if (opt.hl) K.stroke(x - 2, y - 2, w + 4, h + 4, opt.hl, 3, 8);
      return;
    }
    K.rect(x, y, w, h, opt.dim ? '#bdb9cc' : '#f8f6ff', 7); K.stroke(x, y, w, h, '#00000033', 1, 7);
    const col = red(c) ? '#d8213e' : '#141428', sz = Math.max(11, Math.min(16, w * 0.22));
    K.text(RANKS[c.r], x + 5, y + sz * 0.8, sz, col, 'left', 'd'); K.text(SUITS[c.s], x + 6, y + sz * 1.95, sz - 1, col, 'left');
    if (h > 60) K.text(SUITS[c.s], x + w / 2, y + h / 2 + 10, Math.min(34, w * 0.46), col);
    if (opt.hl) K.stroke(x - 2, y - 2, w + 4, h + 4, opt.hl, 3, 8);
  }
  function slot(x, y, w = 70, h = 98, label = '') {
    K.stroke(x, y, w, h, '#ffffff33', 2, 7);
    if (label) K.text(label, x + w / 2, y + h / 2, 18, '#ffffff33', 'center', 'd');
  }
  window.CARDS = { SUITS, RANKS, red, deck, draw, slot };
})();
