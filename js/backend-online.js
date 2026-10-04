// Online backend (Supabase). Same function shapes as backend-local.js, so the screens do not change.
//
// How it works: the arcade logic (coins, crates, pass, tasks...) is the same code as the this-device backend,
// running on an in-memory copy of *your* account. After every change the copy is saved to the server
// (save_me), which checks it (no operator/ban edits, no huge coin/XP jumps). Everything shared with other
// players - profiles, friends, leaderboards, gifts, operator actions - goes through server tables.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';
import { CONFIG } from './config.js';
import * as L from './backend-local.js';
import { GAME } from './games.js';
import * as E from './economy.js';

export const MODE = 'online';
export const { DAILY_REWARDS, DAILY_PASS_XP, DEFAULT_SETTINGS, dailyState, passState, achievementState, eventsState, liveEventsNow, price } = L;

export const sb = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'xca_online_auth' },
});

const fail = (msg) => {
  throw new Error(msg);
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const nice = (error) => {
  const m = String(error?.message || error || 'Server error');
  if (/fetch|network/i.test(m)) return 'Cannot reach the arcade server - check your internet';
  return m.replace(/^.*?: /, (x) => (x.length < 40 ? '' : x));
};
const must = ({ data, error }) => {
  if (error) fail(nice(error));
  return data;
};
const rpc = async (fn, args) => must(await sb.rpc(fn, args));
const likeExact = (s) => String(s).replace(/[\\%_]/g, (c) => '\\' + c);

// ---------- your account, in memory ----------
let cache = null; // same shape as the local db, holding only you
let consumed = []; // patch ids applied here, removed on the server at the next save
let dirty = false;
let lastPull = 0;
let saving = Promise.resolve();

function emptyDb() {
  return { users: {}, names: {}, requests: [], scores: {}, session: null, overrides: {}, customEvents: [], opLog: [] };
}
L.setIO({
  load: () => (cache ? clone(cache) : emptyDb()),
  peek: () => cache || emptyDb(),
  save: (db) => {
    cache = db;
    dirty = true;
  },
});
const meU = () => cache?.users[cache.session];

function profileOf(u) {
  return {
    bio: u.bio || '', xp: u.xp, equipped: u.equipped, owned_count: u.owned.length, coins_earned: u.eco.earned, achievements: u.achClaimed.length,
    stats: { plays: u.stats.plays, wins: u.stats.wins, time: u.stats.time, games: u.stats.games },
  };
}
function stateOf(u) {
  const s = clone(u);
  delete s.friends;
  delete s.salt;
  delete s.passHash;
  return s;
}

// save your account to the server (one save at a time)
function flush() {
  const run = async () => {
    if (!dirty || !meU()) return;
    const u = meU();
    const ids = consumed.slice();
    dirty = false;
    const { error } = await sb.rpc('save_me', { p_profile: profileOf(u), p_state: stateOf(u), p_consumed: ids });
    if (error) {
      dirty = true;
      await pull(true).catch(() => {});
      fail(nice(error));
    }
    consumed = consumed.filter((id) => !ids.includes(id));
  };
  saving = saving.then(run, run);
  return saving;
}
const wrap = (fn) => async (...a) => {
  const r = await fn(...a);
  await flush();
  return r;
};

// load your account (+ friends, gifts, operator changes, events config) from the server
async function pull(force = false) {
  await saving.catch(() => {});
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    cache = null;
    return null;
  }
  if (!force && cache && cache.session === session.user.id && Date.now() - lastPull < 20000) return meU();
  const uid = session.user.id;
  const [pl, st, cfg, fr, rq, pa] = await Promise.all([
    sb.from('players').select('*').eq('id', uid).maybeSingle(),
    sb.from('player_state').select('state').eq('id', uid).maybeSingle(),
    sb.from('arcade_config').select('*').eq('id', 1).maybeSingle(),
    sb.from('friends').select('b').eq('a', uid),
    sb.from('friend_requests').select('from_id,to_id'),
    sb.from('patches').select('*').eq('to_id', uid).order('created_at'),
  ]);
  [pl, st, cfg, fr, rq, pa].forEach((r) => r.error && fail(nice(r.error)));
  if (!pl.data || !st.data) {
    cache = null;
    return null;
  }
  const u = L.normalize({ ...st.data.state, id: uid, username: pl.data.username, operator: pl.data.operator, banned: pl.data.banned, friends: fr.data.map((r) => r.b) });
  u.created ||= Date.parse(pl.data.created_at);
  const db = emptyDb();
  db.users[uid] = u;
  db.names[u.username.toLowerCase()] = uid;
  db.session = uid;
  db.requests = rq.data.map((r) => ({ from: r.from_id, to: r.to_id }));
  db.customEvents = cfg.data?.custom_events || [];
  db.overrides = cfg.data?.overrides || {};
  // apply waiting operator changes, show waiting gifts
  let changed = false;
  for (const p of pa.data) {
    if (p.kind === 'op') {
      // the server state never contains a patch that is still listed (save_me removes it in the same step)
      L.applyPatch(db, u, p.data || {});
      if (!consumed.includes(p.id)) consumed.push(p.id);
      changed = true;
    } else if (!u.inbox.some((g) => g.id === p.id)) {
      L.applyPatch(db, u, { gift: { id: p.id, from: p.from_name, msg: p.msg, coins: p.data.coins, xp: p.data.xp, items: p.data.items, ts: Date.parse(p.created_at) } });
      changed = true;
    }
  }
  // gifts in the inbox that the server no longer has were claimed elsewhere
  const waiting = new Set(pa.data.map((p) => p.id));
  const before = u.inbox.length;
  u.inbox = u.inbox.filter((g) => waiting.has(g.id) || consumed.includes(g.id));
  if (u.inbox.length !== before) changed = true;
  cache = db;
  lastPull = Date.now();
  if (changed) {
    dirty = true;
    await flush();
  }
  return u;
}

