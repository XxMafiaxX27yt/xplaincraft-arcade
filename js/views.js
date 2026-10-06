// Profile, friends, shop/locker, tasks, leaderboards, settings.
import { $, esc, levelInfo, num, fmtTime, fmtDate, timeAgo, fmtClock, msUntilMidnight } from './util.js';
import { api, store } from './store.js';
import { sfx } from './sfx.js';
import { ITEM, RARITY } from './cosmetics/catalog.js';
import { avatarHTML, callsignHTML, titleHTML, badgeHTML, stickerHTML, sceneAttrs } from './cosmetics/render.js';
import { find } from './cosmetics/catalog.js';
import { rewardChips, bindRewardChips } from './items-ui.js';
import * as E from './economy.js';
import { GAMES, GAME } from './games.js';
import { ALL_DONE_BONUS } from './tasks.js';
import { modal, toast, errToast, rewardPopup, confirmBox } from './ui.js';
import { go, render, openGame, openDaily, logoutFlow } from './app.js';
import { canGiveLove, openLoveGift } from './views-love.js';

async function act(fn, okMsg) {
  try {
    const r = await fn();
    if (r && r.username) store.set(r);
    if (okMsg) {
      sfx.ok();
      toast(okMsg, 'ok');
    }
    return r ?? true;
  } catch (e) {
    errToast(e);
    return null;
  }
}

