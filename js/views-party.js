// Party UI: the floating party dock (members, chat, stickers, invite, start), the party menu
// (create / join by code), invites, and launching everyone when the leader presses START.
import { $, esc, levelInfo } from './util.js';
import { api, store } from './store.js';
import { party, onParty, createParty, joinParty, leaveParty, sendChat, pickGame, startGame, kick, invite, quickMatch, startSocial, onlineNow } from './party.js';
import { GAME, gamesFor, thumbHTML } from './games.js';
import { avatarHTML, callsignHTML } from './cosmetics/render.js';
import { modal, toast, errToast } from './ui.js';
import { launch, isPlaying } from './host.js';
import { sfx } from './sfx.js';

const STICKERS = ['😂', '🔥', '💀', '👻', '🎉', '😎', '😱', '👍', '❤️', 'GG', 'EZ', '?!'];
let open = false;
let unread = 0;

export function initParty() {
  let dock = $('#party-dock');
  if (!dock) {
    dock = document.createElement('div');
    dock.id = 'party-dock';
    document.body.appendChild(dock);
  }
  onParty((e) => {
    if (e.type === 'chat' && !open && !e.m.sys && e.m.id !== party.me) unread++;
    if (e.type === 'chat' && e.m.id !== party.me && !e.m.sys) sfx.click();
    if (e.type === 'start' && !isPlaying()) {
      const g = GAME[e.start.game];
      toast(`<b>${esc(g?.title || 'GAME')}</b> starting…`, 'level', 2000);
      launch(e.start.game, { net: e.start });
    }
    if (e.type === 'invite') showInvite(e.invite);
    if (e.type === 'error') toast(esc(e.msg), 'err');
    if (e.type === 'left') open = false;
    renderDock();
  });
  if (api.MODE === 'online') startSocial();
  window.addEventListener('xc-game', () => setTimeout(() => (renderDock(), renderGameChat()), 50));
  onParty((e) => {
    if (!isPlaying()) return;
    if (e.type === 'chat' && !gcOpen && (e.m.sys || e.m.id !== party.me)) {
      if (!e.m.sys) gcUnread++;
      bubble(e.m);
    }
    if (e.type === 'left') gcOpen = false;
    renderGameChat();
  });
  renderDock();
}

