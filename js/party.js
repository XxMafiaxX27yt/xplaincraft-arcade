// Parties + online multiplayer (Supabase Realtime).
//
// A party is a realtime channel "xca-party-CODE". Presence = who is in it; broadcasts carry chat, the
// chosen game, START, and the in-game messages that host.js relays to and from the game frame.
// The host is whoever joined first (it moves on automatically if the host leaves).
// Invites go to a friend's personal channel "xca-user-ID"; "xca-online" shows who is online.
import { api, store } from './store.js';
import { GAME } from './games.js';

const listeners = new Set();
export const party = {
  code: null,
  members: [], // [{ id, username, equipped, at, status }]
  chat: [],
  game: null, // game id the host picked
  public: false,
  playing: null, // { game, seed, order }
  get online() {
    return api.MODE === 'online' && !!api.sb;
  },
  get me() {
    return store.me?.id;
  },
  get host() {
    return this.members[0]?.id || null;
  },
  get isHost() {
    return !!this.code && this.host === this.me;
  },
};
export const onParty = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = (what) => listeners.forEach((fn) => fn(what));

let ch = null; // party channel
let joinedAt = 0;
let gameHandler = null; // set by host.js while a party game runs
let roomTimer = null;

const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => CODE_CH[Math.floor(Math.random() * CODE_CH.length)]).join('');
const fail = (m) => {
  throw new Error(m);
};
const needOnline = () => party.online || fail('Online multiplayer needs the arcade server (you are on this-device accounts).');

function readPresence() {
  const st = ch.presenceState();
  const list = Object.values(st)
    .map((metas) => metas[metas.length - 1])
    .filter(Boolean)
    .sort((a, b) => a.at - b.at || String(a.id).localeCompare(b.id));
  party.members = list;
}

async function track(status = 'lobby') {
  const me = store.me;
  if (!ch || !me) return;
  await ch.track({ id: me.id, username: me.username, equipped: me.equipped, at: joinedAt, status });
}

export function setStatus(status) {
  track(status).catch(() => {});
  setOnlineStatus(status);
}

async function join(code, { asPublic = false } = {}) {
  needOnline();
  await leaveParty(true);
  code = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(code)) fail('Party codes are 5 letters/numbers');
  const sb = api.sb;
  party.code = code;
  party.chat = [];
  party.game = null;
  party.playing = null;
  party.public = asPublic;
  joinedAt = Date.now();
  ch = sb.channel(`xca-party-${code}`, { config: { presence: { key: store.me.id }, broadcast: { self: false } } });
  ch.on('presence', { event: 'sync' }, () => {
    const wasHost = party.isHost;
    readPresence();
    if (party.members.length > 8 && !party.members.slice(0, 8).some((m) => m.id === party.me)) {
      leaveParty();
      emit({ type: 'error', msg: 'That party is full (8 players).' });
      return;
    }
    if (!wasHost && party.isHost && party.members.length > 1) addChat({ sys: true, text: 'You are now the party leader.' });
    if (party.isHost) syncRoomRow();
    emit({ type: 'members' });
  });
  // a status change re-sends presence (Supabase reports leave + join), so only count real departures
  const seen = new Set();
  ch.on('presence', { event: 'leave' }, ({ leftPresences }) => {
    setTimeout(() => {
      if (!ch) return;
      const st = ch.presenceState();
      leftPresences.forEach((p) => {
        if (st[p.id]?.length || !seen.has(p.id)) return;
        seen.delete(p.id);
        addChat({ sys: true, text: `${p.username} left` });
        gameHandler?.({ type: 'leave', id: p.id });
      });
    }, 300);
  });
  ch.on('presence', { event: 'join' }, ({ newPresences }) => {
    newPresences.forEach((p) => {
      if (seen.has(p.id)) return;
      seen.add(p.id);
      if (p.id !== party.me) addChat({ sys: true, text: `${p.username} joined` });
    });
    // tell newcomers what the leader picked
    if (party.isHost && party.game) ch.send({ type: 'broadcast', event: 'pick', payload: { game: party.game } });
  });
  ch.on('broadcast', { event: 'chat' }, ({ payload }) => addChat(payload));
  ch.on('broadcast', { event: 'pick' }, ({ payload }) => {
    party.game = payload.game;
    emit({ type: 'pick' });
  });
  ch.on('broadcast', { event: 'start' }, ({ payload }) => {
    if (!payload.order.includes(party.me)) return;
    party.playing = payload;
    emit({ type: 'start', start: payload });
  });
  ch.on('broadcast', { event: 'g' }, ({ payload }) => {
    if (payload.to && payload.to !== party.me) return;
    gameHandler?.({ type: 'msg', from: payload.from, d: payload.d });
  });
  ch.on('broadcast', { event: 'kick' }, ({ payload }) => {
    if (payload.id === party.me) {
      leaveParty();
      emit({ type: 'error', msg: 'You were removed from the party.' });
    }
  });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('Could not reach the party server')), 10000);
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(t);
        await track('lobby');
        res();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(t);
        rej(new Error('Party connection failed'));
      }
    });
  });
  // wait until presence lists us, so the leader is known before anyone picks a game
  for (let i = 0; i < 40 && !party.members.some((m) => m.id === party.me); i++) {
    await new Promise((r) => setTimeout(r, 75));
    readPresence();
  }
  setOnlineStatus('party');
  clearInterval(roomTimer);
  roomTimer = setInterval(() => party.isHost && syncRoomRow(), 30000);
  emit({ type: 'joined' });
  return party;
}

export const createParty = (opts) => join(newCode(), opts);
export const joinParty = (code) => join(code);

