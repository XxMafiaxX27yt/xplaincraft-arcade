/* NOVEXYT Arcade SDK — include in every game:
 *   <script src="../../sdk/arcade-sdk.js"></script>
 *
 *   const ctx = await XC.ready();   // { player:{callsign,equipped}, best, volume }
 *   XC.start();                     // a run begins (the arcade starts its timer)
 *   XC.end({ score, won, stats });  // a run ends -> XP, coins, best score, tasks
 *   XC.onResult(r => ...);          // { xp, coins, newBest, best } after end()
 *   XC.exit();                      // back to the arcade
 *   XC.net                          // online party game: { players, me, index, host, seed, send(d, to), on(cb), onLeave(cb) } or null
 *   XC.local                        // same-screen players (2+) when launched as SAME SCREEN, else 0
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
  var netCbs = [];
  var leaveCbs = [];
  var net = null;
  var localN = Number(new URLSearchParams(location.search).get('local')) || 0;

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
      if (ctx.net) {
        var n = ctx.net;
        net = {
          players: n.players, me: n.me, index: n.players.findIndex(function (p) { return p.id === n.me; }), host: n.players[0] && n.players[0].id === n.me, seed: n.seed,
          send: function (d, to) { post('net', { d: d, to: to || null }); },
          on: function (cb) { netCbs.push(cb); },
          onLeave: function (cb) { leaveCbs.push(cb); },
        };
      }
      readyResolve(ctx);
    } else if (m.type === 'net') {
      netCbs.slice().forEach(function (cb) { try { cb(m.data.d, m.data.from); } catch (err) { console.error(err); } });
    } else if (m.type === 'netleave') {
      if (net) net.players = net.players.filter(function (p) { return p.id !== m.data.id; });
      leaveCbs.slice().forEach(function (cb) { try { cb(m.data.id); } catch (err) { console.error(err); } });
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
    get net() { return net; },
    get local() { return localN; },
    get player() { return ctx && ctx.player; },
    get best() { return ctx && ctx.best; },
    get volume() { return ctx ? ctx.volume : 0.6; },
  };
})();
