// Runs a game in a full-screen frame and talks to it through the Arcade SDK (sdk/arcade-sdk.js).
import { $, esc } from './util.js';
import { GAME } from './games.js';
import { api, store } from './store.js';
import { cursorCSS } from './cosmetics/render.js';
import { rewardPopup, toast, errToast } from './ui.js';
import { sfx } from './sfx.js';

let current = null; // { game, frame, startedAt, onMsg }

export function isPlaying() {
  return !!current;
}

export function launch(gameId) {
  const g = GAME[gameId];
  if (!g) return;
  closeGame(true);
  sfx.whoosh();
  const layer = $('#game-layer');
  layer.innerHTML = `
    <div class="gl-bar">
      <button class="btn ghost sm" data-exit>◂ EXIT</button>
      <div class="gl-title">${esc(g.title)}</div>
      <div class="gl-best">BEST <b data-best>${fmtBest(g)}</b></div>
    </div>
    <div class="gl-load"><div class="spinner"></div>LOADING ${esc(g.title)}...</div>
    <iframe class="gl-frame" title="${esc(g.title)}" allow="autoplay; fullscreen; gamepad" src="${esc(g.file)}"></iframe>`;
  layer.classList.remove('hidden');
  requestAnimationFrame(() => layer.classList.add('in'));
  document.body.classList.add('playing');

  const frame = $('.gl-frame', layer);
  frame.addEventListener('load', () => {
    $('.gl-load', layer)?.remove();
    frame.focus();
  });
  $('[data-exit]', layer).onclick = () => (sfx.back(), closeGame());

  const onMsg = async (e) => {
    if (!current || e.source !== frame.contentWindow) return;
    const m = e.data;
    if (!m || m.__xc !== 1) return;
    if (m.type === 'ready') {
      const me = store.me;
      frame.contentWindow.postMessage(
        {
          __xc: 1,
          type: 'init',
          data: {
            player: { callsign: me.username, equipped: me.equipped },
            best: me.stats.games[g.id]?.best ?? null,
            cursor: cursorCSS(me.equipped.cursor),
            volume: me.settings.sfx ? me.settings.volume : 0,
          },
        },
        '*'
      );
    } else if (m.type === 'start') {
      current.startedAt = performance.now();
    } else if (m.type === 'end') {
      const startedAt = current.startedAt;
      current.startedAt = null;
      if (startedAt == null) return; // an end without a start does not count
      const duration = (performance.now() - startedAt) / 1000;
      const d = m.data || {};
      try {
        const r = await api.reportResult({ game: g.id, score: d.score, won: d.won ?? null, stats: d.stats || {}, duration });
        store.set(r.me);
        frame.contentWindow?.postMessage({ __xc: 1, type: 'result', data: { xp: r.xp, coins: r.coins, newBest: r.newBest, best: r.best } }, '*');
        const bestEl = $('[data-best]', layer);
        if (bestEl) bestEl.textContent = fmtBest(g);
        if (r.xp || r.coins) rewardPopup({ xp: r.xp, coins: r.coins, levelUp: r.levelUp, title: r.newBest ? 'NEW BEST!' : 'RUN COMPLETE' });
        r.tasksDone.forEach((t) => toast(`<b>TASK DONE</b> ${esc(t)} — claim it in TASKS`, 'task', 4200));
      } catch (ex) {
        errToast(ex);
      }
    } else if (m.type === 'exit') {
      closeGame();
    }
  };
  window.addEventListener('message', onMsg);
  current = { game: g, frame, startedAt: null, onMsg };
}

function fmtBest(g) {
  const b = store.me?.stats.games[g.id]?.best;
  return b == null ? '—' : String(b);
}

export function closeGame(instant = false) {
  if (!current) return;
  window.removeEventListener('message', current.onMsg);
  current = null;
  const layer = $('#game-layer');
  layer.classList.remove('in');
  document.body.classList.remove('playing');
  const finish = () => {
    layer.classList.add('hidden');
    layer.innerHTML = '';
  };
  instant ? finish() : setTimeout(finish, 300);
}