// ======================= PROFILE =======================
export async function viewProfile(el, name) {
  const me = store.me;
  const p = name ? await api.getProfile(name) : await api.getProfile(me.username);
  if (!p) {
    el.innerHTML = `<section class="center-msg"><h1 class="h1">PLAYER NOT FOUND</h1><p class="dim">No one goes by "${esc(name)}".</p><a class="btn primary" href="#/friends/find">FIND PLAYERS</a></section>`;
    return;
  }
  const own = p.relation === 'self';
  const lv = levelInfo(p.xp);
  const games = Object.entries(p.stats.games).filter(([id]) => GAME[id]).sort((a, b) => b[1].plays - a[1].plays);
  const relBtn = {
    self: `<button class="btn ghost" data-edit>✎ EDIT PROFILE</button><a class="btn primary" href="#/locker">CUSTOMIZE</a>`,
    friend: `<span class="tag ok">✓ FRIENDS</span><button class="btn ghost" data-remove>REMOVE FRIEND</button>`,
    sent: `<span class="tag">REQUEST SENT</span><button class="btn ghost" data-cancel>CANCEL</button>`,
    received: `<button class="btn primary" data-accept>ACCEPT REQUEST</button><button class="btn ghost" data-decline>DECLINE</button>`,
    none: `<button class="btn primary" data-add>+ ADD FRIEND</button>`,
  }[p.relation];

  const bd = sceneAttrs(find('backdrop', p.equipped.backdrop));
  const bn = sceneAttrs(find('banner', p.equipped.banner));
  el.innerHTML = `
  <section class="profile">
    ${p.equipped.backdrop !== 'none' ? `<div class="pf-backdrop ${bd.cls}" style="${bd.style}"></div>` : ''}
    <div class="pf-banner ${bn.cls}" style="${bn.style}"></div>
    <div class="pf-head">
      ${avatarHTML(p.equipped, 128, 'pf-av', true)}
      <div class="pf-id">
        <div class="pf-namerow">${callsignHTML(p.username, p.equipped, 'xl')}${p.operator ? '<span class="tag op-tag">⛨ OPERATOR</span>' : ''}</div>
        ${titleHTML(p.equipped, 'pf-title')}
        <div class="pf-sub">LEVEL <b>${lv.level}</b> · joined ${fmtDate(p.created)} · ${own ? 'online now' : 'last seen ' + timeAgo(p.lastSeen)}</div>
        <div class="pf-xp"><span class="xpbar big"><i style="width:${(lv.pct * 100).toFixed(1)}%"></i></span><small>${num(lv.into)} / ${num(lv.need)} XP to level ${lv.level + 1}</small></div>
      </div>
      <div class="pf-actions">${relBtn}${canGiveLove() ? '<button class="btn love-btn" data-love>💝 GIVE A LOVE SET</button>' : ''}</div>
    </div>
    ${p.equipped.badge.length || p.equipped.sticker.length ? `<div class="pf-show">${p.equipped.badge.map((b) => badgeHTML(b, 44)).join('')}${p.equipped.sticker.map((x) => stickerHTML(x, 52)).join('')}</div>` : own ? '<div class="pf-show dim small">Pin badges and stickers from your <a href="#/locker/badge">LOCKER</a>.</div>' : ''}
    <div class="pf-bio">${p.bio ? esc(p.bio) : `<span class="dim">${own ? 'No bio yet. Click EDIT PROFILE to write one.' : 'No bio yet.'}</span>`}</div>
    <div class="pf-stats">
      <div class="stat"><b>${lv.level}</b><span>LEVEL</span></div>
      <div class="stat"><b>${num(p.xp)}</b><span>TOTAL XP</span></div>
      <div class="stat"><b>${num(p.stats.plays)}</b><span>GAMES PLAYED</span></div>
      <div class="stat"><b>${num(p.stats.wins)}</b><span>WINS</span></div>
      <div class="stat"><b>${fmtTime(p.stats.time)}</b><span>PLAYTIME</span></div>
      <div class="stat"><b>${p.friendCount}</b><span>FRIENDS</span></div>
      <div class="stat"><b>${num(p.owned)}</b><span>COSMETICS</span></div>
      <div class="stat"><b>${p.achievements}</b><span>ACHIEVEMENTS</span></div>
    </div>
    <div class="pf-cols">
      <div class="panel">
        <div class="panel-h">GAMES</div>
        ${games.length ? games.map(([id, s]) => `<button class="pf-game" data-game="${id}">
            <span class="mg-g" style="--a:${GAME[id].art[0]}">${GAME[id].glyph}</span>
            <span><b>${esc(GAME[id].title)}</b><small>${s.plays} plays · ${fmtTime(s.time)}</small></span>
            <span class="pf-best">${s.best ?? '—'}<small>BEST</small></span></button>`).join('')
          : '<div class="empty-sm">No games played yet.</div>'}
      </div>
      <div class="panel">
        <div class="panel-h">FRIENDS · ${p.friends.length}</div>
        ${p.friends.length ? p.friends.map((f) => `<a class="mini-friend" href="#/profile/${esc(f.username)}">${avatarHTML(f.equipped, 28)}${callsignHTML(f.username, f.equipped, 'sm')}<small>LV ${levelInfo(f.xp).level}</small></a>`).join('')
          : '<div class="empty-sm">No friends yet.</div>'}
      </div>
    </div>
  </section>`;

  el.querySelectorAll('[data-game]').forEach((b) => (b.onclick = () => openGame(b.dataset.game)));
  const on = (sel, fn) => {
    const b = el.querySelector(sel);
    if (b) b.onclick = fn;
  };
  on('[data-edit]', () => editProfile());
  on('[data-love]', () => openLoveGift(p.username));
  on('[data-add]', async () => (await act(() => api.sendFriendRequest(p.username), `Friend request sent to <b>${esc(p.username)}</b>`)) && render());
  on('[data-cancel]', async () => (await act(() => api.cancelRequest(p.username), 'Request cancelled')) && render());
  on('[data-accept]', async () => (await act(() => api.respondRequest(p.username, true), `You and <b>${esc(p.username)}</b> are now friends`)) && render());
  on('[data-decline]', async () => (await act(() => api.respondRequest(p.username, false), 'Request declined')) && render());
  on('[data-remove]', async () => {
    if (await confirmBox('REMOVE FRIEND', `Remove <b>${esc(p.username)}</b> from your friends?`, { ok: 'REMOVE', danger: true }))
      (await act(() => api.removeFriend(p.username), 'Friend removed')) && render();
  });
}