// ---------- auth ----------
export async function me() {
  const u = await pull();
  if (!u) return null;
  if (u.banned) {
    await sb.auth.signOut();
    cache = null;
    return null;
  }
  const r = await L.me();
  await flush();
  return r;
}

const loginEmail = async (username) => rpc('login_email', { p_username: String(username || '').trim() });

export async function signUp(username, password) {
  username = String(username || '').trim();
  L.checkName(username);
  if (password.length < 6) fail('Password must be at least 6 characters');
  if (await loginEmail(username)) fail('That callsign is taken');
  const st = await fetch(`${CONFIG.supabase.url}/auth/v1/settings`, { headers: { apikey: CONFIG.supabase.anonKey } }).then((r) => r.json()).catch(() => ({}));
  if (st.disable_signup) fail('Sign-ups are closed right now');
  if (st.mailer_autoconfirm === false) fail('The arcade server is still being set up (email confirmation is on). Try again soon.');
  const email = `p${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}@players.xcarcade.app`;
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) fail(nice(error));
  if (!data.session) fail('The arcade server is still being set up. Try again soon.');
  const u = L.newUserObject(username, { id: data.user.id });
  await rpc('create_player', { p_username: username, p_email: email, p_state: stateOf(u), p_profile: profileOf(u) });
  lastPull = 0;
  return me();
}

export async function logIn(username, password) {
  const email = await loginEmail(username);
  if (!email) fail('No player with that callsign');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) fail(/invalid/i.test(error.message) ? 'Wrong password' : nice(error));
  lastPull = 0;
  const u = await pull(true);
  if (!u) fail('This account has no player yet');
  if (u.banned) {
    await sb.auth.signOut();
    cache = null;
    fail('This account is banned by an operator');
  }
  return me();
}

export async function logOut() {
  await flush().catch(() => {});
  await sb.auth.signOut();
  cache = null;
}

async function checkPassword(password) {
  const u = meU() || fail('Not logged in');
  const email = await loginEmail(u.username);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) fail('Password is wrong');
}

export async function changePassword(oldPass, newPass) {
  if (newPass.length < 6) fail('New password must be at least 6 characters');
  await checkPassword(oldPass);
  const { error } = await sb.auth.updateUser({ password: newPass });
  if (error) fail(nice(error));
  return clone(meU());
}

