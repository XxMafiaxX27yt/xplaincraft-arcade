// DICT: the big word list (ENABLE, public domain, ~168,000 words of 3-15 letters, offensive words removed) for word games
// that need to know about ANY real word, not just common ones. Loaded from dict.txt (front-coded: first char = how many
// letters are shared with the word before it).
//
//   await DICT.ready                 loads the list (about 240 KB over the network)
//   DICT.isWord('apple')             true
//   DICT.isPrefix('appl')            some word starts with these letters
//   DICT.next('appl')                ['a', 'e', 'i', 'y'] letters that keep it a real start of a word
//   DICT.example('appl', common)     a short real word starting with it (from `common` first, a Set of easy words)
(() => {
  let list = [];
  const lb = (s) => { let lo = 0, hi = list.length; while (lo < hi) { const m = (lo + hi) >> 1; if (list[m] < s) lo = m + 1; else hi = m; } return lo; };
  const D = {
    ready: fetch(new URL('dict.txt', document.currentScript.src)).then((r) => r.text()).then((t) => {
      const out = new Array(170000); let prev = '', n = 0;
      for (const line of t.split('\n')) { if (!line) continue; const k = parseInt(line[0], 36); prev = prev.slice(0, k) + line.slice(1); out[n++] = prev; }
      out.length = n; list = out; return n;
    }),
    get size() { return list.length; },
    // the whole list (sorted, lower case) - for bots that need to search it
    all: () => list,
    isWord: (w) => { w = String(w).toLowerCase(); const i = lb(w); return list[i] === w; },
    isPrefix: (p) => { p = String(p).toLowerCase(); if (!p) return true; const i = lb(p); return i < list.length && list[i].startsWith(p); },
    next: (p) => { p = String(p).toLowerCase(); return 'abcdefghijklmnopqrstuvwxyz'.split('').filter((c) => D.isPrefix(p + c)); },
    // how many words start with p (capped) - used by bots to prefer roomy letters
    count: (p, cap = 400) => { p = String(p).toLowerCase(); let i = lb(p), n = 0; while (i < list.length && n < cap && list[i].startsWith(p)) { i++; n++; } return n; },
    example: (p, common) => {
      p = String(p).toLowerCase();
      if (common) { let best = null; for (const w of common) if (w.length > p.length && w.startsWith(p) && (!best || w.length < best.length)) best = w; if (best) return best; }
      let i = lb(p), best = null, k = 0;
      while (i < list.length && k++ < 3000 && list[i].startsWith(p)) { const w = list[i++]; if (w.length > p.length && (!best || w.length < best.length)) best = w; }
      return best || (D.isWord(p) ? p : null);
    },
  };
  window.DICT = D;
})();