function editProfile() {
  const me = store.me;
  const m = modal(`
    <h3 class="m-title">EDIT PROFILE</h3>
    <label class="fld"><span>BIO <small data-n>${me.bio.length}/160</small></span>
      <textarea maxlength="160" rows="4" data-bio placeholder="Tell other players about you">${esc(me.bio)}</textarea></label>
    <p class="m-text dim">Callsign and password are in <a href="#/settings">SETTINGS</a>. Look and style are in the <a href="#/shop">SHOP / LOCKER</a>.</p>
    <div class="m-actions"><button class="btn ghost" data-close>CANCEL</button><button class="btn primary" data-save>SAVE</button></div>`);
  const ta = m.el.querySelector('[data-bio]');
  ta.oninput = () => (m.el.querySelector('[data-n]').textContent = `${ta.value.length}/160`);
  m.el.querySelector('[data-save]').onclick = async () => {
    if (await act(() => api.updateProfile({ bio: ta.value }), 'Profile saved')) {
      m.close();
      render();
    }
  };
}

// ======================= FRIENDS =======================
export async function viewFriends(el, tab = 'list') {
  if (!['list', 'requests', 'find'].includes(tab)) tab = 'list';
  const d = await api.friendsData();
  const row = (f, actions) => `<div class="frow">
      <a href="#/profile/${esc(f.username)}" class="frow-id">${avatarHTML(f.equipped, 40)}
        <span>${callsignHTML(f.username, f.equipped)}<small>LEVEL ${levelInfo(f.xp).level}${f.lastSeen ? ' · seen ' + timeAgo(f.lastSeen) : ''}</small></span></a>
      <span class="frow-a">${actions}</span></div>`;

  let body = '';
  if (tab === 'list') {
    body = d.friends.length
      ? d.friends.map((f) => row(f, `<a class="btn ghost sm" href="#/profile/${esc(f.username)}">PROFILE</a><button class="btn ghost sm" data-remove="${esc(f.username)}">REMOVE</button>`)).join('')
      : `<div class="empty"><div class="empty-i">☺</div><b>No friends yet</b><span>Find players by their callsign.</span><a class="btn primary" href="#/friends/find">FIND PLAYERS</a></div>`;
  } else if (tab === 'requests') {
    body = `<div class="sub-h">INCOMING · ${d.incoming.length}</div>` +
      (d.incoming.length ? d.incoming.map((f) => row(f, `<button class="btn primary sm" data-accept="${esc(f.username)}">ACCEPT</button><button class="btn ghost sm" data-decline="${esc(f.username)}">DECLINE</button>`)).join('') : '<div class="empty-sm">No incoming requests.</div>') +
      `<div class="sub-h">SENT · ${d.outgoing.length}</div>` +
      (d.outgoing.length ? d.outgoing.map((f) => row(f, `<button class="btn ghost sm" data-cancel="${esc(f.username)}">CANCEL</button>`)).join('') : '<div class="empty-sm">No sent requests.</div>');
  } else {
    body = `<label class="search wide"><span>⌕</span><input data-find placeholder="Type a callsign..." autofocus></label><div data-results><div class="empty-sm">Start typing to search players.</div></div>`;
  }

  el.innerHTML = `
  <section class="friends">
    <h1 class="h1">FRIENDS</h1>
    <div class="tabs">
      <a href="#/friends" class="${tab === 'list' ? 'on' : ''}">MY FRIENDS <small>${d.friends.length}</small></a>
      <a href="#/friends/requests" class="${tab === 'requests' ? 'on' : ''}">REQUESTS ${d.incoming.length ? `<span class="dot">${d.incoming.length}</span>` : ''}</a>
      <a href="#/friends/find" class="${tab === 'find' ? 'on' : ''}">FIND PLAYERS</a>
    </div>
    ${api.MODE === 'local' ? `<div class="note">Accounts are on this device for now, so you can only find players who signed up in this browser. Online friends arrive when the arcade server is connected.</div>` : ''}
    <div class="panel flist">${body}</div>
  </section>`;

  const bind = (attr, fn) => el.querySelectorAll(`[${attr}]`).forEach((b) => (b.onclick = () => fn(b.getAttribute(attr))));
  bind('data-remove', async (n) => {
    if (await confirmBox('REMOVE FRIEND', `Remove <b>${esc(n)}</b>?`, { ok: 'REMOVE', danger: true })) (await act(() => api.removeFriend(n), 'Friend removed')) && render();
  });
  bind('data-accept', async (n) => (await act(() => api.respondRequest(n, true), `You and <b>${esc(n)}</b> are now friends`)) && render());
  bind('data-decline', async (n) => (await act(() => api.respondRequest(n, false), 'Request declined')) && render());
  bind('data-cancel', async (n) => (await act(() => api.cancelRequest(n), 'Request cancelled')) && render());

  const input = el.querySelector('[data-find]');
  if (input) {
    const out = el.querySelector('[data-results]');
    const label = { none: '+ ADD', sent: 'SENT', received: 'ACCEPT', friend: 'FRIENDS' };
    const search = async () => {
      const res = await api.searchPlayers(input.value);
      if (!input.value.trim()) return (out.innerHTML = '<div class="empty-sm">Start typing to search players.</div>');
      out.innerHTML = res.length
        ? res.map((f) => row(f, `<a class="btn ghost sm" href="#/profile/${esc(f.username)}">PROFILE</a><button class="btn ${f.relation === 'none' || f.relation === 'received' ? 'primary' : 'ghost'} sm" data-add="${esc(f.username)}" ${f.relation === 'sent' || f.relation === 'friend' ? 'disabled' : ''}>${label[f.relation]}</button>`)).join('')
        : `<div class="empty-sm">No player called "${esc(input.value)}".</div>`;
      out.querySelectorAll('[data-add]').forEach((b) => (b.onclick = async () => {
        const n = b.dataset.add;
        if (await act(() => api.sendFriendRequest(n), `Request sent to <b>${esc(n)}</b>`)) search();
      }));
    };
    input.oninput = search;
    input.focus();
  }
}

