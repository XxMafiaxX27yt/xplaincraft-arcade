// BATTLE PASS and EVENTS pages.
import { esc, num, fmtDate } from './util.js';
import { ITEM, RARITY } from './cosmetics/catalog.js';
import { previewHTML } from './cosmetics/render.js';
import { api, store } from './store.js';
import { sfx } from './sfx.js';
import { toast, errToast, rewardPopup, confirmBox } from './ui.js';
import { itemCard, bindItems, rewardChips, bindRewardChips, itemModal } from './items-ui.js';
import * as E from './economy.js';

function left(ts) {
  const ms = ts - Date.now();
  if (ms <= 0) return 'ended';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d ? `${d}d ${h}h` : `${h}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

// ======================= BATTLE PASS =======================
export async function viewPass(el) {
  const me = store.me;
  const st = api.passState(me);
  const rerender = () => viewPass(el);
  if (!st.season) {
    el.innerHTML = `<section class="center-msg"><h1 class="h1">BATTLE PASS</h1><p class="dim">No season is running right now.</p>
      ${st.next ? `<p>Next: <b>SEASON ${st.next.num} · ${esc(st.next.name)}</b> starts ${fmtDate(new Date(st.next.start + 'T00:00:00').getTime())}</p>` : ''}</section>`;
    return;
  }
  const s = st.season;
  const endTs = new Date(s.end + 'T23:59:59').getTime();
  const into = st.xp % st.perTier;
  const maxed = st.tier >= E.PASS_TIERS;
  const cell = (t, track) => {
    const rw = st.track[t - 1][track];
    const got = (track === 'free' ? st.free : st.prem).includes(t);
    const reached = st.tier >= t;
    const locked = track === 'premium' && !st.premium;
    const main = rw.find((r) => r.item) || rw[0];
    const it = main.item && ITEM[main.item];
    return `<div class="pt-cell ${track} ${got ? 'got' : ''} ${reached ? 'reached' : ''} ${locked ? 'locked' : ''}" ${it ? `style="--r:${RARITY[it.rarity].color}"` : ''}>
      <div class="pt-prev" ${it ? `data-key="${it.key}"` : ''}>${it ? previewHTML(it) : main.crate ? `<span class="pt-ico">📦</span>` : `<span class="pt-ico"><i class="coin"></i></span>`}</div>
      <div class="pt-name">${it ? esc(it.name) : main.crate ? E.CRATE[main.crate].name : num(main.coins) + ' coins'}${rw.length > 1 ? ` <small>+${rw.length - 1}</small>` : ''}</div>
      ${got ? '<span class="pt-done">✓</span>' : reached && !locked ? `<button class="btn sm primary" data-claim="${t}" data-track="${track}">CLAIM</button>` : locked ? '<span class="pt-lock">🔒</span>' : ''}
    </div>`;
  };
  el.innerHTML = `<section class="pass">
    <div class="pass-hero">
      <div><div class="eyebrow">SEASON ${s.num} · ENDS IN ${left(endTs)}</div>
        <h1 class="h1 pass-name">${esc(s.name)}</h1><p class="dim">${esc(s.tagline)}</p></div>
      <div class="pass-tier"><span>TIER</span><b>${st.tier}</b><small>/ ${E.PASS_TIERS}</small></div>
    </div>
    <div class="panel pass-bar">
      <div class="pb-xp"><span class="xpbar big"><i style="width:${maxed ? 100 : ((into / st.perTier) * 100).toFixed(1)}%"></i></span>
        <small>${maxed ? 'MAX TIER' : `${num(into)} / ${st.perTier} pass XP to tier ${st.tier + 1}`} · every XP you earn fills the pass, +${api.DAILY_PASS_XP} for the daily reward</small></div>
      <div class="pb-actions">
        ${st.premium ? '<span class="tag ok">★ PREMIUM ACTIVE</span>' : `<button class="btn buy" data-premium ${me.coins < s.premium ? 'data-poor' : ''}>★ UNLOCK PREMIUM · <i class="coin"></i>${num(s.premium)}</button>`}
        <button class="btn primary" data-all>CLAIM ALL</button>
      </div>
    </div>
    <div class="pt-legend"><span>FREE</span><span class="prem">PREMIUM ★</span></div>
    <div class="pass-track" data-track-scroll>
      ${st.track.map((tr) => `<div class="pt-col ${st.tier >= tr.tier ? 'reached' : ''} ${st.tier + 1 === tr.tier ? 'next' : ''}">
        <div class="pt-num">${tr.tier}</div>${cell(tr.tier, 'free')}${cell(tr.tier, 'premium')}</div>`).join('')}
    </div>
    <div class="panel"><div class="panel-h">SEASONS</div>
      <div class="seasons">${E.SEASONS.map((x) => `<div class="season ${x.id === s.id ? 'on' : ''}"><b>S${x.num} · ${esc(x.name)}</b><small>${x.start} → ${x.end}</small><span>Premium <i class="coin"></i>${num(x.premium)}</span></div>`).join('')}</div>
      <p class="dim small">Premium price goes up every season. Season 1 is the cheap one.</p></div>
  </section>`;
  const sc = el.querySelector('[data-track-scroll]');
  sc.scrollLeft = Math.max(0, (st.tier - 2) * 150);
  sc.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      sc.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });
  el.querySelectorAll('.pt-prev[data-key]').forEach((p) => (p.onclick = () => itemModal(p.dataset.key, rerender)));
  el.querySelectorAll('[data-claim]').forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    try {
      const r = await api.claimPass(Number(b.dataset.claim), b.dataset.track);
      store.set(r.me);
      sfx.coin();
      toast(`Tier ${b.dataset.claim} claimed: ${r.rewards.map((x) => (x.item ? ITEM[x.item].name : x.crate ? E.CRATE[x.crate].name : x.coins + ' coins')).join(', ')}`, 'reward');
      r.crateItems.forEach((k) => toast(`📦 Crate gave <b>${esc(ITEM[k].name)}</b>`, 'reward'));
    } catch (e) {
      errToast(e);
    }
    rerender();
  }));
  const pb = el.querySelector('[data-premium]');
  if (pb) pb.onclick = async () => {
    if (me.coins < s.premium) return errToast(new Error(`Not enough coins. You need ${num(s.premium - me.coins)} more.`));
    if (!(await confirmBox('PREMIUM PASS', `Unlock the <b>${esc(s.name)}</b> premium track for <b>${num(s.premium)}</b> coins? You keep everything you unlock.`, { ok: 'UNLOCK' }))) return;
    try {
      store.set(await api.buyPremium());
      sfx.level();
      toast('★ Premium pass unlocked', 'level');
    } catch (e) {
      errToast(e);
    }
    rerender();
  };
  el.querySelector('[data-all]').onclick = async () => {
    try {
      const r = await api.claimAllPass();
      store.set(r.me);
      sfx.coin();
      toast(`Claimed ${r.count} rewards`, 'reward');
    } catch (e) {
      errToast(e);
    }
    rerender();
  };
}

// ======================= EVENTS =======================
export async function viewEvents(el, id) {
  const me = store.me;
  const list = api.eventsState(me);
  const rerender = () => viewEvents(el, id);
  if (!id) {
    el.innerHTML = `<section class="events"><h1 class="h1">EVENTS</h1>
      <div class="ev-list">${list.map((ev) => `<a class="ev-card ${ev.live ? 'live' : ''}" href="#/events/${ev.id}" style="--ev:${ev.color}">
        <span class="ev-decor">${(ev.decor || []).join(' ')}</span>
        <span class="ev-state">${ev.live ? '● LIVE · ends in ' + left(ev.end) : 'starts ' + fmtDate(ev.start)}</span>
        <b>${esc(ev.name)}</b><small>${esc(ev.tagline || '')}</small>
        ${ev.custom ? `<span class="ev-perks">${ev.discount ? `-${ev.discount}% shop` : ''} ${ev.boost > 1 ? `×${ev.boost} coins` : ''} ${ev.gift ? `🎁 ${ev.gift}` : ''}</span>` : `<span class="ev-perks">${E.eventItems(ev.id).length} event items · ${ev.challenges.length} challenges</span>`}
      </a>`).join('')}</div></section>`;
    return;
  }
  const ev = list.find((e) => e.id === id);
  if (!ev) {
    el.innerHTML = `<section class="center-msg"><h1 class="h1">EVENT NOT FOUND</h1><a class="btn primary" href="#/events">ALL EVENTS</a></section>`;
    return;
  }
  const items = ev.custom ? [] : E.eventItems(ev.id);
  el.innerHTML = `<section class="events">
    <div class="crumbs"><a href="#/events">EVENTS</a><span>▸</span><b>${esc(ev.name)}</b></div>
    <div class="ev-hero" style="--ev:${ev.color}"><span class="ev-decor big">${(ev.decor || []).join(' ')}</span>
      <div class="eyebrow">${ev.live ? '● LIVE · ends in ' + left(ev.end) : 'COMING · starts ' + fmtDate(ev.start)}</div>
      <h1 class="h1">${esc(ev.name)}</h1><p>${esc(ev.tagline || '')}</p>
      ${ev.custom ? `<div class="ev-perks">${ev.discount ? `<span class="tag">-${ev.discount}% ON THE WHOLE SHOP</span>` : ''}${ev.boost > 1 ? `<span class="tag">×${ev.boost} COINS FROM GAMES</span>` : ''}</div>` : ''}
    </div>
    ${ev.custom && ev.gift ? `<div class="panel"><div class="panel-h">EVENT GIFT</div><div class="task ${ev.giftClaimed ? 'claimed' : 'ready'}"><div class="task-i">🎁</div><div class="task-b"><b>Free gift from the operator</b></div><div class="task-r"><span>+${num(ev.gift)} <i class="coin"></i></span></div>
      ${ev.giftClaimed ? '<button class="btn ghost sm" disabled>CLAIMED</button>' : `<button class="btn primary sm" data-ch="gift" ${ev.live ? '' : 'disabled'}>CLAIM</button>`}</div></div>` : ''}
    ${ev.challenges.length ? `<div class="panel"><div class="panel-h">EVENT CHALLENGES <span class="dim">progress counts only while the event is live</span></div>
      ${ev.challenges.map((c) => {
        const done = c.value >= c.target;
        return `<div class="task ${c.claimed ? 'claimed' : done ? 'ready' : ''}"><div class="task-i">${c.claimed ? '✓' : done ? '!' : '◇'}</div>
          <div class="task-b"><b>${esc(c.text)}</b><span class="mt-bar"><i style="width:${(Math.min(1, c.value / c.target) * 100).toFixed(0)}%"></i></span><small>${num(c.value)} / ${num(c.target)}</small></div>
          <div class="task-r"><span>+${c.coins} <i class="coin"></i></span>${c.item ? `<span class="rchips">${rewardChips([{ item: c.item }])}</span>` : ''}</div>
          ${c.claimed ? '<button class="btn ghost sm" disabled>CLAIMED</button>' : `<button class="btn ${done ? 'primary' : 'ghost'} sm" data-ch="${c.id}" ${done && ev.live ? '' : 'disabled'}>CLAIM</button>`}</div>`;
      }).join('')}</div>` : ''}
    ${items.length ? `<div class="panel-h">EVENT SHOP ${ev.live ? '' : '<span class="dim">opens when the event is live</span>'}</div><div class="shop-grid">${items.map((it) => itemCard(it, me)).join('')}</div>` : ''}
  </section>`;
  bindItems(el, rerender);
  bindRewardChips(el, rerender);
  el.querySelectorAll('[data-ch]').forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    try {
      const r = await api.claimEventChallenge(ev.id, b.dataset.ch);
      store.set(r.me);
      rewardPopup({ coins: r.coins, title: 'EVENT REWARD' });
      if (r.item) toast(`Unlocked <b>${esc(ITEM[r.item].name)}</b>`, 'reward');
    } catch (e) {
      errToast(e);
    }
    rerender();
  }));
}
