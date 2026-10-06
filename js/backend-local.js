// "This device" backend: every account lives in this browser's localStorage.
// Same function shapes as the future online (Supabase) backend, so the UI does not change.
import { CONFIG } from './config.js';
import { ALL_ITEMS, ITEM, SLOT, SLOTS, DEFAULT_EQUIP, STARTER_OWNED, titleKey } from './cosmetics/catalog.js';
import { ACHIEVEMENTS, ACH, COLLECTION_SLOTS } from './cosmetics/achievements.js';
import { GAME } from './games.js';
import { generateTasks, applyEvent, ALL_DONE_BONUS } from './tasks.js';
import { todayKey, dayDiff, levelInfo } from './util.js';
import * as E from './economy.js';

const KEY = 'xca_db_v1';
export const MODE = 'local';
const OP_HASH = '81a76637a812726afb76119db07377500ff37f16de60030bcbfb2a177302bd01';

export const DAILY_REWARDS = [50, 75, 100, 125, 150, 200, 300];
export const DAILY_PASS_XP = 100;

export const DEFAULT_SETTINGS = { sfx: true, volume: 0.6, scanlines: true, reducedMotion: false, intro: 'full' };

// ---------- storage ----------
function fresh() {
  return { users: {}, names: {}, requests: [], scores: {}, session: null, overrides: {}, customEvents: [], opLog: [] };
}
// Storage is pluggable: the online backend swaps in its own (server-backed) store.
let IO = null;
export function setIO(io) {
  IO = io;
}
function load() {
  if (IO) return IO.load();
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (!d || !d.users) return fresh();
    d.overrides ||= {};
    d.customEvents ||= [];
    d.opLog ||= [];
    Object.values(d.users).forEach(normalize);
    return d;
  } catch {
    return fresh();
  }
}
function save(db) {
  if (IO) return IO.save(db);
  localStorage.setItem(KEY, JSON.stringify(db));
}
// read-only access (no copy) for the sync helpers that run while drawing lists
const peek = () => (IO?.peek ? IO.peek() : load());
const clone = (o) => JSON.parse(JSON.stringify(o));
const fail = (msg) => {
  throw new Error(msg);
};
const live = (db) => E.liveEvents(new Date(), db.customEvents, db.overrides);
export const fail_ = fail;