// ======================= TASKS + DAILY =======================
export async function viewTasks(el, tab = 'daily') {
  if (tab === 'achievements') return viewAchievements(el);
  if (tab === 'levels') return viewLevelRoad(el);
  const me = store.me;
  const st = api.dailyState(me);
  const tasks = me.tasks.list;
  const allClaimed = tasks.every((t) => t.claimed);
  el.innerHTML = `
  <section class="tasks">
    <h1 class="h1">TASKS</h1>
    ${progressTabs('daily')}
    <div class="panel">
      <div class="panel-h">DAILY REWARD <span class="dim">streak ${st.streak}</span></div>
      <div class="dr-track">${api.DAILY_REWARDS.map((c, i) => {
        let cls = '';
        if (i < st.dayIndex || (st.claimedToday && i === st.dayIndex)) cls = 'got';
        else if (i === st.dayIndex) cls = 'today';
        return `<div class="dr-day ${cls}"><span>DAY ${i + 1}</span><b>${c}</b><i class="coin"></i>${cls === 'got' ? '<em>✓</em>' : ''}</div>`;
      }).join('')}</div>
      <div class="dr-foot">${st.claimedToday ? `<span class="dim">Claimed today. Next reward in <b data-cd>${fmtClock(msUntilMidnight())}</b></span>` : `<button class="btn primary" data-daily>CLAIM ${st.reward} COINS</button>`}</div>
    </div>
    <div class="panel">
      <div class="panel-h">TODAY'S TASKS <span class="dim">new tasks in <b data-cd>${fmtClock(msUntilMidnight())}</b></span></div>
      ${tasks.map((t) => {
        const done = t.progress >= t.target;
        const prog = t.type === 'time' ? `${fmtTime(t.progress)} / ${fmtTime(t.target)}` : `${t.progress} / ${t.target}`;
        return `<div class="task ${t.claimed ? 'claimed' : done ? 'ready' : ''}">
          <div class="task-i">${t.claimed ? '✓' : done ? '!' : '◇'}</div>
          <div class="task-b"><b>${esc(t.text)}</b>
            <span class="mt-bar"><i style="width:${(Math.min(1, t.progress / t.target) * 100).toFixed(0)}%"></i></span>
            <small>${prog}</small></div>
          <div class="task-r"><span>+${t.coins} <i class="coin"></i></span><span>+${t.xp} XP</span></div>
          ${t.claimed ? '<button class="btn ghost sm" disabled>CLAIMED</button>'
            : done ? `<button class="btn primary sm" data-claim="${t.id}">CLAIM</button>`
            : t.type === 'gameStat' ? `<button class="btn ghost sm" data-play="${t.game}">PLAY</button>`
            : t.type === 'daily' ? `<button class="btn ghost sm" data-daily>GO</button>`
            : t.type === 'equip' || t.type === 'buy' ? `<a class="btn ghost sm" href="#/shop">SHOP</a>`
            : t.type === 'profile' ? `<a class="btn ghost sm" href="#/profile">PROFILE</a>`
            : `<a class="btn ghost sm" href="#/">PLAY</a>`}
        </div>`;
      }).join('')}
      <div class="task bonus ${me.tasks.bonusClaimed ? 'claimed' : allClaimed ? 'ready' : ''}">
        <div class="task-i">★</div>
        <div class="task-b"><b>Finish all 3 tasks</b><small>bonus reward</small></div>
        <div class="task-r"><span>+${ALL_DONE_BONUS.coins} <i class="coin"></i></span><span>+${ALL_DONE_BONUS.xp} XP</span></div>
        ${me.tasks.bonusClaimed ? '<button class="btn ghost sm" disabled>CLAIMED</button>' : `<button class="btn ${allClaimed ? 'primary' : 'ghost'} sm" data-bonus ${allClaimed ? '' : 'disabled'}>CLAIM</button>`}
      </div>
    </div>
  </section>`;

  const cds = el.querySelectorAll('[data-cd]');
  const timer = setInterval(() => {
    if (!document.contains(cds[0])) return clearInterval(timer);
    cds.forEach((c) => (c.textContent = fmtClock(msUntilMidnight())));
  }, 1000);
  el.querySelectorAll('[data-daily]').forEach((b) => (b.onclick = () => openDaily()));
  el.querySelectorAll('[data-play]').forEach((b) => (b.onclick = () => openGame(b.dataset.play)));
  el.querySelectorAll('[data-claim]').forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    const r = await act(() => api.claimTask(b.dataset.claim));
    if (r) {
      store.set(r.me);
      rewardPopup({ coins: r.coins, xp: r.xp, levelUp: r.levelUp, title: 'TASK CLAIMED' });
      render();
    } else b.disabled = false;
  }));
  const bonus = el.querySelector('[data-bonus]');
  if (bonus) bonus.onclick = async () => {
    const r = await act(() => api.claimTaskBonus());
    if (r) {
      store.set(r.me);
      rewardPopup({ coins: r.coins, xp: r.xp, levelUp: r.levelUp, title: 'ALL TASKS DONE' });
      render();
    }
  };
}