export async function changeUsername(newName) {
  newName = String(newName || '').trim();
  L.checkName(newName);
  await rpc('rename_me', { p_username: newName });
  const u = meU();
  delete cache.names[u.username.toLowerCase()];
  u.username = newName;
  cache.names[newName.toLowerCase()] = u.id;
  return clone(u);
}

export async function deleteAccount(password) {
  await checkPassword(password);
  await rpc('delete_me');
  await sb.auth.signOut();
  cache = null;
}

// ---------- your own account (same logic as this-device, saved online) ----------
export const updateProfile = wrap(L.updateProfile);
export const updateSettings = wrap(L.updateSettings);
export const buy = wrap(L.buy);
export const equip = wrap(L.equip);
export const openCrate = wrap(L.openCrate);
export const claimDaily = wrap(L.claimDaily);
export const claimTask = wrap(L.claimTask);
export const claimTaskBonus = wrap(L.claimTaskBonus);
export const claimLevel = wrap(L.claimLevel);
export const buyPremium = wrap(L.buyPremium);
export const claimPass = wrap(L.claimPass);
export const claimAllPass = wrap(L.claimAllPass);
export const claimAchievement = wrap(L.claimAchievement);
export const claimEventChallenge = wrap(L.claimEventChallenge);

export async function claimGift(id) {
  const r = await L.claimGift(id);
  if (!consumed.includes(id)) consumed.push(id);
  await flush();
  return r;
}

export async function reportResult(res) {
  const r = await L.reportResult(res);
  await flush();
  if (r.newBest && r.best != null) {
    const { error } = await sb.from('scores').upsert({ game: res.game, user_id: meU().id, value: r.best, updated_at: new Date().toISOString() });
    if (error) console.warn('score not saved', error);
  }
  return r;
}

// ---------- players ----------
const PCOLS = 'id,username,bio,xp,equipped,stats,owned_count,coins_earned,achievements,operator,banned,created_at,last_seen';
const ts = (t) => (t ? Date.parse(t) : 0);
async function playerByName(name) {
  const r = must(await sb.from('players').select(PCOLS).ilike('username', likeExact(String(name || '').trim())).limit(1));
  return r[0] || null;
}
async function myRequests() {
  const u = meU() || fail('Not logged in');
  const rows = must(await sb.from('friend_requests').select('from_id,to_id'));
  cache.requests = rows.map((r) => ({ from: r.from_id, to: r.to_id }));
  return { u, rows };
}
function relationTo(u, otherId) {
  if (otherId === u.id) return 'self';
  if (u.friends.includes(otherId)) return 'friend';
  if (cache.requests.some((r) => r.from === u.id && r.to === otherId)) return 'sent';
  if (cache.requests.some((r) => r.from === otherId && r.to === u.id)) return 'received';
  return 'none';
}
async function refreshFriends() {
  const u = meU();
  if (!u) return;
  u.friends = must(await sb.from('friends').select('b').eq('a', u.id)).map((r) => r.b);
}

export async function getProfile(username) {
  const { u } = await myRequests();
  const p = await playerByName(username);
  if (!p) return null;
  const fids = must(await sb.from('friends').select('b').eq('a', p.id)).map((r) => r.b);
  const friends = fids.length ? must(await sb.from('players').select('username,equipped,xp,banned').in('id', fids)).filter((f) => !f.banned) : [];
  const own = p.id === u.id;
  return {
    id: p.id, username: p.username, bio: own ? u.bio : p.bio, xp: own ? u.xp : p.xp, created: ts(p.created_at), lastSeen: own ? Date.now() : ts(p.last_seen), operator: p.operator,
    equipped: own ? clone(u.equipped) : p.equipped, owned: own ? u.owned.length : p.owned_count,
    stats: own ? clone({ plays: u.stats.plays, wins: u.stats.wins, time: u.stats.time, games: u.stats.games }) : { plays: 0, wins: 0, time: 0, games: {}, ...p.stats },
    friendCount: fids.length, achievements: own ? u.achClaimed.length : p.achievements,
    relation: relationTo(u, p.id), friends: friends.map((f) => ({ username: f.username, equipped: f.equipped, xp: f.xp })),
  };
}

