// Arcade shell: router, top bar, and the play flow (mode -> 2D/3D -> lobby -> game).
import { $, $$, esc, levelInfo, num, fmtClock, msUntilMidnight } from './util.js';
import { api, store } from './store.js';
import { runBoot } from './boot.js';
import { sfx } from './sfx.js';
import { avatarHTML, callsignHTML } from './cosmetics/render.js';
import { ITEM } from './cosmetics/catalog.js';
import { GAMES, GENRES, GENRE, GAME, gamesFor, thumbHTML } from './games.js';
import { launch, isPlaying, closeGame } from './host.js';
import { modal, closeModal, errToast, rewardPopup } from './ui.js';
import { CONFIG } from './config.js';
import * as V from './views.js';
import * as VS from './views-shop.js';
import * as VP from './views-pass.js';
import * as VO from './views-op.js';
import { toast } from './ui.js';

// ---------- router ----------
const routes = [
  [/^\/?$/, viewHome],
  [/^\/(sp|mp)$/, viewDims],
  [/^\/(sp|mp)\/(2d|3d)$/, viewLobby],
  [/^\/profile(?:\/([^/]+))?$/, V.viewProfile],
  [/^\/friends(?:\/(\w+))?$/, V.viewFriends],
  [/^\/shop(?:\/(\w+))?$/, VS.viewShop],
  [/^\/locker(?:\/(\w+))?$/, VS.viewLocker],
  [/^\/pass$/, VP.viewPass],
  [/^\/events(?:\/([\w-]+))?$/, VP.viewEvents],
  [/^\/operator$/, VO.viewOperator],
  [/^\/tasks(?:\/(\w+))?$/, V.viewTasks],
  [/^\/leaderboards(?:\/([\w-]+))?$/, V.viewLeaderboards],
  [/^\/settings$/, V.viewSettings],
];

export function go(path) {
  if (location.hash === '#' + path) render();
  else location.hash = path;
}

let renderToken = 0;
export async function render() {
  if (!store.me) return;
  if (isPlaying()) closeGame(true);
  closeModal();
  const path = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  const view = $('#view');
  const token = ++renderToken;
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) {
      view.classList.remove('enter');
      await fn(view, ...m.slice(1));
      if (token !== renderToken) return;
      void view.offsetWidth;
      view.classList.add('enter');
      markNav(path);
      window.scrollTo({ top: 0 });
      showGifts();
      return;
    }
  }
  go('/');
}

// ---------- top bar ----------
const NAV = [
  ['/', 'PLAY', /^\/(sp|mp)?/],
  ['/pass', 'PASS', /^\/pass/],
  ['/events', 'EVENTS', /^\/events/],
  ['/shop', 'SHOP', /^\/shop/],
  ['/locker', 'LOCKER', /^\/locker/],
  ['/tasks', 'TASKS', /^\/tasks/],
  ['/leaderboards', 'RANKS', /^\/leaderboards/],
  ['/friends', 'FRIENDS', /^\/friends/],
  ['/operator', '⛨ OP', /^\/operator/],
];

function markNav(path) {
  $$('.nav a').forEach((a) => {
    const [href, , re] = NAV[a.dataset.i];
    const on = href === '/' ? /^\/((sp|mp)(\/.*)?)?$/.test(path) : re.test(path);
    a.classList.toggle('on', on);
  });
}