export async function leaveParty(silent = false) {
  clearInterval(roomTimer);
  if (party.isHost && party.public) await api.sb.from('rooms').delete().eq('code', party.code).then(() => {}, () => {});
  if (ch) {
    try {
      await ch.untrack();
      await api.sb.removeChannel(ch);
    } catch {}
  }
  ch = null;
  party.code = null;
  party.members = [];
  party.game = null;
  party.playing = null;
  party.public = false;
  if (!silent) {
    setOnlineStatus('menu');
    emit({ type: 'left' });
  }
}

function addChat(m) {
  party.chat.push({ ...m, ts: Date.now() });
  party.chat = party.chat.slice(-60);
  emit({ type: 'chat', m });
}

export function sendChat(text, sticker = null) {
  if (!ch) return;
  text = String(text || '').slice(0, 160).trim();
  if (!text && !sticker) return;
  const me = store.me;
  const m = { from: me.username, id: me.id, text, sticker };
  addChat(m);
  ch.send({ type: 'broadcast', event: 'chat', payload: m });
}

export function pickGame(gameId) {
  if (!party.isHost) fail('Only the party leader picks the game');
  party.game = gameId;
  ch.send({ type: 'broadcast', event: 'pick', payload: { game: gameId } });
  syncRoomRow();
  emit({ type: 'pick' });
}

export function startGame() {
  if (!party.isHost) fail('Only the party leader can start');
  const g = GAME[party.game] || fail('Pick a game first');
  const n = party.members.length;
  const min = g.minPlayers || 2,
    max = g.maxPlayers || 8;
  if (n < min) fail(`${g.title} needs at least ${min} players`);
  const order = party.members.slice(0, max).map((m) => m.id);
  const start = { game: g.id, seed: Math.floor(Math.random() * 1e9), order, at: Date.now() };
  party.playing = start;
  ch.send({ type: 'broadcast', event: 'start', payload: start });
  if (party.public) api.sb.from('rooms').delete().eq('code', party.code).then(() => {}, () => {});
  emit({ type: 'start', start });
}

export function kick(id) {
  if (!party.isHost || id === party.me) return;
  ch.send({ type: 'broadcast', event: 'kick', payload: { id } });
}

// in-game messages (host.js)
export function gameSend(d, to = null) {
  if (!ch) return;
  ch.send({ type: 'broadcast', event: 'g', payload: { from: party.me, to, d } });
}
export function onGameMessage(fn) {
  gameHandler = fn;
  return () => {
    if (gameHandler === fn) gameHandler = null;
  };
}
export function endPlaying() {
  party.playing = null;
  track('lobby').catch(() => {});
  emit({ type: 'members' });
}

// ---------- public rooms (quick match) ----------
async function syncRoomRow() {
  if (!party.public || !party.isHost || !party.code) return;
  const g = GAME[party.game];
  await api.sb
    .from('rooms')
    .upsert({ code: party.code, host_id: party.me, game: party.game, kind: 'game', public: true, state: 'open', players: party.members.length, max_players: g?.maxPlayers || 8, updated_at: new Date().toISOString() })
    .then(() => {}, () => {});
}

export async function quickMatch(gameId) {
  needOnline();
  const g = GAME[gameId] || fail('Unknown game');
  const since = new Date(Date.now() - 90000).toISOString();
  const { data } = await api.sb.from('rooms').select('code,players,max_players').eq('game', gameId).eq('public', true).eq('state', 'open').gt('updated_at', since).order('created_at').limit(10);
  const open = (data || []).find((r) => r.players < r.max_players);
  if (open) {
    await join(open.code, { asPublic: true });
    return { joined: true };
  }
  await createParty({ asPublic: true });
  pickGame(g.id);
  return { joined: false };
}

// ---------- invites + who is online ----------
let mine = null;
let onlineCh = null;
const online = new Map(); // id -> { status, at }
export const onlineNow = () => online;

export async function startSocial() {
  if (!party.online || !store.me) return;
  stopSocial();
  const sb = api.sb;
  mine = sb.channel(`xca-user-${store.me.id}`, { config: { broadcast: { self: false } } });
  mine.on('broadcast', { event: 'invite' }, ({ payload }) => emit({ type: 'invite', invite: payload }));
  mine.subscribe();
  onlineCh = sb.channel('xca-online', { config: { presence: { key: store.me.id } } });
  onlineCh.on('presence', { event: 'sync' }, () => {
    online.clear();
    Object.entries(onlineCh.presenceState()).forEach(([id, metas]) => online.set(id, metas[metas.length - 1]));
    emit({ type: 'online' });
  });
  onlineCh.subscribe((s) => s === 'SUBSCRIBED' && setOnlineStatus(party.code ? 'party' : 'menu'));
}
export function stopSocial() {
  try {
    if (mine) api.sb.removeChannel(mine);
    if (onlineCh) api.sb.removeChannel(onlineCh);
  } catch {}
  mine = onlineCh = null;
  online.clear();
}
function setOnlineStatus(status) {
  if (!onlineCh || !store.me) return;
  onlineCh.track({ id: store.me.id, username: store.me.username, status, party: party.code }).catch(() => {});
}

export async function invite(friendId) {
  if (!party.code) await createParty();
  const sb = api.sb;
  const c = sb.channel(`xca-user-${friendId}`, { config: { broadcast: { self: false } } });
  await new Promise((res) => {
    const t = setTimeout(res, 4000);
    c.subscribe((s) => s === 'SUBSCRIBED' && (clearTimeout(t), res()));
  });
  await c.send({ type: 'broadcast', event: 'invite', payload: { code: party.code, from: store.me.username, game: party.game } });
  setTimeout(() => sb.removeChannel(c), 1500);
}