export async function leaderboard(game) {
  if (game === 'xp' || game === 'coins' || game === 'owned') {
    const col = { xp: 'xp', coins: 'coins_earned', owned: 'owned_count' }[game];
    const rows = must(await sb.from('players').select(`id,username,equipped,${col}`).eq('banned', false).order(col, { ascending: false }).limit(50));
    return rows.map((r) => ({ id: r.id, username: r.username, equipped: r.equipped, value: Number(r[col]) }));
  }
  const g = GAME[game];
  const rows = must(await sb.from('scores').select('user_id,value,players(username,equipped,banned)').eq('game', game).order('value', { ascending: !!g?.lowerIsBetter }).limit(60));
  return rows.filter((r) => r.players && !r.players.banned).slice(0, 50).map((r) => ({ id: r.user_id, value: r.value, username: r.players.username, equipped: r.players.equipped }));
}

// ---------- friends ----------
export async function searchPlayers(q) {
  const { u } = await myRequests();
  q = String(q || '').trim();
  if (!q) return [];
  const rows = must(await sb.from('players').select('id,username,equipped,xp').eq('banned', false).ilike('username', `%${likeExact(q)}%`).neq('id', u.id).limit(20));
  return rows.map((o) => ({ username: o.username, equipped: o.equipped, xp: o.xp, relation: relationTo(u, o.id) }));
}

export async function sendFriendRequest(username) {
  const { u } = await myRequests();
  const o = (await playerByName(username)) || fail(`No player called "${username}"`);
  const rel = relationTo(u, o.id);
  if (rel === 'self') fail("You can't add yourself");
  if (rel === 'friend') fail('Already friends');
  if (rel === 'sent') fail('Request already sent');
  if (rel === 'received') await rpc('accept_friend', { p_from: o.id });
  else must(await sb.from('friend_requests').insert({ from_id: u.id, to_id: o.id }));
  await refreshFriends();
  await myRequests();
  return clone(meU());
}

export async function respondRequest(fromUsername, accept) {
  const { u } = await myRequests();
  const o = (await playerByName(fromUsername)) || fail('No player with that callsign');
  if (accept) await rpc('accept_friend', { p_from: o.id });
  else must(await sb.from('friend_requests').delete().eq('from_id', o.id).eq('to_id', u.id));
  await refreshFriends();
  await myRequests();
  dirty = true;
  await flush();
  return clone(meU());
}

export async function cancelRequest(toUsername) {
  const { u } = await myRequests();
  const o = (await playerByName(toUsername)) || fail('No player with that callsign');
  must(await sb.from('friend_requests').delete().eq('from_id', u.id).eq('to_id', o.id));
  await myRequests();
  return clone(meU());
}

export async function removeFriend(username) {
  const o = (await playerByName(username)) || fail('No player with that callsign');
  await rpc('remove_friend', { p_other: o.id });
  await refreshFriends();
  return clone(meU());
}

export async function friendsData() {
  const { u, rows } = await myRequests();
  await refreshFriends();
  const inc = rows.filter((r) => r.to_id === u.id).map((r) => r.from_id);
  const outg = rows.filter((r) => r.from_id === u.id).map((r) => r.to_id);
  const ids = [...new Set([...u.friends, ...inc, ...outg])];
  const players = ids.length ? must(await sb.from('players').select('id,username,equipped,xp,last_seen').in('id', ids)) : [];
  const P = Object.fromEntries(players.map((p) => [p.id, { username: p.username, equipped: p.equipped, xp: p.xp, lastSeen: ts(p.last_seen) }]));
  const view = (id) => P[id];
  return { friends: u.friends.map(view).filter(Boolean), incoming: inc.map(view).filter(Boolean), outgoing: outg.map(view).filter(Boolean) };
}

export async function incomingCount() {
  const u = meU();
  if (!u) return 0;
  const { count, error } = await sb.from('friend_requests').select('from_id', { count: 'exact', head: true }).eq('to_id', u.id);
  return error ? 0 : count || 0;
}