async function renderTopbar() {
  const me = store.me;
  if (!me) return;
  const lv = levelInfo(me.xp);
  const daily = api.dailyState(me);
  const tasksReady = me.tasks.list.some((t) => !t.claimed && t.progress >= t.target) || api.achievementState(me).some((a) => a.done && !a.claimed);
  const ps = api.passState(me);
  const passReady = ps.season && Array.from({ length: ps.tier }, (_, i) => i + 1).some((t) => !ps.free.includes(t) || (ps.premium && !ps.prem.includes(t)));
  const evLive = api.liveEventsNow().length;
  const incoming = await api.incomingCount();
  $('#topbar').innerHTML = `
    <a class="tb-logo" href="#/" aria-label="Home">
      <span class="tb-mark">XC</span>
      <span class="tb-name"><b>${esc(CONFIG.brand.top)}</b><i>${esc(CONFIG.brand.name)}</i></span>
    </a>
    <nav class="nav">
      ${NAV.map(([href, label], i) => {
        if (href === '/operator' && !me.operator) return '';
        const n = { TASKS: tasksReady && '!', FRIENDS: incoming, PASS: passReady && '!', EVENTS: evLive }[label];
        return `<a href="#${href}" data-i="${i}" class="${href === '/operator' ? 'nav-op' : ''}">${label}${n ? `<span class="dot">${n}</span>` : ''}</a>`;
      }).join('')}
    </nav>
    <div class="tb-right">
      <button class="tb-daily ${daily.claimedToday ? '' : 'ready'}" data-daily title="Daily reward">
        <span class="gift">🎁</span><span class="tb-daily-t">${daily.claimedToday ? fmtClock(msUntilMidnight()) : 'CLAIM'}</span>
      </button>
      <a class="tb-coins" href="#/shop" title="Coins"><i class="coin"></i>${num(me.coins)}</a>
      <a class="tb-me" href="#/profile" title="Your profile">
        ${avatarHTML(me.equipped, 38)}
        <span class="tb-me-t">${callsignHTML(me.username, me.equipped, 'sm')}
          <span class="tb-lv"><b>LV ${lv.level}</b><span class="xpbar"><i style="width:${(lv.pct * 100).toFixed(1)}%"></i></span></span>
        </span>
      </a>
      <a class="tb-gear" href="#/settings" title="Settings" aria-label="Settings">⚙</a>
    </div>`;
  $('[data-daily]').onclick = () => (sfx.click(), openDaily());
  markNav(decodeURIComponent(location.hash.slice(1)) || '/');
}

// ---------- daily reward modal ----------
export function openDaily() {
  const me = store.me;
  const st = api.dailyState(me);
  const days = api.DAILY_REWARDS.map((c, i) => {
    let cls = '';
    if (i < st.dayIndex || (st.claimedToday && i === st.dayIndex)) cls = 'got';
    else if (i === st.dayIndex) cls = 'today';
    return `<div class="dr-day ${cls}"><span>DAY ${i + 1}</span><b>${c}</b><i class="coin"></i>${cls === 'got' ? '<em>✓</em>' : ''}</div>`;
  }).join('');
  const m = modal(`
    <h3 class="m-title">DAILY REWARD</h3>
    <p class="m-text">Log in every day. Miss a day and the streak starts again.</p>
    <div class="dr-track">${days}</div>
    <div class="dr-foot">
      <span>STREAK <b>${st.streak}</b> day${st.streak === 1 ? '' : 's'}</span>
      ${st.claimedToday ? `<button class="btn ghost" disabled>CLAIMED · next in <span data-cd>${fmtClock(msUntilMidnight())}</span></button>`
        : `<button class="btn primary" data-claim>CLAIM ${st.reward} COINS</button>`}
    </div>`, { wide: true });
  const cd = m.el.querySelector('[data-cd]');
  if (cd) {
    const t = setInterval(() => (document.contains(cd) ? (cd.textContent = fmtClock(msUntilMidnight())) : clearInterval(t)), 1000);
  }
  const b = m.el.querySelector('[data-claim]');
  if (b)
    b.onclick = async () => {
      b.disabled = true;
      try {
        const r = await api.claimDaily();
        store.set(r.me);
        rewardPopup({ coins: r.coins, xp: r.xp, levelUp: r.levelUp, title: `DAY ${((r.streak - 1) % 7) + 1} REWARD` });
        m.close();
        render();
      } catch (e) {
        errToast(e);
        b.disabled = false;
      }
    };
}