// ---------- party chat inside a game: a 💬 button in the game bar, a chat panel over the game, pop-up bubbles ----------
let gcOpen = false;
let gcUnread = 0;
function renderGameChat() {
  const layer = $('#game-layer');
  const bar = layer && $('.gl-bar', layer);
  const old = layer && $('.gc-panel', layer);
  if (!bar || !isPlaying() || !party.code) {
    bar?.querySelector('[data-gchat]')?.remove();
    old?.remove();
    gcOpen = false;
    return;
  }
  let btn = bar.querySelector('[data-gchat]');
  if (!btn) {
    btn = document.createElement('button');
    btn.className = 'btn sm gc-btn';
    btn.dataset.gchat = '1';
    btn.onclick = () => {
      gcOpen = !gcOpen;
      gcUnread = 0;
      renderGameChat();
      if (gcOpen) layer.querySelector('.gc-panel [data-msg]')?.focus();
      else $('.gl-frame', layer)?.focus();
    };
    bar.insertBefore(btn, bar.querySelector('.gl-best'));
  }
  btn.innerHTML = `💬 <span>CHAT</span>${gcUnread ? `<i class="pd-dot">${gcUnread}</i>` : ''}`;
  btn.classList.toggle('on', gcOpen);
  if (!gcOpen) {
    old?.remove();
    return;
  }
  const me = party.me;
  const typed = old?.querySelector('[data-msg]')?.value || '';
  const hadFocus = !!old && document.activeElement === old.querySelector('[data-msg]');
  old?.remove();
  const p = document.createElement('div');
  p.className = 'gc-panel';
  p.innerHTML = `
    <div class="pd-head"><div><b>PARTY CHAT</b> <span class="pd-code">${esc(party.code)}</span></div><button class="btn sm ghost" data-close title="Back to the game">✕</button></div>
    <div class="pd-chat" data-chat>${party.chat.map((c) => (c.sys ? `<div class="pd-sys">${esc(c.text)}</div>` : `<div class="pd-msg ${c.id === me ? 'me' : ''}"><b>${esc(c.from)}</b>${c.sticker ? `<span class="pd-stk">${esc(c.sticker)}</span>` : esc(c.text)}</div>`)).join('') || '<div class="pd-sys">Say something to your party.</div>'}</div>
    <div class="pd-stickers">${STICKERS.map((s) => `<button data-stk="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <form class="pd-send" data-send><input maxlength="160" placeholder="Message the party" data-msg autocomplete="off" enterkeyhint="send"><button class="btn sm primary">SEND</button></form>`;
  layer.appendChild(p);
  const chat = p.querySelector('[data-chat]');
  chat.scrollTop = chat.scrollHeight;
  const input = p.querySelector('[data-msg]');
  input.value = typed;
  if (hadFocus) input.focus();
  const close = () => {
    gcOpen = false;
    renderGameChat();
    $('.gl-frame', layer)?.focus();
  };
  p.querySelector('[data-close]').onclick = close;
  input.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') close();
  };
  p.querySelectorAll('[data-stk]').forEach((b) => (b.onclick = () => sendChat('', b.dataset.stk)));
  p.querySelector('[data-send]').onsubmit = (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = ''; // before sending: sending re-renders the panel, which keeps whatever is typed
    sendChat(v);
    layer.querySelector('.gc-panel [data-msg]')?.focus();
  };
}
function bubble(m) {
  const layer = $('#game-layer');
  if (!layer || !isPlaying()) return;
  let box = $('.gc-bubbles', layer);
  if (!box) {
    box = document.createElement('div');
    box.className = 'gc-bubbles';
    layer.appendChild(box);
  }
  const b = document.createElement('div');
  b.className = 'gc-bubble' + (m.sys ? ' sys' : '');
  b.innerHTML = m.sys ? esc(m.text) : `<b>${esc(m.from)}</b>${m.sticker ? `<span class="pd-stk">${esc(m.sticker)}</span>` : esc(m.text)}`;
  b.onclick = () => {
    gcOpen = true;
    gcUnread = 0;
    renderGameChat();
    layer.querySelector('.gc-panel [data-msg]')?.focus();
  };
  box.appendChild(b);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => b.classList.add('out'), 4500);
  setTimeout(() => b.remove(), 5000);
}

function showInvite(inv) {
  sfx.level?.();
  const g = GAME[inv.game];
  const m = modal(`<h3 class="m-title">PARTY INVITE</h3>
    <p class="m-text"><b>${esc(inv.from)}</b> invited you to their party${g ? ` to play <b>${esc(g.title)}</b>` : ''}.</p>
    <div class="row-btns"><button class="btn primary" data-yes>JOIN PARTY</button><button class="btn ghost" data-close>NOT NOW</button></div>`);
  m.el.querySelector('[data-yes]').onclick = async () => {
    try {
      await joinParty(inv.code);
      open = true;
      m.close();
      renderDock();
    } catch (e) {
      errToast(e);
    }
  };
}