function progressTabs(on) {
  const me = store.me;
  const achReady = api.achievementState(me).filter((a) => a.done && !a.claimed).length;
  const lv = levelInfo(me.xp).level;
  const roadReady = E.levelRoad().filter((r) => r.level <= lv && !me.levelClaimed.includes(r.level)).length;
  return `<div class="tabs"><a href="#/tasks" class="${on === 'daily' ? 'on' : ''}">DAILY</a>
    <a href="#/tasks/achievements" class="${on === 'achievements' ? 'on' : ''}">ACHIEVEMENTS ${achReady ? `<span class="dot">${achReady}</span>` : ''}</a>
    <a href="#/tasks/levels" class="${on === 'levels' ? 'on' : ''}">LEVEL ROAD ${roadReady ? `<span class="dot">${roadReady}</span>` : ''}</a></div>`;
}

const achFilter = { show: 'all' };
async function viewAchievements(el) {
  const me = store.me;
  const list = api.achievementState(me);
  const done = list.filter((a) => a.claimed).length;
  const sorted = [...list].sort((a, b) => (b.done && !b.claimed) - (a.done && !a.claimed) || a.claimed - b.claimed || b.value / b.target - a.value / a.target);
  const shown = sorted.filter((a) => achFilter.show === 'all' || (achFilter.show === 'sets' ? a.pal : !a.pal));
  el.innerHTML = `<section class="tasks"><h1 class="h1">TASKS</h1>${progressTabs('achievements')}
    <div class="ach-head"><span class="dim">${done} / ${list.length} unlocked · each one gives a badge you can pin on your profile</span>
      <span class="seg">${[['all', 'ALL'], ['main', 'ACHIEVEMENTS'], ['sets', 'COLLECTIONS']].map(([k, n]) => `<button class="${achFilter.show === k ? 'on' : ''}" data-f="${k}">${n}</button>`).join('')}</span></div>
    <div class="ach-grid">${shown.map((a) => `<div class="ach ${a.claimed ? 'claimed' : a.done ? 'ready' : ''}" style="--r:${RARITY[a.rarity].color}">
      ${badgeHTML(a.id, 50)}
      <div class="ach-b"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>
        <span class="mt-bar"><i style="width:${((a.value / a.target) * 100).toFixed(0)}%"></i></span>
        <small class="ach-r">${num(Math.floor(a.value))} / ${num(a.target)} · +${num(a.coins)} coins${a.title ? ` · title “${esc(a.title)}”` : ''}</small></div>
      ${a.claimed ? '<span class="ach-ok">✓</span>' : a.done ? `<button class="btn primary sm" data-claim="${a.id}">CLAIM</button>` : ''}
    </div>`).join('')}</div></section>`;
  el.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => ((achFilter.show = b.dataset.f), viewAchievements(el))));
  el.querySelectorAll('[data-claim]').forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    const r = await act(() => api.claimAchievement(b.dataset.claim));
    if (r) {
      store.set(r.me);
      rewardPopup({ coins: r.coins, title: 'ACHIEVEMENT' });
      toast(`New badge: <b>${esc(ITEM[r.badge].name)}</b>${r.title ? ` + title <b>${esc(ITEM[r.title].text)}</b>` : ''}`, 'reward');
    }
    viewAchievements(el);
  }));
}

