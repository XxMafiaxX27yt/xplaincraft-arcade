// Online lobby + NET badge for the 3D games (on top of net3d.js).
//
//   const L = onlineLobby(K3, N, {
//     title, sub,
//     hostOpts: [{ key, label, opts: [[value, label], ...], ok?: (value, playerCount) => bool }],   the leader picks these
//     myOpts:   [{ key, label, opts: [[value, label], ...] }],                                     every player picks these
//     cfg, mine,                          defaults (mine is saved on this device)
//     onStart(go)                         go = { cfg, picks: { id: mine }, ids: [players in the match], seed, late }
//     onShow(), onMine(mine)              optional: back in the lobby / I changed my picks
//   });
//   L.show()          the lobby screen (also what PLAY AGAIN goes back to)
//   L.backToLobby()   the leader sends everyone back to the lobby
//   L.inGame          true from START until back in the lobby
//   netBadge(K3, N, { right, top })   small link + ping list for every other player
const COL = { p2p: '#3dffa0', relay: '#ffd93a', wait: '#8e88b8' };
const LABEL = { p2p: 'DIRECT', relay: 'BACKUP LINK', wait: 'connecting...' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function onlineLobby(K3, N, spec) {
  const L = { cfg: { ...spec.cfg }, mine: { ...spec.mine }, picks: {}, here: new Set([N.me]), inGame: false, shownAt: 0 };
  L.picks[N.me] = L.mine;
  let open = false, hereTimer = null;
  const ok = (o, v) => !o.ok || o.ok(v, N.players.length);
  // the leader's choice must still fit the party (e.g. 1v1 needs exactly two)
  const fix = () => { for (const o of spec.hostOpts) if (!ok(o, L.cfg[o.key])) { const f = o.opts.find(([v]) => ok(o, v)); if (f) L.cfg[o.key] = f[0]; } };

  N.on((d, from) => {
    if (!d || typeof d.k !== 'string' || d.k[0] !== 'L') return;
    if (d.k === 'L.here') {
      L.here.add(from); if (d.mine) L.picks[from] = d.mine;
      if (N.isHost) {
        N.send({ k: 'L.cfg', cfg: L.cfg }, { to: from });
        // arrived after START: they watch this game and join the next one
        if (L.inGame && L.lastGo && !L.lastGo.ids.includes(from)) N.send({ k: 'L.go', ...L.lastGo, late: true }, { to: from });
      }
      if (open) render();
    }
    if (d.k === 'L.pick') { L.picks[from] = d.mine; if (open) render(); }
    if (d.k === 'L.cfg' && from === N.hostId) { L.cfg = d.cfg; if (open) render(); }
    if (d.k === 'L.go' && from === N.hostId) { if (d.late && L.inGame) return; startGo(d); }
    if (d.k === 'L.back' && from === N.hostId) L.show();
  });
  N.onLeave((id) => { L.here.delete(id); delete L.picks[id]; if (open) { fix(); render(); } });
  N.onHost(() => { if (open) render(); });

  function startGo(go) {
    open = false; clearInterval(hereTimer);
    L.inGame = true; L.lastGo = go;
    spec.onStart(go);
  }
  L.show = () => {
    spec.onShow?.();   // the game clears the last match away
    open = true; L.inGame = false; L.shownAt = N.now();
    K3.playing = false; K3.menuOpen = false; K3.setTouchButtons([]); document.exitPointerLock?.();
    fix();
    const hello = () => N.send({ k: 'L.here', mine: L.mine });
    hello(); clearInterval(hereTimer); hereTimer = setInterval(() => { hello(); if (open) render(); }, 2000);
    render();
  };
  L.backToLobby = () => { if (!N.isHost) return; N.send({ k: 'L.back' }); L.show(); };

  function render() {
    if (!open) return;
    const host = N.isHost, ids = N.players.map((p) => p.id);
    const waitFor = ids.filter((id) => !L.here.has(id) || N.link(id) === 'wait');
    const patience = N.now() - L.shownAt > 15;
    const rows = ids.map((id) => {
      const me = id === N.me, lk = me ? 'self' : N.link(id), rtt = N.rtt(id), loaded = L.here.has(id);
      const status = me ? 'YOU' : !loaded ? 'loading...' : `<span style="color:${COL[lk]}">● ${LABEL[lk]}</span>${rtt != null ? ` · ${Math.round(rtt * 1000)} ms` : ''}`;
      const pk = L.picks[id] ? spec.myOpts.map((o) => (o.opts.find(([v]) => v === L.picks[id][o.key]) || [])[1]).filter(Boolean).join(' · ') : '';
      return `<div style="display:flex;gap:12px;justify-content:space-between;align-items:center;padding:7px 12px;border-radius:9px;background:rgba(17,13,36,.75);border:1px solid ${id === N.hostId ? 'rgba(255,217,58,.5)' : 'rgba(255,255,255,.12)'};min-width:min(520px,86vw)">
        <b style="font-family:Orbitron;letter-spacing:1px">${id === N.hostId ? '👑 ' : ''}${esc(N.name(id))}</b><small style="color:#c8c0e8">${esc(pk)}</small><small>${status}</small></div>`;
    }).join('');
    const btn = (scope, o, v, l, cur, enabled) => `<button class="k3-btn ${cur === v ? 'sel' : ''}" data-scope="${scope}" data-k="${o.key}" data-v="${esc(String(v))}" ${enabled ? '' : 'disabled style="opacity:.45;cursor:default"'}>${l}</button>`;
    const hostRows = spec.hostOpts.map((o) => `<div class="k3-label">${o.label}${host ? '' : ' · the leader picks'}</div><div class="k3-row">${o.opts.filter(([v]) => ok(o, v) || host).map(([v, l]) => btn('h', o, v, l, L.cfg[o.key], host && ok(o, v))).join('')}</div>`).join('');
    const myRows = spec.myOpts.map((o) => `<div class="k3-label">${o.label}</div><div class="k3-row">${o.opts.map(([v, l]) => btn('m', o, v, l, L.mine[o.key], true)).join('')}</div>`).join('');
    const canGo = host && (!waitFor.length || patience);
    const el = K3.shell.screen(`<div class="k3-title" style="font-size:clamp(26px,5vw,48px)">${spec.title}</div>
      <div class="k3-sub">${spec.sub || 'ONLINE · your party plays together, bots fill the empty spots'}</div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:center">${rows}</div>
      ${hostRows}${myRows}
      <div class="k3-row" style="margin-top:6px">${host ? `<button class="k3-btn primary" data-go style="min-width:220px;font-size:18px" ${canGo ? '' : 'disabled'}>${waitFor.length ? (patience ? '▶ START ANYWAY' : 'WAITING FOR PLAYERS...') : '▶ START'}</button>` : `<div class="k3-sub">waiting for <b>${esc(N.name(N.hostId))}</b> to start</div>`}
      <button class="k3-btn" data-set>SETTINGS</button><button class="k3-btn" data-leave>LEAVE</button></div>
      <div class="k3-sub" style="font-size:12px">DIRECT = player-to-player link (fastest) · BACKUP LINK = through the arcade server (works everywhere, a little slower)</div>`);
    el.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => {
      if (b.disabled) return;
      const o = (b.dataset.scope === 'h' ? spec.hostOpts : spec.myOpts).find((x) => x.key === b.dataset.k);
      const v = o.opts.find(([x]) => String(x) === b.dataset.v)[0];
      K3.audio.unlock();
      if (b.dataset.scope === 'h') { L.cfg[o.key] = v; N.send({ k: 'L.cfg', cfg: L.cfg }); }
      else { L.mine[o.key] = v; L.picks[N.me] = L.mine; spec.onMine?.(L.mine); N.send({ k: 'L.pick', mine: L.mine }); }
      render();
    }));
    el.querySelector('[data-set]').onclick = () => { open = false; K3.shell.settings(() => { open = true; render(); }); };
    el.querySelector('[data-leave]').onclick = () => (window.XC ? XC.exit() : history.back());
    const go = el.querySelector('[data-go]');
    if (go) go.onclick = () => {
      if (!canGo) return;
      K3.audio.unlock();
      const ids2 = ids.filter((id) => L.here.has(id));
      const g = { cfg: L.cfg, picks: Object.fromEntries(ids2.map((id) => [id, L.picks[id] || spec.mine])), ids: ids2, seed: Math.floor(Math.random() * 1e9) };
      N.send({ k: 'L.go', ...g });
      startGo(g);
    };
  }
  return L;
}

// a small always-on list: every other player's link and ping (green = direct, yellow = backup link)
export function netBadge(K3, N, pos = { left: 10, bottom: 10 }) {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;font:600 11px Rajdhani,Segoe UI,sans-serif;letter-spacing:.5px;color:#c8c0e8;text-shadow:0 1px 3px #000;pointer-events:none;line-height:1.35;z-index:3';
  for (const [k, v] of Object.entries(pos)) el.style[k] = v + 'px';
  K3.hud.appendChild(el);
  const draw = () => {
    el.innerHTML = N.linkInfo().map((p) => `<div><span style="color:${COL[p.link]}">●</span> ${esc(p.name)} ${p.link === 'wait' ? '...' : p.rtt != null ? Math.round(p.rtt * 1000) + ' ms' : ''}${p.link === 'relay' ? ' (backup)' : ''}</div>`).join('');
  };
  draw(); setInterval(draw, 1000);
  return el;
}