function renderDock() {
  const dock = $('#party-dock');
  if (!dock || !store.me) return;
  dock.classList.toggle('hidden', isPlaying());
  if (!party.code) {
    dock.className = 'pd-mini' + (isPlaying() ? ' hidden' : '');
    dock.innerHTML = `<button class="pd-btn" data-party title="Party up">👥 <span>PARTY</span></button>`;
    dock.querySelector('[data-party]').onclick = () => (sfx.click(), openPartyMenu());
    return;
  }
  const g = GAME[party.game];
  dock.className = (open ? 'pd-open' : 'pd-mini') + (isPlaying() ? ' hidden' : '');
  if (!open) {
    dock.innerHTML = `<button class="pd-btn on" data-toggle>👥 <span>PARTY ${esc(party.code)}</span><b>${party.members.length}</b>${unread ? `<i class="pd-dot">${unread}</i>` : ''}</button>`;
    dock.querySelector('[data-toggle]').onclick = () => ((open = true), (unread = 0), renderDock());
    return;
  }
  const me = party.me;
  dock.innerHTML = `
    <div class="pd-head">
      <div><b>PARTY</b> <span class="pd-code" title="Share this code">${esc(party.code)}</span>${party.public ? ' <small class="dim">PUBLIC</small>' : ''}</div>
      <div class="pd-head-b"><button class="btn sm ghost" data-copy title="Copy the code">COPY</button><button class="btn sm ghost" data-min title="Minimise">—</button></div>
    </div>
    <div class="pd-members">
      ${party.members.map((m, i) => `<div class="pd-m">${avatarHTML(m.equipped, 28)}<span class="pd-n">${callsignHTML(m.username, m.equipped, 'sm')}<small>${i === 0 ? '★ LEADER' : ''}${m.status && m.status.startsWith('playing') ? ' · IN GAME' : ''}</small></span>
        ${party.isHost && m.id !== me ? `<button class="pd-x" data-kick="${esc(m.id)}" title="Remove">✕</button>` : ''}</div>`).join('')}
    </div>
    <div class="pd-game">
      ${g ? `${g.cover ? `<img class="pd-cover" src="${esc(g.cover)}" alt="">` : ''}<div><b>${esc(g.title)}</b><small>${g.minPlayers || 2}-${g.maxPlayers || 8} players</small></div>` : `<div class="dim small">${party.isHost ? 'Pick an online game for the party.' : 'Waiting for the leader to pick a game.'}</div>`}
    </div>
    <div class="pd-actions">
      ${party.isHost ? `<button class="btn sm" data-pick>${g ? 'CHANGE GAME' : 'PICK GAME'}</button><button class="btn sm primary" data-start ${g ? '' : 'disabled'}>▶ START</button>` : ''}
      <button class="btn sm" data-invite>INVITE</button>
      <button class="btn sm danger" data-leave>LEAVE</button>
    </div>
    <div class="pd-chat" data-chat>${party.chat.map((c) => (c.sys ? `<div class="pd-sys">${esc(c.text)}</div>` : `<div class="pd-msg ${c.id === me ? 'me' : ''}"><b>${esc(c.from)}</b>${c.sticker ? `<span class="pd-stk">${esc(c.sticker)}</span>` : esc(c.text)}</div>`)).join('') || '<div class="pd-sys">Say hi. Party chat is only seen by the party.</div>'}</div>
    <div class="pd-stickers">${STICKERS.map((s) => `<button data-stk="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <form class="pd-send" data-send><input maxlength="160" placeholder="Message the party" data-msg autocomplete="off"><button class="btn sm primary">SEND</button></form>`;
  const q = (sel) => dock.querySelector(sel);
  const chat = q('[data-chat]');
  chat.scrollTop = chat.scrollHeight;
  q('[data-min]').onclick = () => ((open = false), renderDock());
  q('[data-copy]').onclick = () => {
    navigator.clipboard?.writeText(party.code).then(() => toast('Party code copied', 'info', 1500), () => {});
  };
  q('[data-leave]').onclick = () => (sfx.back(), leaveParty());
  q('[data-invite]').onclick = () => openInvite();
  dock.querySelectorAll('[data-kick]').forEach((b) => (b.onclick = () => kick(b.dataset.kick)));
  dock.querySelectorAll('[data-stk]').forEach((b) => (b.onclick = () => sendChat('', b.dataset.stk)));
  q('[data-send]').onsubmit = (e) => {
    e.preventDefault();
    const i = q('[data-msg]');
    sendChat(i.value);
    i.value = '';
    renderDock();
    dock.querySelector('[data-msg]')?.focus();
  };
  if (party.isHost) {
    q('[data-pick]').onclick = () => openGamePicker();
    q('[data-start]').onclick = () => {
      try {
        startGame();
      } catch (e) {
        errToast(e);
      }
    };
  }
}

export function openPartyMenu() {
  if (api.MODE !== 'online') {
    modal(`<h3 class="m-title">PARTY</h3><p class="m-text">Online parties need online accounts. This browser is using this-device accounts.</p>`);
    return;
  }
  const m = modal(`<h3 class="m-title">PARTY UP</h3>
    <p class="m-text">Start a party and invite friends, or type a friend's party code.</p>
    <div class="party-menu">
      <button class="btn primary big" data-create>＋ CREATE A PARTY</button>
      <form class="join-row" data-join><input maxlength="5" placeholder="CODE" data-code autocomplete="off" style="text-transform:uppercase"><button class="btn">JOIN</button></form>
    </div>`);
  m.el.querySelector('[data-create]').onclick = async () => {
    try {
      await createParty();
      open = true;
      m.close();
      renderDock();
    } catch (e) {
      errToast(e);
    }
  };
  m.el.querySelector('[data-join]').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await joinParty(m.el.querySelector('[data-code]').value);
      open = true;
      m.close();
      renderDock();
    } catch (err) {
      errToast(err);
    }
  };
}