async function viewLevelRoad(el) {
  const me = store.me;
  const lv = levelInfo(me.xp).level;
  const road = E.levelRoad();
  el.innerHTML = `<section class="tasks"><h1 class="h1">TASKS</h1>${progressTabs('levels')}
    <div class="dim" style="margin-bottom:14px">You are level <b style="color:var(--cyan)">${lv}</b>. Every level gives coins, every 5 levels a cosmetic, every 10 a crate.</div>
    <div class="road">${road.map((r) => {
      const got = me.levelClaimed.includes(r.level);
      const reached = lv >= r.level;
      return `<div class="road-step ${got ? 'got' : reached ? 'ready' : ''} ${r.rewards.length > 1 ? 'big' : ''}">
        <div class="road-lv">LV ${r.level}</div><div class="rchips">${rewardChips(r.rewards)}</div>
        ${got ? '<span class="ach-ok">✓</span>' : reached ? `<button class="btn primary sm" data-lv="${r.level}">CLAIM</button>` : '<span class="pt-lock">🔒</span>'}
      </div>`;
    }).join('')}</div></section>`;
  bindRewardChips(el, () => viewLevelRoad(el));
  const first = el.querySelector('.road-step.ready') || el.querySelector('.road-step:not(.got)');
  first?.scrollIntoView({ block: 'center' });
  el.querySelectorAll('[data-lv]').forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    const r = await act(() => api.claimLevel(Number(b.dataset.lv)));
    if (r) {
      store.set(r.me);
      sfx.coin();
      toast(`Level ${b.dataset.lv} rewards claimed`, 'reward');
      r.crateItems.forEach((k) => toast(`📦 Crate gave <b>${esc(ITEM[k].name)}</b>`, 'reward'));
    }
    viewLevelRoad(el);
  }));
}

