/* XplainCraft Arcade SDK — include in every game:
 *   <script src="../../sdk/arcade-sdk.js"></script>
 *
 *   const ctx = await XC.ready();   // { player:{callsign,equipped}, best, volume }
 *   XC.start();                     // a run begins (the arcade starts its timer)
 *   XC.end({ score, won, stats });  // a run ends -> XP, coins, best score, tasks
 *   XC.onResult(r => ...);          // { xp, coins, newBest, best } after end()
 *   XC.exit();                      // back to the arcade
 *
 * Works on its own too (opened directly): rewards are skipped, best is kept locally.
 * Put data-xc-cursor="off" on <html> to keep the game's own cursor.
 */
(function () {
  var embedded = window.parent !== window;
  var resultCbs = [];
  var ctx = null;
  var readyResolve;
  var readyP = new Promise(function (r) { readyResolve = r; });
  var gameKey = 'xc_solo_best_' + location.pathname.split('/').pop();

  function post(type, data) {
    if (embedded) window.parent.postMessage({ __xc: 1, type: type, data: data }, '*');
  }

  function soloCtx() {
    var b = localStorage.getItem(gameKey);
    return { player: { callsign: 'PLAYER', equipped: {} }, best: b == null ? null : Number(b), volume: 0.6, solo: true };
  }

  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.__xc !== 1) return;
    if (m.type === 'init') {
      ctx = m.data;
      if (ctx.cursor && document.documentElement.getAttribute('data-xc-cursor') !== 'off') {
        document.documentElement.style.cursor = ctx.cursor;
      }
      readyResolve(ctx);
    } else if (m.type === 'result') {
      if (ctx) ctx.best = m.data.best;
      resultCbs.forEach(function (cb) { try { cb(m.data); } catch (err) { console.error(err); } });
    }
  });

  window.XC = {
    embedded: embedded,
    ready: function () {
      if (!embedded) { ctx = soloCtx(); return Promise.resolve(ctx); }
      post('ready');
      setTimeout(function () { if (!ctx) { ctx = soloCtx(); readyResolve(ctx); } }, 2000);
      return readyP;
    },
    start: function () { post('start'); },
    end: function (r) {
      r = r || {};
      if (!embedded) {
        var best = ctx && ctx.best;
        var lower = !!r.lowerIsBetter;
        var nb = r.score > 0 && (best == null || (lower ? r.score < best : r.score > best));
        if (nb) { localStorage.setItem(gameKey, r.score); if (ctx) ctx.best = r.score; }
        var res = { xp: 0, coins: 0, newBest: nb, best: ctx && ctx.best };
        setTimeout(function () { resultCbs.forEach(function (cb) { cb(res); }); }, 0);
        return;
      }
      post('end', { score: r.score || 0, won: r.won == null ? null : !!r.won, stats: r.stats || {} });
    },
    onResult: function (cb) { resultCbs.push(cb); },
    exit: function () {
      if (embedded) post('exit');
      else location.href = '../../index.html';
    },
    get player() { return ctx && ctx.player; },
    get best() { return ctx && ctx.best; },
    get volume() { return ctx ? ctx.volume : 0.6; },
  };
})();
