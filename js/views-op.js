// OPERATOR console: unlocked by typing the secret code anywhere.
import { esc, num, levelInfo, timeAgo } from './util.js';
import { ALL_ITEMS, ITEM, RARITY, SLOT } from './cosmetics/catalog.js';
import { avatarHTML, callsignHTML, previewHTML } from './cosmetics/render.js';
import { api, store } from './store.js';
import { sfx } from './sfx.js';
import { modal, toast, errToast, confirmBox } from './ui.js';
import * as E from './economy.js';

async function run(fn, msg) {
  try {
    const u = await fn();
    if (u && u.username && u.id === store.me.id) store.set(u);
    else await store.refresh();
    sfx.ok();
    if (msg) toast(msg, 'ok');
    return true;
  } catch (e) {
    errToast(e);
    return false;
  }
}

// search box that picks an item key
function itemPicker(root, onPick) {
  const inp = root.querySelector('[data-pick]');
  const box = root.querySelector('[data-pick-list]');
  inp.oninput = () => {
    const q = inp.value.trim().toLowerCase();
    if (!q) return (box.innerHTML = '');
    const res = ALL_ITEMS.filter((i) => i.name.toLowerCase().includes(q) || i.key.includes(q)).slice(0, 24);
    box.innerHTML = res.map((i) => `<button class="pick" data-k="${i.key}" style="--r:${RARITY[i.rarity].color}"><span class="pick-prev">${previewHTML(i)}</span><b>${esc(i.name)}</b><small>${SLOT[i.slot].name} · ${RARITY[i.rarity].name}</small></button>`).join('') || '<div class="empty-sm">No items</div>';
    box.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => {
      onPick(b.dataset.k);
      box.innerHTML = '';
      inp.value = ITEM[b.dataset.k].name;
    }));
  };
}

