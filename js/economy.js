// Crates, featured shop, level road, battle pass tracks, event calendar, prices.
import { ALL_ITEMS, ITEM, RARITY, RARITIES } from './cosmetics/catalog.js';
import { SEASONS, EVENTS, PASS_TIERS, PASS_XP_PER_TIER, EVENT_CHALLENGES } from './cosmetics/seasons.js';
import { todayKey, hashStr, rng } from './util.js';

export { SEASONS, EVENTS, PASS_TIERS, PASS_XP_PER_TIER, EVENT_CHALLENGES };
const ORDER = RARITIES.map((r) => r.id);
const byRarity = (a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity);

// ---------- crates ----------
export const CRATES = [
  { id: 'basic', name: 'BASIC CRATE', price: 300, color: '#22e6ff', weights: { common: 50, uncommon: 30, rare: 15, epic: 4.5, legendary: 0.5 } },
  { id: 'elite', name: 'ELITE CRATE', price: 1200, color: '#b35cff', weights: { uncommon: 20, rare: 40, epic: 28, legendary: 10, exotic: 2 } },
  { id: 'mythic', name: 'MYTHIC CRATE', price: 4000, color: '#ff3b3b', weights: { epic: 35, legendary: 40, exotic: 18, mythic: 7 } },
];
export const CRATE = Object.fromEntries(CRATES.map((c) => [c.id, c]));
const CRATE_POOL = ALL_ITEMS.filter((i) => i.src === 'shop' || i.src === 'crate');
export const DUP_REFUND = 0.4;