function openGamePicker() {
  const list = gamesFor({ mode: 'mp' }).filter((g) => g.modes.includes('online'));
  const m = modal(`<h3 class="m-title">PICK A PARTY GAME</h3>
    <div class="pick-grid">${list.map((g) => `<button class="gcard" data-g="${g.id}">${thumbHTML(g)}<span class="gcard-b"><b>${esc(g.title)}</b><small>${g.minPlayers || 2}-${g.maxPlayers || 8} players</small></span></button>`).join('') || '<div class="empty-sm">No online games yet.</div>'}</div>`, { wide: true });
  m.el.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => {
    try {
      pickGame(b.dataset.g);
      m.close();
      open = true;
      renderDock();
    } catch (e) {
      errToast(e);
    }
  }));
}

async function openInvite() {
  let fr;
  try {
    fr = await api.friendsData();
  } catch (e) {
    return errToast(e);
  }
  const on = onlineNow();
  const m = modal(`<h3 class="m-title">INVITE FRIENDS</h3>
    <p class="m-text">Or share the code <b class="pd-code">${esc(party.code)}</b>. They type it in PARTY ▸ JOIN.</p>
    <div class="inv-list">${fr.friends.map((f) => {
      const o = [...on.values()].find((x) => x.username === f.username);
      return `<div class="inv-row">${avatarHTML(f.equipped, 30)}<span class="inv-n">${callsignHTML(f.username, f.equipped, 'sm')}<small>${o ? '<b class="on-dot">●</b> ONLINE' : 'offline'} · LV ${levelInfo(f.xp).level}</small></span><button class="btn sm" data-inv="${esc(f.username)}" ${o ? '' : 'disabled'}>INVITE</button></div>`;
    }).join('') || '<div class="empty-sm">No friends yet. Add some in FRIENDS.</div>'}</div>`);
  m.el.querySelectorAll('[data-inv]').forEach((b) => (b.onclick = async () => {
    const o = [...on.values()].find((x) => x.username === b.dataset.inv);
    if (!o) return;
    b.disabled = true;
    try {
      await invite(o.id);
      b.textContent = 'SENT';
    } catch (e) {
      errToast(e);
      b.disabled = false;
    }
  }));
}

// buttons for the game details window
export function mpButtons(g) {
  const out = [];
  if (g.modes.includes('online')) {
    out.push(`<button class="btn primary big" data-party-play>👥 PLAY WITH PARTY</button>`);
    out.push(`<button class="btn big" data-quick>⚡ QUICK MATCH</button>`);
  }
  if (g.modes.includes('local')) out.push(`<button class="btn big" data-local>🎮 SAME SCREEN (2P)</button>`);
  return out.join('');
}
export function wireMpButtons(root, g, close) {
  const pp = root.querySelector('[data-party-play]');
  if (pp)
    pp.onclick = async () => {
      try {
        if (api.MODE !== 'online') return openPartyMenu();
        if (!party.code) await createParty();
        if (!party.isHost) return toast('Only the party leader picks the game', 'info');
        pickGame(g.id);
        open = true;
        close();
        renderDock();
        if (party.members.length < (g.minPlayers || 2)) toast('Invite friends (or share the code), then press START.', 'info', 3500);
      } catch (e) {
        errToast(e);
      }
    };
  const qm = root.querySelector('[data-quick]');
  if (qm)
    qm.onclick = async () => {
      try {
        if (api.MODE !== 'online') return openPartyMenu();
        const r = await quickMatch(g.id);
        open = true;
        close();
        renderDock();
        toast(r.joined ? 'Joined a public room - the leader starts when ready.' : 'Public room created. Others can join through QUICK MATCH.', 'info', 3500);
      } catch (e) {
        errToast(e);
      }
    };
  const lc = root.querySelector('[data-local]');
  if (lc)
    lc.onclick = () => {
      close();
      launch(g.id, { local: 2 });
    };
}

export const refreshDock = renderDock;