// ---------- HOME: choose mode ----------
async function viewHome(el) {
  const me = store.me;
  const sp = gamesFor({ mode: 'sp' }).length;
  const mp = gamesFor({ mode: 'mp' }).length;
  const st = api.dailyState(me);
  const tasks = me.tasks.list;
  const recent = (me.recent || []).filter((r) => GAME[r.game]);
  const fr = await api.friendsData();
  const evs = api.liveEventsNow();
  el.innerHTML = `
  <section class="home">
    ${evs.map((ev) => `<a class="ev-strip" href="#/events/${ev.id}" style="--ev:${ev.color}"><span class="ev-decor">${(ev.decor || []).join(' ')}</span><b>${esc(ev.name)}</b><span>${esc(ev.tagline || '')}</span><span class="ev-go">LIVE NOW ▸</span></a>`).join('')}
    <div class="home-head">
      <div class="eyebrow">WELCOME, ${esc(me.username)}</div>
      <h1 class="h1">CHOOSE YOUR MODE</h1>
    </div>
    <div class="modes">
      <a class="mode-card m-sp" href="#/sp">
        <span class="mode-art"><span class="mode-orb"></span></span>
        <span class="mode-num">01</span>
        <span class="mode-t">SINGLEPLAYER</span>
        <span class="mode-d">Just you vs. the game. Beat your best, climb the ranks.</span>
        <span class="mode-c">${sp} GAME${sp === 1 ? '' : 'S'} ▸</span>
      </a>
      <a class="mode-card m-mp" href="#/mp">
        <span class="mode-art"><span class="mode-orb"></span><span class="mode-orb o2"></span><span class="mode-orb o3"></span></span>
        <span class="mode-num">02</span>
        <span class="mode-t">MULTIPLAYER</span>
        <span class="mode-d">Play with friends. Party up, compete, or survive together.</span>
        <span class="mode-c">${mp} GAME${mp === 1 ? '' : 'S'} ▸</span>
      </a>
    </div>
    <div class="home-panels">
      <div class="panel">
        <div class="panel-h">DAILY REWARD <a href="#/tasks">VIEW ▸</a></div>
        <div class="dr-mini">
          <div><div class="big-n">${st.claimedToday ? '✓' : st.reward}</div>
          <div class="dim">${st.claimedToday ? 'Claimed today' : 'coins waiting · day ' + (st.dayIndex + 1)}</div></div>
          <button class="btn ${st.claimedToday ? 'ghost' : 'primary'}" data-open-daily>${st.claimedToday ? 'STREAK ' + st.streak : 'CLAIM'}</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-h">TODAY'S TASKS <a href="#/tasks">ALL ▸</a></div>
        ${tasks.map((t) => `<div class="mini-task ${t.claimed ? 'done' : ''}">
            <span>${esc(t.text)}</span>
            <span class="mt-bar"><i style="width:${(Math.min(1, t.progress / t.target) * 100).toFixed(0)}%"></i></span>
          </div>`).join('')}
      </div>
      <div class="panel">
        <div class="panel-h">JUMP BACK IN</div>
        ${recent.length ? recent.slice(0, 3).map((r) => `<button class="mini-game" data-play="${r.game}">
            <span class="mg-g" style="--a:${GAME[r.game].art[0]}">${GAME[r.game].glyph}</span>
            <span><b>${esc(GAME[r.game].title)}</b><small>last score ${r.score}</small></span><span class="mg-p">▶</span></button>`).join('')
          : `<div class="empty-sm">No games played yet. Pick a mode above.</div>`}
      </div>
      <div class="panel">
        <div class="panel-h">FRIENDS <a href="#/friends">OPEN ▸</a></div>
        ${fr.incoming.length ? `<a class="req-pill" href="#/friends/requests">${fr.incoming.length} friend request${fr.incoming.length > 1 ? 's' : ''} ▸</a>` : ''}
        ${fr.friends.length ? fr.friends.slice(0, 4).map((f) => `<a class="mini-friend" href="#/profile/${esc(f.username)}">${avatarHTML(f.equipped, 28)}${callsignHTML(f.username, f.equipped, 'sm')}<small>LV ${levelInfo(f.xp).level}</small></a>`).join('')
          : `<div class="empty-sm">No friends yet. <a href="#/friends/find">Find players ▸</a></div>`}
      </div>
    </div>
  </section>`;
  el.querySelector('[data-open-daily]').onclick = () => (sfx.click(), openDaily());
  el.querySelectorAll('[data-play]').forEach((b) => (b.onclick = () => openGame(b.dataset.play)));
}