// ======================= LEADERBOARDS =======================
export async function viewLeaderboards(el, board = 'xp') {
  if (!['xp', 'coins', 'owned'].includes(board) && !GAME[board]) board = 'xp';
  const special = { xp: ['OVERALL', 'TOTAL XP'], coins: ['RICHEST', 'COINS EARNED'], owned: ['COLLECTORS', 'COSMETICS OWNED'] }[board];
  const me = store.me;
  const rows = await api.leaderboard(board);
  const label = special ? special[1] : GAME[board].scoreLabel || 'SCORE';
  const myRank = rows.findIndex((r) => r.id === me.id);
  el.innerHTML = `
  <section class="ranks">
    <h1 class="h1">LEADERBOARDS</h1>
    <div class="tabs">
      <a href="#/leaderboards/xp" class="${board === 'xp' ? 'on' : ''}">★ OVERALL</a>
      <a href="#/leaderboards/coins" class="${board === 'coins' ? 'on' : ''}">🪙 RICHEST</a>
      <a href="#/leaderboards/owned" class="${board === 'owned' ? 'on' : ''}">💎 COLLECTORS</a>
      ${GAMES.map((g) => `<a href="#/leaderboards/${g.id}" class="${board === g.id ? 'on' : ''}">${esc(g.title)}</a>`).join('')}
    </div>
    ${api.MODE === 'local' ? '<div class="note">Showing players on this device. Global ranks arrive with the arcade server.</div>' : ''}
    <div class="panel">
      <div class="panel-h">${special ? special[0] : esc(GAME[board].title)} · ${label} ${myRank >= 0 ? `<span class="dim">you are #${myRank + 1}</span>` : ''}</div>
      ${rows.length ? `<div class="lb">${rows.map((r, i) => `<a class="lb-row ${r.id === me.id ? 'me' : ''} ${i < 3 ? 'top' + (i + 1) : ''}" href="#/profile/${esc(r.username)}">
          <span class="lb-rank">${i + 1}</span>${avatarHTML(r.equipped, 36)}${callsignHTML(r.username, r.equipped)}
          ${board === 'xp' ? `<span class="lb-lv">LV ${levelInfo(r.value).level}</span>` : ''}<span class="lb-v">${num(r.value)}</span></a>`).join('')}</div>`
        : `<div class="empty"><div class="empty-i">🏆</div><b>No scores yet</b>${!special ? `<button class="btn primary" data-play="${board}">PLAY ${esc(GAME[board].title)}</button>` : ''}</div>`}
    </div>
  </section>`;
  el.querySelectorAll('[data-play]').forEach((b) => (b.onclick = () => openGame(b.dataset.play)));
}

// ======================= SETTINGS =======================
export async function viewSettings(el) {
  const me = store.me;
  const s = me.settings;
  el.innerHTML = `
  <section class="settings">
    <h1 class="h1">SETTINGS</h1>
    <div class="set-cols">
    <div class="panel">
      <div class="panel-h">ACCOUNT</div>
      <form class="set-form" data-name>
        <label class="fld"><span>CALLSIGN</span><input name="n" maxlength="16" value="${esc(me.username)}"></label>
        <button class="btn primary sm">CHANGE CALLSIGN</button>
      </form>
      <form class="set-form" data-pass>
        <label class="fld"><span>CURRENT PASSWORD</span><input name="o" type="password" autocomplete="current-password"></label>
        <label class="fld"><span>NEW PASSWORD</span><input name="n" type="password" autocomplete="new-password"></label>
        <button class="btn primary sm">CHANGE PASSWORD</button>
      </form>
      <div class="set-row"><button class="btn ghost" data-logout>LOG OUT</button><button class="btn danger" data-delete>DELETE ACCOUNT</button></div>
      <p class="dim small">Account saved ${api.MODE === 'local' ? 'on this device (this browser)' : 'online'}.</p>
    </div>
    <div class="panel">
      <div class="panel-h">SOUND</div>
      <label class="tgl"><input type="checkbox" data-set="sfx" ${s.sfx ? 'checked' : ''}><span></span>UI sounds</label>
      <label class="fld"><span>VOLUME <small data-vol>${Math.round(s.volume * 100)}%</small></span><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-set="volume"></label>
      <div class="panel-h">DISPLAY</div>
      <label class="tgl"><input type="checkbox" data-set="scanlines" ${s.scanlines ? 'checked' : ''}><span></span>CRT scanlines</label>
      <label class="tgl"><input type="checkbox" data-set="reducedMotion" ${s.reducedMotion ? 'checked' : ''}><span></span>Reduce motion</label>
      <div class="panel-h">INTRO</div>
      <div class="seg">${['full', 'short'].map((k) => `<button class="${s.intro === k ? 'on' : ''}" data-intro="${k}">${k === 'full' ? 'FULL INTRO' : 'SHORT INTRO'}</button>`).join('')}</div>
      <p class="dim small">Short skips the boot animation when you come back.</p>
    </div>
    </div>
  </section>`;

  el.querySelector('[data-name]').onsubmit = async (e) => {
    e.preventDefault();
    const n = e.target.n.value;
    if (n === me.username) return;
    (await act(() => api.changeUsername(n), `Callsign changed to <b>${esc(n)}</b>`)) && render();
  };
  el.querySelector('[data-pass]').onsubmit = async (e) => {
    e.preventDefault();
    if (await act(() => api.changePassword(e.target.o.value, e.target.n.value), 'Password changed')) e.target.reset();
  };
  el.querySelector('[data-logout]').onclick = async () => {
    if (await confirmBox('LOG OUT', 'Log out of the arcade?', { ok: 'LOG OUT' })) logoutFlow();
  };
  el.querySelector('[data-delete]').onclick = () => {
    const m = modal(`<h3 class="m-title">DELETE ACCOUNT</h3>
      <p class="m-text">This removes <b>${esc(me.username)}</b>, all coins, cosmetics, scores and friends. It cannot be undone.</p>
      <label class="fld"><span>TYPE YOUR PASSWORD</span><input type="password" data-pw></label>
      <div class="m-actions"><button class="btn ghost" data-close>CANCEL</button><button class="btn danger" data-del>DELETE FOREVER</button></div>`);
    m.el.querySelector('[data-del]').onclick = async () => {
      try {
        await api.deleteAccount(m.el.querySelector('[data-pw]').value);
        m.close();
        toast('Account deleted', 'ok');
        logoutFlow();
      } catch (e) {
        errToast(e);
      }
    };
  };
  const save = async (patch) => {
    const u = await act(() => api.updateSettings(patch));
    if (u) sfx.click();
  };
  el.querySelectorAll('input[type=checkbox][data-set]').forEach((i) => (i.onchange = () => save({ [i.dataset.set]: i.checked })));
  const vol = el.querySelector('input[data-set=volume]');
  vol.oninput = () => (el.querySelector('[data-vol]').textContent = Math.round(vol.value * 100) + '%');
  vol.onchange = () => save({ volume: Number(vol.value) });
  el.querySelectorAll('[data-intro]').forEach((b) => (b.onclick = async () => {
    await save({ intro: b.dataset.intro });
    el.querySelectorAll('[data-intro]').forEach((x) => x.classList.toggle('on', x === b));
  }));
}