export async function viewOperator(el) {
  const me = store.me;
  if (!me.operator) {
    el.innerHTML = `<section class="center-msg"><h1 class="h1">ACCESS DENIED</h1><p class="dim">Operators only.</p></section>`;
    return;
  }
  const players = await api.opPlayers();
  const log = await api.opLog();
  const events = api.eventsState(me);
  const rerender = () => viewOperator(el);

  el.innerHTML = `<section class="op">
    <div class="op-head"><div><div class="eyebrow op-eye">⛨ OPERATOR CONSOLE</div><h1 class="h1">CONTROL ROOM</h1></div>
      <button class="btn danger" data-leave>LEAVE OPERATOR MODE</button></div>
    <div class="op-grid">
      <div class="panel">
        <div class="panel-h">MYSELF</div>
        <div class="op-row"><span>Coins</span>${[1000, 10000, 100000].map((n) => `<button class="btn sm buy" data-mecoins="${n}">+${num(n)}</button>`).join('')}</div>
        <div class="op-row"><span>XP</span>${[500, 5000, 50000].map((n) => `<button class="btn sm ghost" data-mexp="${n}">+${num(n)}</button>`).join('')}</div>
        <div class="op-row"><span>Level</span><input type="number" min="1" max="200" value="${levelInfo(me.xp).level}" data-melv><button class="btn sm ghost" data-melvset>SET</button></div>
        <div class="op-row"><span>Pass tier</span><input type="number" min="0" max="${E.PASS_TIERS}" value="${api.passState(me).tier ?? 0}" data-metier><button class="btn sm ghost" data-metierset>SET</button><button class="btn sm ghost" data-meprem>${me.pass.premium ? 'REMOVE' : 'GIVE'} PREMIUM</button></div>
        <div class="op-row"><span>Cosmetics</span><button class="btn sm primary" data-meall>UNLOCK ALL ${num(ALL_ITEMS.length)}</button></div>
        <div class="op-row"><span>Reset</span>${[['daily', 'DAILY REWARD'], ['tasks', 'NEW TASKS'], ['complete', 'FINISH TASKS'], ['events', 'EVENT PROGRESS'], ['levelroad', 'LEVEL ROAD'], ['achievements', 'ACHIEVEMENTS']].map(([k, n]) => `<button class="btn sm ghost" data-mereset="${k}">${n}</button>`).join('')}</div>
      </div>
      <div class="panel">
        <div class="panel-h">GIFT TO EVERYONE (${players.length} players)</div>
        <div class="gift-form" data-giftall>
          <div class="op-row"><span>Coins</span><input type="number" min="0" value="0" data-gc></div>
          <div class="op-row"><span>XP</span><input type="number" min="0" value="0" data-gx></div>
          <div class="op-row"><span>Item</span><div class="pickwrap"><input data-pick placeholder="search any item..."><div class="pick-list" data-pick-list></div></div></div>
          <div class="op-row"><span>Message</span><input data-gm maxlength="140" placeholder="Thanks for playing!"></div>
          <button class="btn primary" data-gsend>SEND GIFT TO EVERYONE</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-h">PLAYERS <label class="search"><span>⌕</span><input data-pq placeholder="Find player"></label></div>
      <div class="op-players">${players.map((p) => `<div class="op-p" data-name="${esc(p.username.toLowerCase())}">
        ${avatarHTML(p.equipped, 36)}<span class="op-p-n">${callsignHTML(p.username, p.equipped, 'sm')}<small>LV ${levelInfo(p.xp).level} · ${num(p.coins)} coins · ${num(p.owned)} items · tier ${p.passTier}${p.premium ? '★' : ''} · seen ${timeAgo(p.lastSeen)}</small></span>
        ${p.operator ? '<span class="tag op-tag">OPERATOR</span>' : ''}${p.banned ? '<span class="tag ban-tag">BANNED</span>' : ''}
        <button class="btn sm ghost" data-manage="${esc(p.username)}">MANAGE</button></div>`).join('')}</div>
    </div>

    <div class="panel">
      <div class="panel-h">EVENTS</div>
      <div class="op-events">${events.map((ev) => `<div class="op-ev" style="--ev:${ev.color}"><b>${esc(ev.name)}</b><small>${ev.live ? '● LIVE' : 'off'}${ev.custom ? ' · custom' : ''}</small>
        <span class="seg">${['auto', 'on', 'off'].map((k) => `<button data-ev="${ev.id}" data-state="${k}">${k.toUpperCase()}</button>`).join('')}</span>
        ${ev.custom ? `<button class="btn sm danger" data-evdel="${ev.id}">REMOVE</button>` : ''}</div>`).join('')}</div>
      <div class="panel-h">CREATE A CUSTOM EVENT</div>
      <div class="op-form" data-evform>
        <label class="fld"><span>NAME</span><input data-f="name" maxlength="32" placeholder="DOUBLE COINS WEEKEND"></label>
        <label class="fld"><span>TAGLINE</span><input data-f="tagline" maxlength="120" placeholder="Everything is cheaper, go go go"></label>
        <div class="op-form-row">
          <label class="fld"><span>DAYS</span><input type="number" data-f="days" value="3" min="1" max="60"></label>
          <label class="fld"><span>SHOP DISCOUNT %</span><input type="number" data-f="discount" value="20" min="0" max="90"></label>
          <label class="fld"><span>COIN BOOST ×</span><input type="number" data-f="boost" value="2" min="1" max="5" step="0.5"></label>
          <label class="fld"><span>FREE GIFT (COINS)</span><input type="number" data-f="gift" value="500" min="0"></label>
          <label class="fld"><span>COLOR</span><input type="color" data-f="color" value="#ff2bd6"></label>
          <label class="fld"><span>ICONS</span><input data-f="decor" value="✦★✧" maxlength="6"></label>
        </div>
        <button class="btn primary" data-evcreate>START EVENT NOW</button>
      </div>
    </div>

    <div class="panel"><div class="panel-h">OPERATOR LOG</div>
      <div class="op-log">${log.map((l) => `<div><small>${new Date(l.ts).toLocaleString()}</small> <b>${esc(l.by)}</b> ${esc(l.msg)}</div>`).join('') || '<div class="empty-sm">Nothing yet.</div>'}</div></div>
  </section>`;

  const q = (s) => el.querySelector(s);
  const all = (s, fn) => el.querySelectorAll(s).forEach((b) => (b.onclick = () => fn(b)));
  q('[data-leave]').onclick = async () => (await confirmBox('LEAVE OPERATOR MODE', 'Turn operator mode off for this account? Type the code again to come back.', { ok: 'LEAVE' })) && (await run(() => api.opLeave(), 'Operator mode off')) && (location.hash = '/');
  all('[data-mecoins]', async (b) => (await run(() => api.opCoins(me.username, b.dataset.mecoins), `+${num(b.dataset.mecoins)} coins`)) && rerender());
  all('[data-mexp]', async (b) => (await run(() => api.opXp(me.username, b.dataset.mexp), `+${num(b.dataset.mexp)} XP`)) && rerender());
  q('[data-melvset]').onclick = async () => (await run(() => api.opSetLevel(me.username, q('[data-melv]').value), 'Level set')) && rerender();
  q('[data-metierset]').onclick = async () => (await run(() => api.opPass(me.username, { tier: q('[data-metier]').value }), 'Pass tier set')) && rerender();
  q('[data-meprem]').onclick = async () => (await run(() => api.opPass(me.username, { premium: !store.me.pass.premium }), 'Premium changed')) && rerender();
  q('[data-meall]').onclick = async () => (await run(() => api.opUnlockAll(me.username), `All ${num(ALL_ITEMS.length)} cosmetics unlocked`)) && rerender();
  all('[data-mereset]', async (b) => (await run(() => api.opReset(me.username, b.dataset.mereset), 'Done')) && rerender());

  let giftItem = null;
  itemPicker(q('[data-giftall]'), (k) => (giftItem = k));
  q('[data-gsend]').onclick = async () => {
    if (!(await confirmBox('GIFT EVERYONE', `Send this gift to all ${players.length} players?`, { ok: 'SEND' }))) return;
    (await run(() => api.opGift('*', { coins: q('[data-gc]').value, xp: q('[data-gx]').value, items: giftItem ? [giftItem] : [], msg: q('[data-gm]').value }), 'Gift sent to everyone')) && rerender();
  };

  q('[data-pq]').oninput = (e) => el.querySelectorAll('.op-p').forEach((r) => (r.hidden = !r.dataset.name.includes(e.target.value.toLowerCase())));
  all('[data-manage]', (b) => managePlayer(b.dataset.manage, rerender));

  all('[data-ev]', async (b) => (await run(() => api.opEventOverride(b.dataset.ev, b.dataset.state), `Event set to ${b.dataset.state}`)) && rerender());
  all('[data-evdel]', async (b) => (await run(() => api.opEndCustomEvent(b.dataset.evdel), 'Event removed')) && rerender());
  q('[data-evcreate]').onclick = async () => {
    const f = Object.fromEntries([...el.querySelectorAll('[data-f]')].map((i) => [i.dataset.f, i.value]));
    (await run(() => api.opCreateEvent(f), `Event ${esc(f.name)} is live`)) && rerender();
  };
}