// ---------- 2D / 3D portals ----------
async function viewDims(el, mode) {
  const label = mode === 'sp' ? 'SINGLEPLAYER' : 'MULTIPLAYER';
  const n2 = gamesFor({ mode, dim: '2d' }).length;
  const n3 = gamesFor({ mode, dim: '3d' }).length;
  el.innerHTML = `
  <section class="dims">
    <div class="crumbs"><a href="#/">MODES</a><span>▸</span><b>${label}</b></div>
    <h1 class="h1">PICK A DIMENSION</h1>
    <div class="portals">
      <a class="portal p2d" href="#/${mode}/2d">
        <span class="portal-art"><span class="px px1"></span><span class="px px2"></span><span class="px px3"></span><span class="px-ground"></span></span>
        <span class="portal-t">2D</span><span class="portal-s">GAMES</span>
        <span class="portal-c">${n2} game${n2 === 1 ? '' : 's'}</span>
      </a>
      <a class="portal p3d" href="#/${mode}/3d">
        <span class="portal-art"><span class="cube"><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="floor3d"></span></span>
        <span class="portal-t">3D</span><span class="portal-s">GAMES</span>
        <span class="portal-c">${n3} game${n3 === 1 ? '' : 's'}</span>
      </a>
    </div>
  </section>`;
}

// ---------- lobby ----------
const lobbyState = { genre: 'all', q: '', n: 48 };

async function viewLobby(el, mode, dim) {
  const label = mode === 'sp' ? 'SINGLEPLAYER' : 'MULTIPLAYER';
  const all = gamesFor({ mode, dim });
  const counts = Object.fromEntries(GENRES.map((g) => [g.id, all.filter((x) => x.genre === g.id).length]));
  el.innerHTML = `
  <section class="lobby">
    <div class="crumbs"><a href="#/">MODES</a><span>▸</span><a href="#/${mode}">${label}</a><span>▸</span><b>${dim.toUpperCase()}</b></div>
    <div class="lobby-head">
      <h1 class="h1">${dim.toUpperCase()} ${mode === 'sp' ? 'SOLO' : 'MULTIPLAYER'} LOBBY</h1>
      <label class="search"><span>⌕</span><input placeholder="Search games" value="${esc(lobbyState.q)}" data-q></label>
    </div>
    <div class="chips">
      <button class="chip" data-g="all" style="--g:#e9e6ff">ALL <small>${all.length}</small></button>
      ${GENRES.map((g) => `<button class="chip" data-g="${g.id}" style="--g:${g.color}">${g.icon} ${g.name} <small>${counts[g.id]}</small></button>`).join('')}
    </div>
    <div class="grid" data-grid></div>
  </section>`;
  const grid = el.querySelector('[data-grid]');
  const draw = () => {
    el.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.g === lobbyState.genre));
    const list = gamesFor({ mode, dim, genre: lobbyState.genre, q: lobbyState.q });
    if (!list.length) {
      const gn = GENRE[lobbyState.genre];
      grid.innerHTML = `<div class="empty">
        <div class="empty-i">${gn ? gn.icon : '◇'}</div>
        <b>${lobbyState.q ? 'No games match "' + esc(lobbyState.q) + '"' : 'No ' + (gn ? gn.name + ' ' : '') + dim.toUpperCase() + ' ' + (mode === 'sp' ? 'solo' : 'multiplayer') + ' games yet'}</b>
        <span>${lobbyState.q ? 'Try another name.' : 'New cartridges are being built. Check back soon.'}</span></div>`;
      return;
    }
    const me = store.me;
    grid.innerHTML = list.slice(0, lobbyState.n).map((g) => {
      const s = me.stats.games[g.id];
      return `<button class="gcard" data-game="${g.id}">
        ${thumbHTML(g)}
        <span class="gcard-b"><b>${esc(g.title)}</b>
        <small>${s?.best != null ? `BEST ${s.best}` : 'NEW'} · ${g.modes.map((m) => ({ sp: 'SOLO', local: 'SAME SCREEN', online: 'ONLINE' }[m])).join(' / ')}</small></span>
      </button>`;
    }).join('') + (list.length > lobbyState.n ? `<div class="more" style="grid-column:1/-1"><button class="btn ghost" data-more>SHOW MORE (${list.length - lobbyState.n} left)</button></div>` : '');
    const more = grid.querySelector('[data-more]');
    if (more) more.onclick = () => ((lobbyState.n += 48), draw());
    grid.querySelectorAll('[data-game]').forEach((b) => {
      b.onmouseenter = () => sfx.hover();
      b.onclick = () => openGame(b.dataset.game);
    });
  };
  el.querySelectorAll('.chip').forEach((c) => (c.onclick = () => (sfx.click(), (lobbyState.genre = c.dataset.g), (lobbyState.n = 48), draw())));
  el.querySelector('[data-q]').oninput = (e) => ((lobbyState.q = e.target.value), draw());
  draw();
}