export function rollCrate(id, rand = Math.random) {
  const c = CRATE[id];
  const entries = Object.entries(c.weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let x = rand() * total;
  let rarity = entries[0][0];
  for (const [r, w] of entries) {
    if ((x -= w) <= 0) {
      rarity = r;
      break;
    }
  }
  const pool = CRATE_POOL.filter((i) => i.rarity === rarity);
  return pool[Math.floor(rand() * pool.length)];
}
export function crateOdds(id) {
  const c = CRATE[id];
  const total = Object.values(c.weights).reduce((a, b) => a + b, 0);
  return Object.entries(c.weights).map(([r, w]) => ({ rarity: r, pct: (w / total) * 100 }));
}

// ---------- events ----------
function md(d) {
  return d.getMonth() * 100 + d.getDate() + 100; // comparable month-day number
}
function parseMD(s) {
  const [m, d] = s.split('-').map(Number);
  return m * 100 + d;
}
function windowFor(ev, now) {
  if (ev.start.length > 5) {
    const s = new Date(ev.start + 'T00:00:00').getTime();
    const e = new Date(ev.end + 'T23:59:59').getTime();
    return { start: s, end: e };
  }
  const y = now.getFullYear();
  const s = parseMD(ev.start);
  const e = parseMD(ev.end);
  const mk = (yy, v) => new Date(yy, Math.floor(v / 100) - 1, v % 100).getTime();
  if (e >= s) {
    let start = mk(y, s);
    let end = mk(y, e) + 86399999;
    if (now.getTime() > end) {
      start = mk(y + 1, s);
      end = mk(y + 1, e) + 86399999;
    }
    return { start, end };
  }
  // wraps over New Year
  const cur = md(now);
  if (cur <= e) return { start: mk(y - 1, s), end: mk(y, e) + 86399999 };
  return { start: mk(y, s), end: mk(y + 1, e) + 86399999 };
}

// All events with live state. custom = operator-made events, overrides = { id: 'on' | 'off' }
export function eventList(now = new Date(), custom = [], overrides = {}) {
  const t = now.getTime();
  const list = EVENTS.map((ev) => {
    const w = windowFor(ev, now);
    let live = t >= w.start && t <= w.end;
    if (overrides[ev.id] === 'on') live = true;
    if (overrides[ev.id] === 'off') live = false;
    return { ...ev, ...w, live, custom: false };
  });
  custom.forEach((c) => {
    let live = t >= c.start && t <= c.end;
    if (overrides[c.id] === 'off') live = false;
    list.push({ ...c, live, custom: true });
  });
  return list.sort((a, b) => (b.live - a.live) || a.start - b.start);
}
export const liveEvents = (now, custom, overrides) => eventList(now, custom, overrides).filter((e) => e.live);

export function eventItems(evId) {
  return ALL_ITEMS.filter((i) => i.srcId === evId && i.src === 'event').sort(byRarity);
}
export function eventRewards(evId) {
  return ALL_ITEMS.filter((i) => i.srcId === evId && i.src === 'eventReward');
}
export function challengesFor(ev) {
  if (ev.custom) return [];
  const rewards = eventRewards(ev.id);
  return EVENT_CHALLENGES.map((c) => {
    let item = null;
    if (c.reward === 'title') item = rewards.find((i) => i.slot === 'title');
    if (c.reward === 'skin') item = rewards.find((i) => i.slot === 'skin');
    if (c.id === 'daily') item = rewards.find((i) => i.slot === 'theme');
    if (c.id === 'crate') item = rewards.find((i) => i.slot === 'intro');
    return { ...c, text: c.text.replace('{n}', c.target.toLocaleString()), item: item?.key || null };
  });
}

// ---------- battle pass ----------
export function seasonFor(now = new Date()) {
  const d = todayKey(now);
  return SEASONS.find((s) => d >= s.start && d <= s.end) || null;
}
export function nextSeason(now = new Date()) {
  const d = todayKey(now);
  return SEASONS.filter((s) => s.start > d).sort((a, b) => (a.start < b.start ? -1 : 1))[0] || null;
}

const trackCache = {};
// rewards per tier: { free: [{coins}|{item}|{crate}], premium: [...] }
export function passTrack(seasonId) {
  if (trackCache[seasonId]) return trackCache[seasonId];
  const items = ALL_ITEMS.filter((i) => i.src === 'pass' && i.srcId === seasonId);
  const free = items.filter((_, i) => i % 7 === 3).slice(0, 10);
  const prem = items.filter((i) => !free.includes(i));
  const tiers = [];
  for (let t = 1; t <= PASS_TIERS; t++) tiers.push({ tier: t, free: [], premium: [] });
  free.forEach((it, i) => tiers[Math.min(PASS_TIERS - 1, (i + 1) * 5 - 1)].free.push({ item: it.key }));
  tiers.forEach((tr) => {
    if (!tr.free.length) tr.free.push(tr.tier % 10 === 7 ? { crate: 'basic' } : { coins: 20 + tr.tier * 4 });
  });
  prem.forEach((it, i) => tiers[Math.min(PASS_TIERS - 1, Math.floor((i * PASS_TIERS) / prem.length))].premium.push({ item: it.key }));
  tiers.forEach((tr) => {
    if (tr.tier % 10 === 0) tr.premium.push({ crate: tr.tier === 50 ? 'mythic' : 'elite' });
    if (!tr.premium.length) tr.premium.push({ coins: 100 + tr.tier * 10 });
  });
  return (trackCache[seasonId] = tiers);
}
export const passTierOf = (xp) => Math.min(PASS_TIERS, Math.floor(xp / PASS_XP_PER_TIER));

// ---------- level road ----------
const LEVEL_ITEMS = ALL_ITEMS.filter((i) => i.src === 'level').sort(byRarity);
let roadCache = null;
export function levelRoad() {
  if (roadCache) return roadCache;
  const road = [];
  for (let l = 2; l <= 100; l++) road.push({ level: l, rewards: [{ coins: 40 + l * 10 }] });
  LEVEL_ITEMS.forEach((it, i) => {
    const lv = Math.min(100, 5 + Math.floor((i * 96) / LEVEL_ITEMS.length / 5) * 5);
    road[lv - 2].rewards.push({ item: it.key });
  });
  road.forEach((r) => r.level % 10 === 0 && r.rewards.push({ crate: r.level >= 50 ? 'elite' : 'basic' }));
  return (roadCache = road);
}

// ---------- featured shop (same for everyone each day) ----------
const SHOP_POOL = ALL_ITEMS.filter((i) => i.src === 'shop');
export function featured(date = todayKey()) {
  const r = rng(hashStr('featured|' + date));
  const picks = new Set();
  const out = [];
  const slots = ['skin', 'frame', 'banner', 'nameplate', 'cursor', 'pet', 'effect', 'title'];
  slots.forEach((slot) => {
    const pool = SHOP_POOL.filter((i) => i.slot === slot && !picks.has(i.key));
    const it = pool[Math.floor(r() * pool.length)];
    picks.add(it.key);
    out.push({ key: it.key, off: 0.25 });
  });
  const big = SHOP_POOL.filter((i) => ['epic', 'legendary', 'exotic', 'mythic'].includes(i.rarity) && !picks.has(i.key));
  out.unshift({ key: big[Math.floor(r() * big.length)].key, off: 0.5, deal: true });
  return out;
}

// Price right now (event items only while their event is live; featured + custom event discounts)
export function priceFor(key, { live = [], date = todayKey() } = {}) {
  const it = ITEM[key];
  if (!it || !it.buy) return null;
  if (it.src === 'event' && !live.some((e) => e.id === it.srcId)) return null;
  let off = 0;
  const f = featured(date).find((x) => x.key === key);
  if (f) off = f.off;
  live.forEach((e) => e.custom && e.discount && (off = Math.max(off, e.discount / 100)));
  return { price: Math.max(10, Math.round((it.value * (1 - off)) / 10) * 10), base: it.value, off };
}

export const rarityIndex = (r) => ORDER.indexOf(r);
export { RARITY, RARITIES, ORDER };
