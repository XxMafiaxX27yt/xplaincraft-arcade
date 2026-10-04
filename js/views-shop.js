// SHOP (featured, crates, browse) and LOCKER (everything you own, equip, collection book).
import { esc, num, fmtClock, msUntilMidnight } from './util.js';
import { ALL_ITEMS, ITEM, SLOTS, SLOT, RARITIES, RARITY, BY_SLOT } from './cosmetics/catalog.js';
import { previewHTML } from './cosmetics/render.js';
import { api, store } from './store.js';
import { sfx } from './sfx.js';
import { modal, errToast } from './ui.js';
import { itemCard, bindItems, playerCard, itemModal, actionHTML } from './items-ui.js';
import * as E from './economy.js';

const PAGE = 60;
const browse = { slot: 'all', rarity: 'all', q: '', sort: 'rarity', hideOwned: false, n: PAGE };
const locker = { show: 'owned', rarity: 'all', q: '', n: PAGE };
const ORDER = RARITIES.map((r) => r.id);

function filters(state, slots, extra = '') {
  return `<div class="filters">
    <label class="search"><span>⌕</span><input data-q placeholder="Search items" value="${esc(state.q)}"></label>
    <select data-rarity><option value="all">All rarities</option>${RARITIES.map((r) => `<option value="${r.id}" ${state.rarity === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}</select>
    ${slots ? `<select data-slot><option value="all">All types</option>${SLOTS.filter((s) => s.id !== 'badge').map((s) => `<option value="${s.id}" ${state.slot === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select>` : ''}
    ${extra}
  </div>`;
}
function wireFilters(el, state, rerender) {
  const q = el.querySelector('[data-q]');
  let t;
  q.oninput = () => {
    clearTimeout(t);
    t = setTimeout(() => ((state.q = q.value), (state.n = PAGE), rerender(true)), 180);
  };
  el.querySelector('[data-rarity]').onchange = (e) => ((state.rarity = e.target.value), (state.n = PAGE), rerender());
  const s = el.querySelector('[data-slot]');
  if (s) s.onchange = (e) => ((state.slot = e.target.value), (state.n = PAGE), rerender());
}
function grid(list, me, mode, state) {
  const shown = list.slice(0, state.n);
  return `<div class="shop-grid">${shown.map((it) => itemCard(it, me, mode)).join('') || '<div class="empty-sm">No items match.</div>'}</div>
    ${list.length > state.n ? `<div class="more"><button class="btn ghost" data-more>SHOW MORE (${num(list.length - state.n)} left)</button></div>` : ''}`;
}

// ======================= SHOP =======================
export async function viewShop(el, tab = 'featured') {
  if (!['featured', 'crates', 'browse'].includes(tab)) tab = 'featured';
  const me = store.me;
  const head = `<div class="shop-head"><h1 class="h1">ITEM SHOP</h1><div class="tb-coins big"><i class="coin"></i>${num(me.coins)}</div></div>
    <div class="tabs"><a href="#/shop" class="${tab === 'featured' ? 'on' : ''}">★ FEATURED</a><a href="#/shop/crates" class="${tab === 'crates' ? 'on' : ''}">📦 CRATES</a><a href="#/shop/browse" class="${tab === 'browse' ? 'on' : ''}">ALL ITEMS</a><a href="#/locker">MY LOCKER ▸</a></div>`;
  const rerender = (keepFocus) => {
    const pos = keepFocus && el.querySelector('[data-q]')?.selectionStart;
    viewShop(el, tab);
    if (keepFocus) {
      const q = el.querySelector('[data-q]');
      q.focus();
      q.setSelectionRange(pos, pos);
    }
  };

  if (tab === 'featured') {
    const f = E.featured();
    const deal = ITEM[f[0].key];
    const live = api.liveEventsNow();
    el.innerHTML = `<section class="shop">${head}
      <div class="feat-top">
        <div class="deal panel r-${deal.rarity}" style="--r:${RARITY[deal.rarity].color}" data-key="${deal.key}">
          <div class="deal-tag">DEAL OF THE DAY · -50%</div>
          <div class="deal-prev">${previewHTML(deal)}</div>
          <div class="deal-b"><div class="si-r">${RARITY[deal.rarity].name}</div><h2 class="gd-t">${esc(deal.name)}</h2>
          <div class="deal-a" data-deal></div></div>
        </div>
        <div class="panel feat-side">
          <div class="panel-h">NEW ITEMS IN <b data-cd>${fmtClock(msUntilMidnight())}</b></div>
          <p class="dim">Featured items are 25% off today. ${live.length ? 'Live events: ' + live.map((e) => `<a href="#/events/${e.id}">${esc(e.name)}</a>`).join(', ') : ''}</p>
          <a class="btn primary" href="#/shop/crates">📦 OPEN A CRATE</a>
          <a class="btn ghost" href="#/pass">🎟️ BATTLE PASS</a>
        </div>
      </div>
      <div class="panel-h">FEATURED TODAY · 25% OFF</div>
      <div class="shop-grid" data-grid>${f.slice(1).map((x) => itemCard(ITEM[x.key], me)).join('')}</div>
    </section>`;
    const d = el.querySelector('[data-deal]');
    d.innerHTML = actionHTML(deal, me);
    bindItems(el, rerender);
    el.querySelector('.deal').onclick = (e) => !e.target.closest('button') && itemModal(deal.key, rerender);
    const cd = el.querySelector('[data-cd]');
    const t = setInterval(() => (document.contains(cd) ? (cd.textContent = fmtClock(msUntilMidnight())) : clearInterval(t)), 1000);
    return;
  }

  if (tab === 'crates') {
    el.innerHTML = `<section class="shop">${head}
      <p class="dim">Every crate gives one random cosmetic. Some items only come from crates. Duplicates turn into ${Math.round(E.DUP_REFUND * 100)}% of the item's value in coins.</p>
      <div class="crates">${E.CRATES.map((c) => `<div class="crate panel" style="--r:${c.color}">
        <div class="crate-box"><span>📦</span></div>
        <h3>${c.name}</h3>
        <div class="odds">${E.crateOdds(c.id).map((o) => `<span style="--r:${RARITY[o.rarity].color}"><b>${RARITY[o.rarity].name}</b>${o.pct.toFixed(o.pct < 1 ? 1 : 0)}%</span>`).join('')}</div>
        <button class="btn buy big" data-crate="${c.id}" ${me.coins < c.price ? 'data-poor' : ''}><i class="coin"></i>${num(c.price)} · OPEN</button>
      </div>`).join('')}</div>
    </section>`;
    el.querySelectorAll('[data-crate]').forEach((b) => (b.onclick = () => openCrateFlow(b.dataset.crate, rerender)));
    return;
  }

  // browse
  let list = ALL_ITEMS.filter((i) => i.src === 'shop');
  if (browse.slot !== 'all') list = list.filter((i) => i.slot === browse.slot);
  if (browse.rarity !== 'all') list = list.filter((i) => i.rarity === browse.rarity);
  if (browse.hideOwned) list = list.filter((i) => !me.owned.includes(i.key));
  if (browse.q) list = list.filter((i) => i.name.toLowerCase().includes(browse.q.toLowerCase()));
  const sorts = {
    rarity: (a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name),
    priceUp: (a, b) => a.value - b.value,
    priceDown: (a, b) => b.value - a.value,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  list.sort(sorts[browse.sort]);
  el.innerHTML = `<section class="shop">${head}
    ${filters(browse, true, `<select data-sort>${[['rarity', 'Sort: rarity'], ['priceUp', 'Price: low → high'], ['priceDown', 'Price: high → low'], ['name', 'Name A-Z']].map(([v, n]) => `<option value="${v}" ${browse.sort === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <label class="tgl small"><input type="checkbox" data-hide ${browse.hideOwned ? 'checked' : ''}><span></span>Hide owned</label>`)}
    <div class="dim small count">${num(list.length)} items</div>
    ${grid(list, me, 'shop', browse)}
  </section>`;
  wireFilters(el, browse, rerender);
  el.querySelector('[data-sort]').onchange = (e) => ((browse.sort = e.target.value), rerender());
  el.querySelector('[data-hide]').onchange = (e) => ((browse.hideOwned = e.target.checked), (browse.n = PAGE), rerender());
  const more = el.querySelector('[data-more]');
  if (more) more.onclick = () => ((browse.n += PAGE), rerender());
  bindItems(el, rerender);
}

// crate opening with a spinning reel
async function openCrateFlow(id, after) {
  const c = E.CRATE[id];
  const me = store.me;
  if (me.coins < c.price) return errToast(new Error(`Not enough coins. You need ${num(c.price - me.coins)} more.`));
  let r;
  try {
    r = await api.openCrate(id);
  } catch (e) {
    return errToast(e);
  }
  store.set(r.me);
  const won = ITEM[r.key];
  const reel = [];
  for (let i = 0; i < 44; i++) reel.push(i === 38 ? won : E.rollCrate(id));
  const m = modal(`<h3 class="m-title">${c.name}</h3>
    <div class="reel-wrap"><div class="reel-mark"></div><div class="reel">${reel.map((it) => `<div class="reel-item" style="--r:${RARITY[it.rarity].color}">${previewHTML(it)}</div>`).join('')}</div></div>
    <div class="reel-result" hidden></div>`, { wide: true, onClose: after });
  const strip = m.el.querySelector('.reel');
  const W = 132;
  const target = 38 * W - (m.el.querySelector('.reel-wrap').clientWidth / 2 - W / 2) + Math.random() * 60 - 30;
  strip.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-target}px)` }], { duration: 4200, easing: 'cubic-bezier(.12,.75,.16,1)', fill: 'forwards' });
  let last = -1;
  const t0 = performance.now();
  const tick = () => {
    const tr = getComputedStyle(strip).transform;
    const x = tr && tr !== 'none' ? -new DOMMatrix(tr).m41 : 0;
    const idx = Math.floor(x / W);
    if (idx !== last) {
      last = idx;
      sfx.reel();
    }
    if (performance.now() - t0 < 4200) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(() => {
    const res = m.el.querySelector('.reel-result');
    res.hidden = false;
    res.innerHTML = `<div class="win r-${won.rarity}" style="--r:${RARITY[won.rarity].color}">
      <div class="win-r">${RARITY[won.rarity].name}${r.isNew ? ' · NEW!' : ' · DUPLICATE'}</div>
      <div class="win-n">${esc(won.name)}</div>
      <div class="dim">${SLOT[won.slot].name}${r.refund ? ` · you already had it: +${num(r.refund)} coins` : ''}</div>
      <div class="m-actions"><button class="btn ghost" data-close2>CLOSE</button>${r.isNew ? '<button class="btn primary" data-view>VIEW ITEM</button>' : ''}<button class="btn buy" data-again ${store.me.coins < c.price ? 'data-poor' : ''}><i class="coin"></i>${num(c.price)} · AGAIN</button></div></div>`;
    sfx.rare(ORDER.indexOf(won.rarity));
    res.querySelector('[data-close2]').onclick = () => m.close();
    const v = res.querySelector('[data-view]');
    if (v) v.onclick = () => (m.close(), itemModal(won.key, after));
    res.querySelector('[data-again]').onclick = () => (m.close(), setTimeout(() => openCrateFlow(id, after), 280));
  }, 4300);
}

// ======================= LOCKER =======================
export async function viewLocker(el, slot = 'skin') {
  if (!SLOT[slot]) slot = 'skin';
  const me = store.me;
  const all = BY_SLOT[slot];
  let list = all.filter((i) => locker.show === 'all' || me.owned.includes(i.key));
  if (locker.rarity !== 'all') list = list.filter((i) => i.rarity === locker.rarity);
  if (locker.q) list = list.filter((i) => i.name.toLowerCase().includes(locker.q.toLowerCase()));
  list.sort((a, b) => (me.owned.includes(b.key) - me.owned.includes(a.key)) || ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity));
  const ownedCount = all.filter((i) => me.owned.includes(i.key)).length;
  const totalOwned = me.owned.length;
  const rerender = (keepFocus) => {
    const pos = keepFocus && el.querySelector('[data-q]')?.selectionStart;
    viewLocker(el, slot);
    if (keepFocus) {
      const q = el.querySelector('[data-q]');
      q.focus();
      q.setSelectionRange(pos, pos);
    }
  };
  el.innerHTML = `<section class="shop">
    <div class="shop-head"><h1 class="h1">LOCKER</h1><div class="dim">You own <b>${num(totalOwned)}</b> / ${num(ALL_ITEMS.length)} cosmetics</div></div>
    <div class="shop-layout">
      <aside class="shop-preview panel"><div class="panel-h">YOU</div>${playerCard(me.username, me.equipped)}
        <div class="sp-cursor">Cursor + click test area</div>
        <a class="btn ghost" href="#/profile">VIEW PROFILE</a></aside>
      <div>
        <div class="tabs slot-tabs">${SLOTS.map((s) => `<a href="#/locker/${s.id}" class="${s.id === slot ? 'on' : ''}">${s.name}</a>`).join('')}</div>
        ${filters(locker, false, `<span class="seg">${[['owned', 'OWNED'], ['all', 'ALL (HOW TO GET)']].map(([k, n]) => `<button class="${locker.show === k ? 'on' : ''}" data-show="${k}">${n}</button>`).join('')}</span>`)}
        <div class="dim small count">${SLOT[slot].hint} · you own ${ownedCount}/${all.length}${SLOT[slot].multi ? ` · showing ${me.equipped[slot].length}/${SLOT[slot].multi}` : ''}</div>
        ${grid(list, me, 'locker', locker)}
      </div>
    </div>
  </section>`;
  wireFilters(el, locker, rerender);
  el.querySelectorAll('[data-show]').forEach((b) => (b.onclick = () => ((locker.show = b.dataset.show), (locker.n = PAGE), rerender())));
  const more = el.querySelector('[data-more]');
  if (more) more.onclick = () => ((locker.n += PAGE), rerender());
  bindItems(el, rerender);
}