function managePlayer(name, after) {
  const m = modal(`<h3 class="m-title">MANAGE ${esc(name)}</h3>
    <div class="op-row"><span>Coins</span><input type="number" value="1000" data-c><button class="btn sm buy" data-give-c>GIVE</button><button class="btn sm ghost" data-take-c>TAKE</button></div>
    <div class="op-row"><span>XP</span><input type="number" value="1000" data-x><button class="btn sm ghost" data-give-x>GIVE</button></div>
    <div class="op-row"><span>Level</span><input type="number" value="10" min="1" max="200" data-l><button class="btn sm ghost" data-set-l>SET</button></div>
    <div class="op-row"><span>Item</span><div class="pickwrap"><input data-pick placeholder="search any item..."><div class="pick-list" data-pick-list></div></div><button class="btn sm primary" data-give-i>GIVE</button><button class="btn sm ghost" data-take-i>REMOVE</button></div>
    <div class="op-row"><span>Gift</span><input data-gmsg maxlength="140" placeholder="message with the coins/item above"><button class="btn sm primary" data-gift>SEND AS GIFT</button></div>
    <div class="op-row"><span>Pass</span><input type="number" value="10" min="0" max="${E.PASS_TIERS}" data-t><button class="btn sm ghost" data-set-t>SET TIER</button><button class="btn sm ghost" data-prem-on>GIVE PREMIUM</button><button class="btn sm ghost" data-prem-off>REMOVE PREMIUM</button></div>
    <div class="op-row"><span>Unlock</span><button class="btn sm primary" data-all>UNLOCK EVERYTHING</button></div>
    <div class="op-row"><span>Reset</span>${['daily', 'tasks', 'complete', 'events', 'levelroad', 'achievements'].map((k) => `<button class="btn sm ghost" data-reset="${k}">${k.toUpperCase()}</button>`).join('')}</div>
    <div class="op-row"><span>Roles</span><button class="btn sm ghost" data-op-on>MAKE OPERATOR</button><button class="btn sm ghost" data-op-off>REMOVE OPERATOR</button><button class="btn sm danger" data-ban>BAN</button><button class="btn sm ghost" data-unban>UNBAN</button><button class="btn sm danger" data-del>DELETE</button></div>
    <div class="m-actions"><a class="btn ghost" href="#/profile/${esc(name)}">VIEW PROFILE</a><button class="btn primary" data-close>DONE</button></div>`, { wide: true, onClose: after });
  const q = (s) => m.el.querySelector(s);
  let item = null;
  itemPicker(m.el, (k) => (item = k));
  const on = (s, fn, msg) => (q(s).onclick = () => run(fn, msg));
  on('[data-give-c]', () => api.opCoins(name, Math.abs(q('[data-c]').value)), 'Coins given');
  on('[data-take-c]', () => api.opCoins(name, -Math.abs(q('[data-c]').value)), 'Coins taken');
  on('[data-give-x]', () => api.opXp(name, q('[data-x]').value), 'XP given');
  on('[data-set-l]', () => api.opSetLevel(name, q('[data-l]').value), 'Level set');
  q('[data-give-i]').onclick = () => (item ? run(() => api.opItem(name, item, true), 'Item given') : errToast(new Error('Pick an item first')));
  q('[data-take-i]').onclick = () => (item ? run(() => api.opItem(name, item, false), 'Item removed') : errToast(new Error('Pick an item first')));
  on('[data-gift]', () => api.opGift(name, { coins: q('[data-c]').value, items: item ? [item] : [], msg: q('[data-gmsg]').value }), 'Gift sent');
  on('[data-set-t]', () => api.opPass(name, { tier: q('[data-t]').value }), 'Tier set');
  on('[data-prem-on]', () => api.opPass(name, { premium: true }), 'Premium given');
  on('[data-prem-off]', () => api.opPass(name, { premium: false }), 'Premium removed');
  on('[data-all]', () => api.opUnlockAll(name), 'Everything unlocked');
  m.el.querySelectorAll('[data-reset]').forEach((b) => (b.onclick = () => run(() => api.opReset(name, b.dataset.reset), 'Done')));
  on('[data-op-on]', () => api.opSetFlag(name, 'operator', true), 'Now an operator');
  on('[data-op-off]', () => api.opSetFlag(name, 'operator', false), 'Operator removed');
  on('[data-ban]', () => api.opSetFlag(name, 'banned', true), 'Banned');
  on('[data-unban]', () => api.opSetFlag(name, 'banned', false), 'Unbanned');
  q('[data-del]').onclick = async () => {
    m.close();
    if (await confirmBox('DELETE PLAYER', `Delete <b>${esc(name)}</b> forever?`, { ok: 'DELETE', danger: true })) (await run(() => api.opDelete(name), 'Player deleted')) && after();
  };
}