async function sha(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const hashPass = (pass, salt) => sha(salt + '::' + pass);
const randId = (p) => p + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const NAME_RE = /^[A-Za-z0-9_\-]{3,16}$/;
export const checkName = (n) => NAME_RE.test(n) || fail('Callsign must be 3-16 letters, numbers, _ or -');

// Fill missing fields (older saves) and drop items that no longer exist.
export function normalize(u) {
  u.stats ||= { plays: 0, wins: 0, time: 0, games: {} };
  u.eco ||= { earned: 0, spent: 0, crates: 0, tasksDone: 0, streakMax: 0, eventDone: 0 };
  u.owned = [...new Set([...(u.owned || []).filter((k) => ITEM[k]), ...STARTER_OWNED])];
  const eq = { ...DEFAULT_EQUIP, ...(u.equipped || {}) };
  SLOTS.forEach((s) => {
    if (s.multi) eq[s.id] = (Array.isArray(eq[s.id]) ? eq[s.id] : []).filter((id) => u.owned.includes(`${s.id}:${id}`)).slice(0, s.multi);
    else if (!u.owned.includes(`${s.id}:${eq[s.id]}`)) eq[s.id] = DEFAULT_EQUIP[s.id];
  });
  u.equipped = eq;
  u.daily ||= { last: null, streak: 0 };
  u.friends ||= [];
  u.settings = { ...DEFAULT_SETTINGS, ...(u.settings || {}) };
  u.recent ||= [];
  u.pass ||= { season: null, xp: 0, premium: false, free: [], prem: [] };
  u.levelClaimed ||= [];
  u.achClaimed ||= [];
  u.events ||= {};
  u.inbox ||= [];
  u.operator ||= false;
  u.banned ||= false;
  return u;
}

function sessionUser(db) {
  const u = db.session && db.users[db.session];
  if (!u) fail('Not logged in');
  return u;
}
function byName(db, name) {
  const u = db.users[db.names[String(name || '').trim().toLowerCase()]];
  if (!u) fail(`No player called "${name}"`);
  return u;
}

// ---------- coins, xp, pass, events ----------
function earn(u, n) {
  n = Math.round(n);
  u.coins += n;
  if (n > 0) u.eco.earned += n;
}
function spend(u, n) {
  if (u.coins < n) fail(`Not enough coins (need ${n - u.coins} more)`);
  u.coins -= n;
  u.eco.spent += n;
}
export function syncPass(u) {
  const s = E.seasonFor();
  if (s && u.pass.season !== s.id) u.pass = { season: s.id, xp: 0, premium: false, free: [], prem: [] };
  return s;
}
function addPassXp(db, u, n) {
  if (!syncPass(u) || n <= 0) return;
  u.pass.xp += n;
  evTrack(db, u, 'passxp', n);
}
function addXp(db, u, xp) {
  const before = levelInfo(u.xp).level;
  u.xp += xp;
  addPassXp(db, u, xp);
  const after = levelInfo(u.xp).level;
  return after > before ? after : null;
}
function evTrack(db, u, kind, n = 1) {
  live(db).forEach((ev) => {
    if (ev.custom) return;
    const p = (u.events[ev.id] ||= { claimed: [] });
    p[kind] = (p[kind] || 0) + n;
  });
}
function grant(u, key) {
  if (!ITEM[key]) return false;
  if (u.owned.includes(key)) return false;
  u.owned.push(key);
  return true;
}
function grantReward(db, u, r) {
  if (r.coins) earn(u, r.coins);
  if (r.item) grant(u, r.item);
  if (r.crate) {
    const it = E.rollCrate(r.crate);
    if (!grant(u, it.key)) earn(u, Math.round(it.value * E.DUP_REFUND));
    return it.key;
  }
  return null;
}

export function ensureTasks(u) {
  const d = todayKey();
  if (u.tasks?.date !== d) u.tasks = { date: d, list: generateTasks(u.id, d), bonusClaimed: false };
}
function track(u, evt) {
  ensureTasks(u);
  const done = [];
  for (const t of u.tasks.list) {
    const was = t.progress >= t.target;
    if (applyEvent(t, evt) && !was && t.progress >= t.target) done.push(t.text);
  }
  return done;
}

function publicView(u) {
  return {
    id: u.id, username: u.username, bio: u.bio, xp: u.xp, created: u.created, lastSeen: u.lastSeen, operator: u.operator,
    equipped: clone(u.equipped), owned: u.owned.length,
    stats: { plays: u.stats.plays, wins: u.stats.wins, time: u.stats.time, games: clone(u.stats.games) },
    friendCount: u.friends.length, achievements: u.achClaimed.length,
  };
}
function relation(db, me, other) {
  if (me.id === other.id) return 'self';
  if (me.friends.includes(other.id)) return 'friend';
  if (db.requests.some((r) => r.from === me.id && r.to === other.id)) return 'sent';
  if (db.requests.some((r) => r.from === other.id && r.to === me.id)) return 'received';
  return 'none';
}
function out(db, u) {
  save(db);
  return clone(u);
}

// ---------- auth ----------
export async function me() {
  const db = load();
  const u = db.session && db.users[db.session];
  if (!u) return null;
  if (u.banned) {
    db.session = null;
    save(db);
    return null;
  }
  ensureTasks(u);
  syncPass(u);
  u.lastSeen = Date.now();
  return out(db, u);
}

export function newUserObject(username, extra = {}) {
  const u = normalize({
    id: randId('u_'), username, created: Date.now(), lastSeen: Date.now(), bio: '', xp: 0, coins: CONFIG.economy.startCoins, ...extra,
  });
  ensureTasks(u);
  syncPass(u);
  return u;
}

export async function signUp(username, password) {
  username = username.trim();
  checkName(username);
  if (password.length < 6) fail('Password must be at least 6 characters');
  const db = load();
  if (db.names[username.toLowerCase()]) fail('That callsign is taken');
  const salt = randId('s');
  const u = newUserObject(username, { salt, passHash: await hashPass(password, salt) });
  db.users[u.id] = u;
  db.names[username.toLowerCase()] = u.id;
  db.session = u.id;
  return out(db, u);
}

export async function logIn(username, password) {
  const db = load();
  const u = db.users[db.names[username.trim().toLowerCase()]];
  if (!u) fail('No player with that callsign');
  if ((await hashPass(password, u.salt)) !== u.passHash) fail('Wrong password');
  if (u.banned) fail('This account is banned by an operator');
  db.session = u.id;
  u.lastSeen = Date.now();
  ensureTasks(u);
  return out(db, u);
}

export async function logOut() {
  const db = load();
  db.session = null;
  save(db);
}

export async function changePassword(oldPass, newPass) {
  const db = load();
  const u = sessionUser(db);
  if ((await hashPass(oldPass, u.salt)) !== u.passHash) fail('Current password is wrong');
  if (newPass.length < 6) fail('New password must be at least 6 characters');
  u.passHash = await hashPass(newPass, u.salt);
  return out(db, u);
}

export async function changeUsername(newName) {
  newName = newName.trim();
  checkName(newName);
  const db = load();
  const u = sessionUser(db);
  const taken = db.names[newName.toLowerCase()];
  if (taken && taken !== u.id) fail('That callsign is taken');
  delete db.names[u.username.toLowerCase()];
  u.username = newName;
  db.names[newName.toLowerCase()] = u.id;
  return out(db, u);
}

function removeUser(db, u) {
  for (const o of Object.values(db.users)) o.friends = o.friends.filter((f) => f !== u.id);
  db.requests = db.requests.filter((r) => r.from !== u.id && r.to !== u.id);
  for (const g of Object.values(db.scores)) delete g[u.id];
  delete db.names[u.username.toLowerCase()];
  delete db.users[u.id];
  if (db.session === u.id) db.session = null;
}

export async function deleteAccount(password) {
  const db = load();
  const u = sessionUser(db);
  if ((await hashPass(password, u.salt)) !== u.passHash) fail('Wrong password');
  removeUser(db, u);
  save(db);
}

// ---------- profile + settings ----------
export async function updateProfile({ bio }) {
  const db = load();
  const u = sessionUser(db);
  const nb = String(bio ?? '').slice(0, 160);
  if (nb !== u.bio) track(u, { kind: 'profile' });
  u.bio = nb;
  return out(db, u);
}

export async function updateSettings(patch) {
  const db = load();
  const u = sessionUser(db);
  u.settings = { ...DEFAULT_SETTINGS, ...u.settings, ...patch };
  return out(db, u);
}

export async function getProfile(username) {
  const db = load();
  const meU = sessionUser(db);
  const u = db.users[db.names[String(username).toLowerCase()]];
  if (!u) return null;
  const friends = u.friends.map((f) => db.users[f]).filter(Boolean).map((f) => ({ username: f.username, equipped: f.equipped, xp: f.xp }));
  return { ...publicView(u), relation: relation(db, meU, u), friends };
}

// ---------- shop / locker ----------
export function liveEventsNow() {
  return live(peek());
}
export function price(key) {
  return E.priceFor(key, { live: live(peek()) });
}

export async function buy(key) {
  const db = load();
  const u = sessionUser(db);
  const it = ITEM[key];
  if (!it) fail('Unknown item');
  if (u.owned.includes(key)) fail('You already own this');
  const p = E.priceFor(key, { live: live(db) });
  if (!p) fail(it.src === 'event' ? 'This event item is only sold while its event is live' : 'This item is not sold in the shop');
  spend(u, p.price);
  grant(u, key);
  track(u, { kind: 'buy' });
  if (it.src === 'event') evTrack(db, u, 'buy');
  return out(db, u);
}

export async function equip(slot, id) {
  const db = load();
  const u = sessionUser(db);
  const key = `${slot}:${id}`;
  const s = SLOT[slot];
  if (!s || !ITEM[key]) fail('Unknown item');
  if (!u.owned.includes(key)) fail('You do not own this yet');
  if (s.multi) {
    const arr = u.equipped[slot];
    if (arr.includes(id)) u.equipped[slot] = arr.filter((x) => x !== id);
    else {
      if (arr.length >= s.multi) fail(`You can show ${s.multi} ${s.name.toLowerCase()} - remove one first`);
      arr.push(id);
      track(u, { kind: 'equip' });
    }
  } else if (u.equipped[slot] !== id) {
    u.equipped[slot] = id;
    track(u, { kind: 'equip' });
  }
  return out(db, u);
}

export async function openCrate(id) {
  const db = load();
  const u = sessionUser(db);
  const c = E.CRATE[id];
  if (!c) fail('Unknown crate');
  spend(u, c.price);
  const it = E.rollCrate(id);
  const isNew = grant(u, it.key);
  const refund = isNew ? 0 : Math.round(it.value * E.DUP_REFUND);
  if (refund) earn(u, refund);
  u.eco.crates++;
  evTrack(db, u, 'crate');
  return { me: out(db, u), key: it.key, isNew, refund };
}

// ---------- daily reward ----------
export function dailyState(u) {
  const t = todayKey();
  const claimedToday = u.daily.last === t;
  const continues = u.daily.last && dayDiff(u.daily.last, t) === 1;
  const nextStreak = claimedToday ? u.daily.streak : continues ? u.daily.streak + 1 : 1;
  const dayIndex = (nextStreak - 1) % 7;
  return { claimedToday, streak: claimedToday ? u.daily.streak : continues ? u.daily.streak : 0, nextStreak, dayIndex, reward: DAILY_REWARDS[dayIndex] };
}

export async function claimDaily() {
  const db = load();
  const u = sessionUser(db);
  const st = dailyState(u);
  if (st.claimedToday) fail('Already claimed today. Come back tomorrow!');
  u.daily = { last: todayKey(), streak: st.nextStreak };
  u.eco.streakMax = Math.max(u.eco.streakMax, st.nextStreak);
  earn(u, st.reward);
  const lv = addXp(db, u, 25);
  addPassXp(db, u, DAILY_PASS_XP);
  track(u, { kind: 'daily' });
  evTrack(db, u, 'daily');
  return { me: out(db, u), coins: st.reward, xp: 25, levelUp: lv, streak: st.nextStreak };
}

// ---------- tasks ----------
export async function claimTask(taskId) {
  const db = load();
  const u = sessionUser(db);
  ensureTasks(u);
  const t = u.tasks.list.find((x) => x.id === taskId);
  if (!t) fail('Task expired - a new day started');
  if (t.claimed) fail('Already claimed');
  if (t.progress < t.target) fail('Task not finished yet');
  t.claimed = true;
  earn(u, t.coins);
  u.eco.tasksDone++;
  evTrack(db, u, 'tasks');
  const lv = addXp(db, u, t.xp);
  return { me: out(db, u), coins: t.coins, xp: t.xp, levelUp: lv };
}

export async function claimTaskBonus() {
  const db = load();
  const u = sessionUser(db);
  ensureTasks(u);
  if (u.tasks.bonusClaimed) fail('Already claimed');
  if (!u.tasks.list.every((t) => t.claimed)) fail('Claim all 3 tasks first');
  u.tasks.bonusClaimed = true;
  earn(u, ALL_DONE_BONUS.coins);
  const lv = addXp(db, u, ALL_DONE_BONUS.xp);
  return { me: out(db, u), ...ALL_DONE_BONUS, levelUp: lv };
}

// ---------- level road ----------
export async function claimLevel(level) {
  const db = load();
  const u = sessionUser(db);
  const r = E.levelRoad().find((x) => x.level === level);
  if (!r) fail('No reward at that level');
  if (levelInfo(u.xp).level < level) fail(`Reach level ${level} first`);
  if (u.levelClaimed.includes(level)) fail('Already claimed');
  u.levelClaimed.push(level);
  const got = r.rewards.map((rw) => grantReward(db, u, rw)).filter(Boolean);
  return { me: out(db, u), rewards: r.rewards, crateItems: got };
}

// ---------- battle pass ----------
export function passState(u) {
  const season = E.seasonFor();
  if (!season) return { season: null, next: E.nextSeason() };
  const p = u.pass?.season === season.id ? u.pass : { xp: 0, premium: false, free: [], prem: [] };
  return { season, track: E.passTrack(season.id), xp: p.xp, tier: E.passTierOf(p.xp), premium: p.premium, free: p.free, prem: p.prem, perTier: E.PASS_XP_PER_TIER };
}

export async function buyPremium() {
  const db = load();
  const u = sessionUser(db);
  const s = syncPass(u);
  if (!s) fail('No season is running');
  if (u.pass.premium) fail('You already have the premium pass');
  spend(u, s.premium);
  u.pass.premium = true;
  return out(db, u);
}

export async function claimPass(tier, track) {
  const db = load();
  const u = sessionUser(db);
  const s = syncPass(u);
  if (!s) fail('No season is running');
  if (E.passTierOf(u.pass.xp) < tier) fail(`Reach tier ${tier} first`);
  const list = track === 'premium' ? u.pass.prem : u.pass.free;
  if (track === 'premium' && !u.pass.premium) fail('Unlock the premium pass first');
  if (list.includes(tier)) fail('Already claimed');
  list.push(tier);
  const rw = E.passTrack(s.id)[tier - 1][track];
  const got = rw.map((r) => grantReward(db, u, r)).filter(Boolean);
  return { me: out(db, u), rewards: rw, crateItems: got };
}

export async function claimAllPass() {
  const db = load();
  const u = sessionUser(db);
  const s = syncPass(u);
  if (!s) fail('No season is running');
  const tier = E.passTierOf(u.pass.xp);
  const tr = E.passTrack(s.id);
  let n = 0;
  for (let t = 1; t <= tier; t++) {
    if (!u.pass.free.includes(t)) {
      u.pass.free.push(t);
      tr[t - 1].free.forEach((r) => grantReward(db, u, r));
      n++;
    }
    if (u.pass.premium && !u.pass.prem.includes(t)) {
      u.pass.prem.push(t);
      tr[t - 1].premium.forEach((r) => grantReward(db, u, r));
      n++;
    }
  }
  if (!n) fail('Nothing to claim yet');
  return { me: out(db, u), count: n };
}

// ---------- achievements ----------
function statsFor(db, u) {
  const owned = new Set(u.owned);
  const sets = {};
  ACHIEVEMENTS.filter((a) => a.pal).forEach((a) => {
    sets[a.pal] = COLLECTION_SLOTS.filter((slot) => u.owned.some((k) => k.startsWith(slot + ':') && ITEM[k]?.pal === a.pal)).length;
  });
  const dressed = SLOTS.filter((s) => (s.multi ? u.equipped[s.id].length : u.equipped[s.id] !== DEFAULT_EQUIP[s.id])).length;
  const s = E.seasonFor();
  return {
    level: levelInfo(u.xp).level, streak: u.eco.streakMax, tasks: u.eco.tasksDone, owned: owned.size, earned: u.eco.earned, spent: u.eco.spent,
    crates: u.eco.crates, friends: u.friends.length, passTier: s && u.pass.season === s.id ? E.passTierOf(u.pass.xp) : 0, eventDone: u.eco.eventDone,
    plays: u.stats.plays, wins: u.stats.wins, hours: u.stats.time / 3600, collections: Object.values(sets).filter((n) => n >= 5).length,
    achievements: u.achClaimed.length, bio: u.bio ? 1 : 0, dressed, sets,
  };
}
export function achievementState(u) {
  const st = statsFor(null, u);
  return ACHIEVEMENTS.map((a) => {
    const v = a.stat.startsWith('set:') ? st.sets[a.stat.slice(4)] : st[a.stat];
    return { ...a, value: Math.min(a.target, v || 0), done: (v || 0) >= a.target, claimed: u.achClaimed.includes(a.id) };
  });
}
export async function claimAchievement(id) {
  const db = load();
  const u = sessionUser(db);
  const a = achievementState(u).find((x) => x.id === id);
  if (!a) fail('Unknown achievement');
  if (a.claimed) fail('Already claimed');
  if (!a.done) fail('Not unlocked yet');
  u.achClaimed.push(id);
  earn(u, a.coins);
  grant(u, `badge:${id}`);
  if (a.title) grant(u, titleKey(a.title));
  return { me: out(db, u), coins: a.coins, badge: `badge:${id}`, title: a.title ? titleKey(a.title) : null };
}

// ---------- events ----------
export function eventsState(u) {
  const db = peek();
  return E.eventList(new Date(), db.customEvents, db.overrides).map((ev) => {
    const p = u.events[ev.id] || { claimed: [] };
    const ch = E.challengesFor(ev).map((c) => ({ ...c, value: Math.min(c.target, p[c.id] || 0), claimed: (p.claimed || []).includes(c.id) }));
    return { ...ev, challenges: ch, giftClaimed: (p.claimed || []).includes('gift') };
  });
}
export async function claimEventChallenge(evId, chId) {
  const db = load();
  const u = sessionUser(db);
  const ev = live(db).find((e) => e.id === evId);
  if (!ev) fail('This event is not live');
  const p = (u.events[evId] ||= { claimed: [] });
  p.claimed ||= [];
  if (chId === 'gift') {
    if (!ev.custom || !ev.gift) fail('No gift in this event');
    if (p.claimed.includes('gift')) fail('Already claimed');
    p.claimed.push('gift');
    earn(u, ev.gift);
    return { me: out(db, u), coins: ev.gift };
  }
  const c = E.challengesFor(ev).find((x) => x.id === chId);
  if (!c) fail('Unknown challenge');
  if (p.claimed.includes(chId)) fail('Already claimed');
  if ((p[chId] || 0) < c.target) fail('Challenge not finished yet');
  p.claimed.push(chId);
  earn(u, c.coins);
  if (c.item) grant(u, c.item);
  u.eco.eventDone++;
  return { me: out(db, u), coins: c.coins, item: c.item };
}

// ---------- gifts inbox ----------
export async function claimGift(id) {
  const db = load();
  const u = sessionUser(db);
  const g = u.inbox.find((x) => x.id === id);
  if (!g) fail('Gift not found');
  u.inbox = u.inbox.filter((x) => x.id !== id);
  if (g.coins) earn(u, g.coins);
  if (g.xp) addXp(db, u, g.xp);
  (g.items || []).forEach((k) => grant(u, k));
  return { me: out(db, u), gift: g };
}

// ---------- game results ----------
export async function reportResult({ game, score = 0, won = null, stats = {}, duration = 0 }) {
  const db = load();
  const u = sessionUser(db);
  const g = GAME[game];
  if (!g) fail('Unknown game');
  duration = Math.max(0, Math.min(duration, 60 * 60));
  score = Number(score) || 0;
  const gs = (u.stats.games[game] ||= { plays: 0, wins: 0, best: null, time: 0 });
  gs.plays++;
  gs.time += duration;
  u.stats.plays++;
  u.stats.time += duration;
  if (won) {
    gs.wins++;
    u.stats.wins++;
  }
  let newBest = false;
  const better = g.lowerIsBetter ? (a, b) => a < b : (a, b) => a > b;
  if (score > 0 && (gs.best === null || better(score, gs.best))) {
    gs.best = score;
    newBest = true;
    (db.scores[game] ||= {})[u.id] = score;
  }
  let xp = 0;
  let coins = 0;
  if (duration >= CONFIG.economy.minRunSec) {
    xp = Math.min(80, 10 + Math.floor(duration / 6)) + (won ? 25 : 0) + (newBest ? 10 : 0);
    coins = Math.min(40, 4 + Math.floor(duration / 20)) + (won ? 10 : 0) + (newBest ? 5 : 0);
    const boost = Math.max(1, ...live(db).filter((e) => e.custom && e.boost).map((e) => e.boost));
    coins = Math.round(coins * boost);
  }
  earn(u, coins);
  const levelUp = addXp(db, u, xp);
  const tasksDone = track(u, { kind: 'result', game, genre: g.genre, score, won, stats: { score, ...stats }, duration });
  u.recent = [{ game, score, won, ts: Date.now() }, ...u.recent.filter((r) => r.game !== game)].slice(0, 6);
  return { me: out(db, u), xp, coins, levelUp, newBest, best: gs.best, tasksDone };
}

// ---------- leaderboards ----------
export async function leaderboard(game) {
  const db = load();
  const users = Object.values(db.users).filter((u) => !u.banned);
  if (game === 'xp' || game === 'coins' || game === 'owned') {
    const val = { xp: (u) => u.xp, coins: (u) => u.eco.earned, owned: (u) => u.owned.length }[game];
    return users.map((u) => ({ username: u.username, equipped: u.equipped, value: val(u), id: u.id })).sort((a, b) => b.value - a.value).slice(0, 50);
  }
  const g = GAME[game];
  const rows = Object.entries(db.scores[game] || {}).map(([id, value]) => ({ id, value, u: db.users[id] })).filter((r) => r.u && !r.u.banned)
    .map((r) => ({ id: r.id, value: r.value, username: r.u.username, equipped: r.u.equipped }));
  rows.sort((a, b) => (g?.lowerIsBetter ? a.value - b.value : b.value - a.value));
  return rows.slice(0, 50);
}

// ---------- friends ----------
export async function searchPlayers(q) {
  const db = load();
  const u = sessionUser(db);
  q = String(q || '').trim().toLowerCase();
  if (!q) return [];
  return Object.values(db.users).filter((o) => o.id !== u.id && !o.banned && o.username.toLowerCase().includes(q)).slice(0, 20)
    .map((o) => ({ username: o.username, equipped: o.equipped, xp: o.xp, relation: relation(db, u, o) }));
}
export async function sendFriendRequest(username) {
  const db = load();
  const u = sessionUser(db);
  const o = byName(db, username);
  const rel = relation(db, u, o);
  if (rel === 'self') fail("You can't add yourself");
  if (rel === 'friend') fail('Already friends');
  if (rel === 'sent') fail('Request already sent');
  if (rel === 'received') return acceptFrom(db, u, o);
  db.requests.push({ id: randId('r_'), from: u.id, to: o.id, ts: Date.now() });
  return out(db, u);
}
function acceptFrom(db, u, o) {
  db.requests = db.requests.filter((r) => !(r.from === o.id && r.to === u.id) && !(r.from === u.id && r.to === o.id));
  if (!u.friends.includes(o.id)) u.friends.push(o.id);
  if (!o.friends.includes(u.id)) o.friends.push(u.id);
  return out(db, u);
}
export async function respondRequest(fromUsername, accept) {
  const db = load();
  const u = sessionUser(db);
  const o = byName(db, fromUsername);
  if (!db.requests.some((r) => r.from === o.id && r.to === u.id)) fail('No request from that player');
  if (accept) return acceptFrom(db, u, o);
  db.requests = db.requests.filter((r) => !(r.from === o.id && r.to === u.id));
  return out(db, u);
}
export async function cancelRequest(toUsername) {
  const db = load();
  const u = sessionUser(db);
  const o = byName(db, toUsername);
  db.requests = db.requests.filter((r) => !(r.from === u.id && r.to === o.id));
  return out(db, u);
}
export async function removeFriend(username) {
  const db = load();
  const u = sessionUser(db);
  const o = byName(db, username);
  u.friends = u.friends.filter((f) => f !== o.id);
  o.friends = o.friends.filter((f) => f !== u.id);
  return out(db, u);
}
export async function friendsData() {
  const db = load();
  const u = sessionUser(db);
  const view = (o) => ({ username: o.username, equipped: o.equipped, xp: o.xp, lastSeen: o.lastSeen });
  return {
    friends: u.friends.map((f) => db.users[f]).filter(Boolean).map(view),
    incoming: db.requests.filter((r) => r.to === u.id).map((r) => db.users[r.from]).filter(Boolean).map(view),
    outgoing: db.requests.filter((r) => r.from === u.id).map((r) => db.users[r.to]).filter(Boolean).map(view),
  };
}
export async function incomingCount() {
  const db = load();
  const u = db.session && db.users[db.session];
  return u ? db.requests.filter((r) => r.to === u.id).length : 0;
}

// ======================= OPERATOR =======================
// Every operator change to a player is a "patch" applied with applyPatch(). Here (this device) it is applied
// straight away; online it is queued on the server and applied by that player's own arcade.
export const OP_ITEMS = ['skin:knight-operator', 'skin:visor-operator', 'frame:crown-operator', 'banner:matrix-operator', 'nameplate:glitch-operator', 'effect:glitch-operator', 'cursor:cross-operator', 'pet:owl-operator', 'title:t-operator', 'badge:operator'];

export function xpForLevel(level) {
  level = Math.max(1, Math.min(200, Math.round(Number(level) || 1)));
  let xp = 0;
  for (let l = 1; l < level; l++) xp += 100 + (l - 1) * 50;
  return xp;
}

export function applyPatch(db, u, p) {
  if (p.coins) (p.coins > 0 ? earn(u, p.coins) : (u.coins = Math.max(0, u.coins + p.coins)));
  if (p.xp > 0) addXp(db, u, p.xp);
  if (p.setXp != null) u.xp = Math.max(0, Number(p.setXp) || 0);
  (p.grant || []).forEach((k) => grant(u, k));
  if (p.revoke?.length) {
    u.owned = u.owned.filter((k) => !p.revoke.includes(k) || STARTER_OWNED.includes(k));
    normalize(u);
  }
  if (p.unlockAll) u.owned = ALL_ITEMS.map((i) => i.key);
  if (p.gift && !u.inbox.some((g) => g.id === p.gift.id)) {
    u.inbox.push({ id: p.gift.id || randId('g_'), from: p.gift.from, msg: String(p.gift.msg || '').slice(0, 140), coins: p.gift.coins || 0, xp: p.gift.xp || 0, items: (p.gift.items || []).filter((k) => ITEM[k]), ts: p.gift.ts || Date.now() });
  }
  if (p.reset) {
    const what = p.reset;
    if (what === 'daily') u.daily = { last: null, streak: u.daily.streak };
    if (what === 'tasks') (u.tasks = null), ensureTasks(u);
    if (what === 'complete') {
      ensureTasks(u);
      u.tasks.list.forEach((t) => (t.progress = t.target));
    }
    if (what === 'events') u.events = {};
    if (what === 'levelroad') u.levelClaimed = [];
    if (what === 'achievements') u.achClaimed = [];
  }
  if (p.pass && syncPass(u)) {
    const { tier = null, premium = null, reset = false } = p.pass;
    if (reset) u.pass = { season: u.pass.season, xp: 0, premium: false, free: [], prem: [] };
    if (tier != null) u.pass.xp = Math.max(0, Math.min(E.PASS_TIERS, Number(tier))) * E.PASS_XP_PER_TIER;
    if (premium != null) u.pass.premium = !!premium;
  }
  return u;
}

// builds a custom event from the operator console form
export function makeCustomEvent({ name, tagline = '', days = 3, discount = 0, boost = 1, gift = 0, color = '#ff2bd6', decor = '✦' }) {
  name = String(name || '').trim().slice(0, 32);
  if (!name) fail('Give the event a name');
  const start = Date.now();
  return {
    id: randId('ce_'), name: name.toUpperCase(), tagline: String(tagline).slice(0, 120), start, end: start + Math.max(1, Math.min(60, Number(days) || 1)) * 86400000,
    discount: Math.max(0, Math.min(90, Number(discount) || 0)), boost: Math.max(1, Math.min(5, Number(boost) || 1)), gift: Math.max(0, Math.round(Number(gift) || 0)),
    color, decor: [...String(decor || '✦')].slice(0, 3), pals: [],
  };
}

// operator form values -> patch (+ how many coins / XP it may add, for the server's jump check)
export const OP_PATCH = {
  coins: (n) => {
    n = Math.round(Number(n) || 0);
    if (!n) fail('Enter an amount');
    return { data: { coins: n }, coins: Math.max(0, n), log: (who) => `${n > 0 ? 'gave' : 'took'} ${Math.abs(n)} coins ${n > 0 ? 'to' : 'from'} ${who}` };
  },
  xp: (n) => {
    n = Math.round(Number(n) || 0);
    if (n <= 0) fail('Enter a positive amount');
    return { data: { xp: n }, xp: n, log: (who) => `gave ${n} XP to ${who}` };
  },
  level: (level) => ({ data: { setXp: xpForLevel(level) }, xp: 1e12, log: (who) => `set ${who} to level ${Math.round(Number(level) || 1)}` }),
  item: (key, give = true) => {
    if (!ITEM[key]) fail('Unknown item');
    return { data: give ? { grant: [key] } : { revoke: [key] }, log: (who) => `${give ? 'gave' : 'removed'} ${ITEM[key].name} ${give ? 'to' : 'from'} ${who}` };
  },
  unlockAll: () => ({ data: { unlockAll: true }, log: (who) => `unlocked every cosmetic for ${who}` }),
  gift: ({ coins = 0, xp = 0, items = [], msg = '' }) => {
    coins = Math.max(0, Math.round(Number(coins) || 0));
    xp = Math.max(0, Math.round(Number(xp) || 0));
    items = items.filter((k) => ITEM[k]);
    if (!coins && !xp && !items.length) fail('Add coins, XP or an item to the gift');
    return { gift: { coins, xp, items, msg: String(msg).slice(0, 140) }, coins, xp, log: (who) => `sent a gift to ${who}` };
  },
  reset: (what) => ({ data: { reset: what }, log: (who) => `reset ${what} for ${who}` }),
  pass: (opts) => ({ data: { pass: opts }, log: (who) => `changed pass for ${who}` }),
};
export const whoName = (who) => (who === '*' ? 'everyone' : who);

export async function unlockOperator(code) {
  if ((await sha('xc-op::' + String(code).toUpperCase())) !== OP_HASH) return null;
  const db = load();
  const u = sessionUser(db);
  u.operator = true;
  OP_ITEMS.forEach((k) => grant(u, k));
  oplog(db, u, 'entered operator mode');
  return out(db, u);
}
function opUser(db) {
  const u = sessionUser(db);
  if (!u.operator) fail('Operator only');
  return u;
}
function oplog(db, u, msg) {
  db.opLog.unshift({ ts: Date.now(), by: u.username, msg });
  db.opLog = db.opLog.slice(0, 200);
}
function targets(db, who) {
  if (who === '*') return Object.values(db.users);
  return [byName(db, who)];
}
function opApply(who, pk) {
  const db = load();
  const op = opUser(db);
  targets(db, who).forEach((u) => applyPatch(db, u, pk.gift ? { gift: { ...pk.gift, from: op.username } } : pk.data));
  oplog(db, op, pk.log(whoName(who)));
  return out(db, db.users[op.id]);
}

export async function opPlayers() {
  const db = load();
  opUser(db);
  return Object.values(db.users).map((u) => ({
    username: u.username, equipped: u.equipped, xp: u.xp, coins: u.coins, owned: u.owned.length, operator: u.operator, banned: u.banned,
    created: u.created, lastSeen: u.lastSeen, passTier: E.passTierOf(u.pass?.xp || 0), premium: u.pass?.premium,
  })).sort((a, b) => b.lastSeen - a.lastSeen);
}
export async function opLog() {
  const db = load();
  opUser(db);
  return db.opLog;
}

export const opCoins = async (who, n) => opApply(who, OP_PATCH.coins(n));
export const opXp = async (who, n) => opApply(who, OP_PATCH.xp(n));
export const opSetLevel = async (who, level) => opApply(who, OP_PATCH.level(level));
export const opItem = async (who, key, give = true) => opApply(who, OP_PATCH.item(key, give));
export const opUnlockAll = async (who) => opApply(who, OP_PATCH.unlockAll());
export const opGift = async (who, g) => opApply(who, OP_PATCH.gift(g));
// love sets can only be given with online accounts (the server is what keeps them one of a kind)
export async function loveGift() {
  fail('Love sets can only be given with online accounts');
}
export const opReset = async (who, what) => opApply(who, OP_PATCH.reset(what));
export const opPass = async (who, opts) => {
  if (!E.seasonFor()) fail('No season is running');
  return opApply(who, OP_PATCH.pass(opts));
};

export async function opSetFlag(who, flag, value) {
  const db = load();
  const op = opUser(db);
  if (!['operator', 'banned'].includes(flag)) fail('Unknown flag');
  const u = byName(db, who);
  if (u.id === op.id && !value && flag === 'operator') fail('Use "leave operator mode" for yourself');
  if (u.id === op.id && flag === 'banned') fail("You can't ban yourself");
  u[flag] = !!value;
  oplog(db, op, `${value ? 'set' : 'cleared'} ${flag} on ${who}`);
  return out(db, op);
}
export async function opDelete(who) {
  const db = load();
  const op = opUser(db);
  const u = byName(db, who);
  if (u.id === op.id) fail("You can't delete yourself here");
  removeUser(db, u);
  oplog(db, op, `deleted player ${who}`);
  return out(db, op);
}
export async function opEventOverride(id, state) {
  const db = load();
  const op = opUser(db);
  if (state === 'auto') delete db.overrides[id];
  else db.overrides[id] = state;
  oplog(db, op, `event ${id}: ${state}`);
  return out(db, op);
}
export async function opCreateEvent(form) {
  const db = load();
  const op = opUser(db);
  const ev = makeCustomEvent(form);
  db.customEvents.push(ev);
  oplog(db, op, `created event ${ev.name}`);
  return out(db, op);
}
export async function opEndCustomEvent(id) {
  const db = load();
  const op = opUser(db);
  db.customEvents = db.customEvents.filter((e) => e.id !== id);
  delete db.overrides[id];
  oplog(db, op, `removed custom event ${id}`);
  return out(db, op);
}
export async function opLeave() {
  const db = load();
  const u = opUser(db);
  u.operator = false;
  oplog(db, u, 'left operator mode');
  return out(db, u);
}