// ---------- game details ----------
export async function openGame(id) {
  const g = GAME[id];
  if (!g) return;
  sfx.click();
  const me = store.me;
  const s = me.stats.games[g.id] || { plays: 0, wins: 0, best: null };
  const lb = await api.leaderboard(g.id);
  const m = modal(`
    <div class="gd">
      ${thumbHTML(g, true)}
      <div class="gd-body">
        <div class="eyebrow" style="color:${GENRE[g.genre].color}">${GENRE[g.genre].icon} ${GENRE[g.genre].name} · ${g.dim.toUpperCase()}</div>
        <h2 class="gd-t">${esc(g.title)}</h2>
        <p class="gd-d">${esc(g.desc)}</p>
        <div class="gd-ctrl"><b>CONTROLS</b> ${esc(g.controls)}</div>
        <div class="gd-stats">
          <span><b>${s.best ?? '—'}</b>YOUR BEST ${esc(g.scoreLabel || 'SCORE')}</span>
          <span><b>${s.plays}</b>PLAYS</span>
          <span><b>${lb.length ? lb[0].value : '—'}</b>TOP SCORE</span>
        </div>
        <div class="gd-lb">
          ${lb.slice(0, 5).map((r, i) => `<div class="lb-mini ${r.id === me.id ? 'me' : ''}"><i>${i + 1}</i>${avatarHTML(r.equipped, 24)}${callsignHTML(r.username, r.equipped, 'sm')}<b>${r.value}</b></div>`).join('') || '<div class="empty-sm">No scores yet. Be the first.</div>'}
        </div>
        <button class="btn primary big" data-start>▶ PLAY</button>
      </div>
    </div>`, { wide: true });
  m.el.querySelector('[data-start]').onclick = () => {
    m.close();
    launch(g.id);
  };
}

// ---------- live game preview: hovering a cover plays the game's demo ----------
function livePreviews() {
  let timer = null;
  let cur = null;
  const stop = () => {
    clearTimeout(timer);
    cur?.querySelector('.thumb-live')?.remove();
    cur = null;
  };
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest?.('[data-preview]');
    if (t === cur) return;
    stop();
    if (!t) return;
    cur = t;
    timer = setTimeout(() => {
      if (cur !== t || isPlaying()) return;
      const f = document.createElement('iframe');
      f.className = 'thumb-live';
      f.tabIndex = -1;
      f.src = t.dataset.preview + '?attract=1';
      f.onload = () => f.classList.add('on');
      t.appendChild(f);
    }, 450);
  });
}

