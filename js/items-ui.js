// Shared cosmetic UI: item cards, item detail modal, buy/equip actions, reward lists.
import { esc, num } from './util.js';
import { ITEM, SLOT, RARITY } from './cosmetics/catalog.js';
import { SEASONS, EVENTS } from './cosmetics/seasons.js';
import { ACH } from './cosmetics/achievements.js';
import { previewHTML, avatarHTML, callsignHTML, titleHTML, bannerHTML, badgeHTML, stickerHTML, eqOf } from './cosmetics/render.js';
import { api, store } from './store.js';
import { modal, toast, errToast, confirmBox } from './ui.js';
import { sfx } from './sfx.js';
import { CRATE } from './economy.js';

export function sourceLabel(it) {
  switch (it.src) {
    case 'default': return 'STARTER ITEM';
    case 'shop': return 'ITEM SHOP';
    case 'pass': return `BATTLE PASS · SEASON ${SEASONS.find((s) => s.id === it.srcId)?.num ?? ''}`;
    case 'event': return `EVENT SHOP · ${EVENTS.find((e) => e.id === it.srcId)?.name ?? ''}`;
    case 'eventReward': return `EVENT CHALLENGE · ${EVENTS.find((e) => e.id === it.srcId)?.name ?? ''}`;
    case 'level': return 'LEVEL ROAD';
    case 'crate': return 'CRATES ONLY';
    case 'achievement': return `ACHIEVEMENT · ${ACH[it.srcId]?.name ?? ''}`;
    case 'operator': return 'OPERATOR ONLY';
  }
  return '';
}

export function isEquipped(me, it) {
  const v = me.equipped[it.slot];
  return Array.isArray(v) ? v.includes(it.id) : v === it.id;
}

// The buy / equip / "how to get" control for one item.
export function actionHTML(it, me) {
  const owned = me.owned.includes(it.key);
  const eq = owned && isEquipped(me, it);
  if (eq) return SLOT[it.slot].multi ? `<button class="btn sm ghost" data-equip="${it.key}">REMOVE</button>` : `<button class="btn sm ghost" disabled>EQUIPPED</button>`;
  if (owned) return `<button class="btn sm primary" data-equip="${it.key}">${SLOT[it.slot].multi ? 'PIN' : 'EQUIP'}</button>`;
  const p = api.price(it.key);
  return p
    ? `<button class="btn sm buy" data-buy="${it.key}" ${me.coins < p.price ? 'data-poor' : ''}><i class="coin"></i>${num(p.price)}${p.off ? `<s>${num(p.base)}</s>` : ''}</button>`
    : `<span class="si-src">${esc(sourceLabel(it))}</span>`;
}

// mode: 'shop' | 'locker' (locker greys out items you don't own)
export function itemCard(it, me, mode = 'shop') {
  const owned = me.owned.includes(it.key);
  const eq = owned && isEquipped(me, it);
  const r = RARITY[it.rarity];
  return `<div class="shop-item r-${it.rarity} ${eq ? 'eq' : ''} ${!owned && mode === 'locker' ? 'locked' : ''}" data-key="${it.key}" style="--r:${r.color}" tabindex="0">
    <div class="si-prev">${previewHTML(it)}</div>
    <div class="si-name">${esc(it.name)}</div>
    <div class="si-r">${r.name}</div>
    ${actionHTML(it, me)}
  </div>`;
}

// Wire buttons inside a container. after() re-renders.
export function bindItems(root, after) {
  root.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = (e) => (e.stopPropagation(), buyFlow(b.dataset.buy, after))));
  root.querySelectorAll('[data-equip]').forEach((b) => (b.onclick = (e) => (e.stopPropagation(), equipFlow(b.dataset.equip, after))));
  root.querySelectorAll('.shop-item').forEach((c) => {
    c.onclick = (e) => {
      if (e.target.closest('button, [data-click-demo], [data-sound-demo]')) return;
      sfx.click();
      itemModal(c.dataset.key, after);
    };
    c.onkeydown = (e) => e.key === 'Enter' && c.click();
  });
}

export async function buyFlow(key, after) {
  const it = ITEM[key];
  const me = store.me;
  const p = api.price(key);
  if (!p) return errToast(new Error('This item is not for sale right now'));
  if (me.coins < p.price) return errToast(new Error(`Not enough coins. You need ${num(p.price - me.coins)} more.`));
  if (!(await confirmBox('BUY ITEM', `Buy <b>${esc(it.name)}</b> (${RARITY[it.rarity].name}) for <b>${num(p.price)}</b> coins?`, { ok: 'BUY' }))) return;
  try {
    store.set(await api.buy(key));
    sfx.coin();
    toast(`Bought <b>${esc(it.name)}</b>`, 'ok');
    if (await confirmBox('EQUIP NOW?', `Use <b>${esc(it.name)}</b> now?`, { ok: SLOT[it.slot].multi ? 'PIN IT' : 'EQUIP' })) await equipFlow(key);
  } catch (e) {
    errToast(e);
  }
  after?.();
}

