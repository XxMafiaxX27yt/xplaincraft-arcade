// Game registry. One game = one HTML file under games/2d or games/3d with a <script id="meta"> block.
// The list itself is generated into games-data.js by tools/build_registry.py.
//
// modes: 'sp' singleplayer, 'local' same-device multiplayer, 'online' online multiplayer
// lowerIsBetter: for time-based scores (fastest wins)
// tasks: game-specific daily task templates; `stat` is a key the game reports in XC.end({ stats })
import { GAME_LIST } from './games-data.js';
import { esc } from './util.js';

export const GENRES = [
  { id: 'horror', name: 'HORROR', color: '#ff3355', icon: '☠', blurb: 'Face what waits in the dark' },
  { id: 'fun', name: 'FUN', color: '#ffd93a', icon: '⚡', blurb: 'Fast, loud, one more go' },
  { id: 'mind', name: 'MIND-TRICKY', color: '#22e6ff', icon: '◈', blurb: 'Your brain vs. the game' },
  { id: 'relax', name: 'RELAXING', color: '#3dffa0', icon: '☾', blurb: 'Breathe. Take your time.' },
  { id: 'mystery', name: '???', color: '#c45cff', icon: '?', blurb: 'Weird. Chaotic. Together.' },
];
export const GENRE = Object.fromEntries(GENRES.map((g) => [g.id, g]));

export const GAMES = GAME_LIST.map((g) => ({
  art: [GENRE[g.genre]?.color || '#22e6ff', '#0a0820'],
  glyph: g.title[0],
  tasks: [],
  ...g,
}));
export const GAME = Object.fromEntries(GAMES.map((g) => [g.id, g]));

export function gamesFor({ mode, dim, genre, q } = {}) {
  return GAMES.filter((g) => {
    if (dim && g.dim !== dim) return false;
    if (mode === 'sp' && !g.modes.includes('sp')) return false;
    if (mode === 'mp' && !g.modes.some((m) => m === 'local' || m === 'online')) return false;
    if (genre && genre !== 'all' && g.genre !== genre) return false;
    if (q && !g.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
}

export function thumbHTML(g, big = false) {
  const [a, b] = g.art;
  const gen = GENRE[g.genre];
  return `<div class="thumb ${big ? 'big' : ''} ${g.cover ? 'has-cover' : ''}" style="--a:${a};--b:${b}" data-preview="${esc(g.file)}">
    ${g.cover ? `<img class="thumb-img" src="${esc(g.cover)}" alt="" loading="lazy">` : `<span class="thumb-grid"></span><span class="thumb-glyph">${esc(g.glyph)}</span>`}
    <span class="thumb-tag" style="--g:${gen.color}">${gen.icon} ${gen.name}</span>
    <span class="thumb-dim">${g.dim.toUpperCase()}</span>
  </div>`;
}