// ======================= OPERATOR =======================
export async function unlockOperator(code) {
  if (!(await rpc('become_operator', { p_code: String(code) }))) return null;
  const u = meU();
  u.operator = true;
  L.applyPatch(cache, u, { grant: L.OP_ITEMS });
  dirty = true;
  await flush();
  return clone(u);
}
const opOnly = () => (meU()?.operator ? meU() : fail('Operator only'));

export async function opPlayers() {
  opOnly();
  const rows = await rpc('op_players');
  return rows.map((p) => ({
    username: p.username, equipped: p.equipped, xp: Number(p.xp), coins: Number(p.coins), owned: p.owned, operator: p.operator, banned: p.banned,
    created: ts(p.created_at), lastSeen: ts(p.last_seen), passTier: E.passTierOf(p.pass?.xp || 0), premium: p.pass?.premium,
  }));
}
export async function opLog() {
  opOnly();
  return must(await sb.from('op_log').select('ts,by_name,msg').order('ts', { ascending: false }).limit(200)).map((r) => ({ ts: ts(r.ts), by: r.by_name, msg: r.msg }));
}

async function opSend(who, pk) {
  const op = opOnly();
  who = String(who || '').trim();
  if (!who) fail('Pick a player');
  const kind = pk.gift ? 'gift' : 'op';
  await rpc('op_send', { p_who: who, p_kind: kind, p_data: pk.gift || pk.data, p_msg: pk.gift?.msg || '', p_coins: pk.coins || 0, p_xp: Math.min(pk.xp || 0, 1e15), p_log: pk.log(L.whoName(who)) });
  if (who === '*' || who.toLowerCase() === op.username.toLowerCase()) await pull(true);
  return clone(meU());
}
export const opCoins = async (who, n) => opSend(who, L.OP_PATCH.coins(n));
export const opXp = async (who, n) => opSend(who, L.OP_PATCH.xp(n));
export const opSetLevel = async (who, level) => opSend(who, L.OP_PATCH.level(level));
export const opItem = async (who, key, give = true) => opSend(who, L.OP_PATCH.item(key, give));
export const opUnlockAll = async (who) => opSend(who, L.OP_PATCH.unlockAll());
export const opGift = async (who, g) => opSend(who, L.OP_PATCH.gift(g));
export const opReset = async (who, what) => opSend(who, L.OP_PATCH.reset(what));
export const opPass = async (who, opts) => {
  if (!E.seasonFor()) fail('No season is running');
  return opSend(who, L.OP_PATCH.pass(opts));
};

export async function opSetFlag(who, flag, value) {
  const op = opOnly();
  if (String(who).toLowerCase() === op.username.toLowerCase()) fail(flag === 'banned' ? "You can't ban yourself" : 'Use "leave operator mode" for yourself');
  await rpc('op_set_flag', { p_who: who, p_flag: flag, p_value: !!value });
  return clone(meU());
}
export async function opDelete(who) {
  opOnly();
  await rpc('op_delete', { p_who: who });
  return clone(meU());
}
async function saveConfig(log) {
  await rpc('op_config', { p_custom: cache.customEvents, p_overrides: cache.overrides, p_log: log });
  return clone(meU());
}
export async function opEventOverride(id, state) {
  opOnly();
  if (state === 'auto') delete cache.overrides[id];
  else cache.overrides[id] = state;
  return saveConfig(`event ${id}: ${state}`);
}
export async function opCreateEvent(form) {
  opOnly();
  const ev = L.makeCustomEvent(form);
  cache.customEvents.push(ev);
  return saveConfig(`created event ${ev.name}`);
}
export async function opEndCustomEvent(id) {
  opOnly();
  cache.customEvents = cache.customEvents.filter((e) => e.id !== id);
  delete cache.overrides[id];
  return saveConfig(`removed custom event ${id}`);
}
export async function opLeave() {
  opOnly();
  await rpc('op_leave');
  meU().operator = false;
  return clone(meU());
}

// keep "last seen" fresh and pick up gifts / operator changes while the arcade is open
setInterval(() => {
  if (!meU() || document.hidden) return;
  pull(true).catch(() => {});
}, 60000);