export async function equipFlow(key, after) {
  const it = ITEM[key];
  try {
    store.set(await api.equip(it.slot, it.id));
    sfx.click();
  } catch (e) {
    errToast(e);
  }
  after?.();
}

// Full player card (banner, avatar+pet, callsign, title, badges, stickers) for previews.
export function playerCard(name, eq, extra = '') {
  eq = eqOf(eq);
  return `<div class="pcard">
    ${bannerHTML(eq, 'pcard-banner')}
    <div class="pcard-av">${avatarHTML(eq, 92, '', true)}</div>
    <div class="pcard-name">${callsignHTML(name, eq, 'lg')}</div>
    <div class="pcard-title">${titleHTML(eq) || '<span class="dim small">no title</span>'}</div>
    <div class="pcard-row">${eq.badge.map((b) => badgeHTML(b, 30)).join('')}${eq.sticker.map((s) => stickerHTML(s, 34)).join('')}</div>
    ${extra}
  </div>`;
}

export function itemModal(key, after) {
  const it = ITEM[key];
  const me = store.me;
  const owned = me.owned.includes(key);
  const eq = owned && isEquipped(me, it);
  const r = RARITY[it.rarity];
  const p = !owned && api.price(key);
  const tryEq = { ...me.equipped };
  if (SLOT[it.slot].multi) tryEq[it.slot] = [it.id, ...me.equipped[it.slot].filter((x) => x !== it.id)].slice(0, 3);
  else tryEq[it.slot] = it.id;
  const m = modal(`
    <div class="im">
      <div class="im-prev r-${it.rarity}" style="--r:${r.color}"><div class="im-big">${previewHTML(it)}</div></div>
      <div class="im-body">
        <div class="si-r" style="--r:${r.color}">${r.name} · ${SLOT[it.slot].name}</div>
        <h2 class="gd-t">${esc(it.name)}</h2>
        <div class="im-src">${esc(sourceLabel(it))}</div>
        <div class="im-try"><div class="panel-h">ON YOU</div>${playerCard(me.username, tryEq)}</div>
        <div class="m-actions">
          ${eq ? (SLOT[it.slot].multi ? `<button class="btn ghost" data-eq>REMOVE</button>` : `<button class="btn ghost" disabled>EQUIPPED</button>`)
            : owned ? `<button class="btn primary" data-eq>${SLOT[it.slot].multi ? 'PIN TO PROFILE' : 'EQUIP'}</button>`
            : p ? `<button class="btn buy big" data-buy-m ${me.coins < p.price ? 'data-poor' : ''}><i class="coin"></i>${num(p.price)}${p.off ? ` <s>${num(p.base)}</s> -${Math.round(p.off * 100)}%` : ''}</button>`
            : `<span class="tag">${esc(howToGet(it))}</span>`}
        </div>
      </div>
    </div>`, { wide: true });
  const b1 = m.el.querySelector('[data-eq]');
  if (b1) b1.onclick = async () => (m.close(), equipFlow(key, after));
  const b2 = m.el.querySelector('[data-buy-m]');
  if (b2) b2.onclick = async () => (m.close(), buyFlow(key, after));
}

function howToGet(it) {
  return {
    pass: 'Unlock it on the Battle Pass',
    event: 'Sold only while its event is live',
    eventReward: 'Finish an event challenge',
    level: 'Reach the level on the Level Road',
    crate: 'Only from crates',
    achievement: 'Unlock the achievement',
    operator: 'Operators only',
  }[it.src] || 'Not for sale';
}

// "+50 coins · Neon Visor · Basic Crate" for pass / level road / challenge rewards
export function rewardChips(list) {
  return list.map((r) => {
    if (r.coins) return `<span class="rchip"><i class="coin"></i>${num(r.coins)}</span>`;
    if (r.crate) return `<span class="rchip crate" style="--r:${CRATE[r.crate].color}">📦 ${CRATE[r.crate].name}</span>`;
    if (r.item) {
      const it = ITEM[r.item];
      return `<span class="rchip item" data-key="${it.key}" style="--r:${RARITY[it.rarity].color}"><span class="rchip-prev">${previewHTML(it)}</span>${esc(it.name)}</span>`;
    }
    return '';
  }).join('');
}
export function bindRewardChips(root, after) {
  root.querySelectorAll('.rchip.item').forEach((c) => (c.onclick = (e) => (e.stopPropagation(), itemModal(c.dataset.key, after))));
}