// ---------- start ----------
async function start() {
  store.on(renderTopbar);
  await runBoot();
  $('#app').classList.remove('hidden');
  requestAnimationFrame(() => $('#app').classList.add('reveal'));
  window.addEventListener('hashchange', render);
  await renderTopbar();
  await render();
  // keep the reward countdown + badges fresh
  setInterval(() => !isPlaying() && renderTopbar(), 30000);
  listenForCode();
  decorate();
  setInterval(decorate, 60000);
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest?.('.btn, .nav a, .mode-card, .portal, .chip, .shop-item')) sfx.hover();
  });
  livePreviews();
}

export async function logoutFlow() {
  await api.logOut();
  store.set(null);
  $('#app').classList.add('hidden');
  $('#app').classList.remove('reveal');
  location.hash = '/';
  await runBoot();
  $('#app').classList.remove('hidden');
  requestAnimationFrame(() => $('#app').classList.add('reveal'));
  await renderTopbar();
  await render();
}

// ---------- gifts from operators ----------
let giftOpen = false;
function showGifts() {
  const g = store.me?.inbox?.[0];
  if (!g || giftOpen) return;
  giftOpen = true;
  const items = (g.items || []).map((k) => ITEM[k]).filter(Boolean);
  const m = modal(`<div class="gift-pop"><div class="gift-ico">🎁</div><h3 class="m-title">A GIFT FROM ${esc(g.from)}</h3>
    ${g.msg ? `<p class="m-text">“${esc(g.msg)}”</p>` : ''}
    <div class="gift-list">${g.coins ? `<span class="rchip"><i class="coin"></i>${num(g.coins)}</span>` : ''}${g.xp ? `<span class="rchip">+${num(g.xp)} XP</span>` : ''}${items.map((it) => `<span class="rchip">${esc(it.name)}</span>`).join('')}</div>
    <button class="btn primary big" data-open>OPEN GIFT</button></div>`, { onClose: () => (giftOpen = false) });
  m.el.querySelector('[data-open]').onclick = async () => {
    try {
      const r = await api.claimGift(g.id);
      store.set(r.me);
      sfx.level();
      toast('Gift opened!', 'reward');
    } catch (e) {
      errToast(e);
    }
    m.close();
    giftOpen = false;
    setTimeout(showGifts, 400);
  };
}

// ---------- secret operator code: just type it anywhere ----------
function listenForCode() {
  let buf = '';
  document.addEventListener('keydown', async (e) => {
    if (e.target.closest?.('input, textarea, select') || e.key.length !== 1 || !store.me) return;
    buf = (buf + e.key.toUpperCase()).slice(-12);
    if (buf.length < 7) return;
    const u = await api.unlockOperator(buf.slice(-7));
    if (!u) return;
    buf = '';
    store.set(u);
    sfx.level();
    toast('<b>⛨ OPERATOR MODE ON</b><br>Welcome back, operator.', 'level', 4500);
    go('/operator');
  });
}

// ---------- event decorations floating in the background ----------
function decorate() {
  const evs = api.liveEventsNow();
  let layer = $('#decor');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'decor';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  const glyphs = evs.flatMap((e) => (e.decor || []).map((g) => [g, e.color]));
  const sig = glyphs.map((g) => g.join('')).join('|');
  if (layer.dataset.sig === sig) return;
  layer.dataset.sig = sig;
  layer.innerHTML = glyphs.length ? Array.from({ length: 18 }, (_, i) => {
    const [g, c] = glyphs[i % glyphs.length];
    return `<i style="left:${(i * 37) % 100}%;--c:${c};animation-delay:${-(i * 1.7) % 16}s;animation-duration:${14 + (i % 5) * 3}s;font-size:${14 + (i % 4) * 6}px">${g}</i>`;
  }).join('') : '';
}

start();
