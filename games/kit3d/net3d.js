// NOVEX 3D online: realtime play for the 3D games.
//
// Every pair of players gets a direct WebRTC link (full mesh, up to 8): a FAST channel (unordered, no resends) for
// positions and a SAFE channel (ordered, reliable) for hits, events and round flow. The party channel (Supabase, through
// the arcade SDK) carries the handshake, and stands in - slower, throttled - for any pair that cannot link directly.
//
//   import { net3d, Interp } from '../../kit3d/net3d.js';
//   const N = await net3d(XC.net);          null when the game was not started from a party
//   N.me / N.hostId / N.isHost / N.players [{id, username}] / N.name(id) / N.order(id) (0 = first in the party)
//   N.send(d, { to, fast })                  to everyone (or one id). fast = positions (may drop), else reliable
//   N.on(fn(d, from)) · N.onLeave(fn(id)) · N.onHost(fn(newHostId))   (the host left -> the next player takes over)
//   N.link(id) -> 'p2p' | 'relay' | 'wait'   N.rtt(id) seconds   N.allLinked()   N.waitLinks(maxSec)
//   N.now()                                  local clock (s)
//   new Interp(delay) · .push(state, sentT) · .sample() -> { a, b, k } (render other players ~delay s behind)
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
const RELAY_HZ = 6;          // positions over the relay: at most this many a second per sender (the party channel has a project-wide budget)
const LINK_GIVEUP = 12;      // seconds of failed direct attempts before a pair settles on the relay
const now = () => performance.now() / 1000;

export async function net3d(xn, { forceRelay = new URLSearchParams(location.search).has('relay') } = {}) {
  if (!xn) return null;
  const me = xn.me, order = xn.players.map((p) => p.id);
  const N = {
    me, players: xn.players.slice(), hostId: order[0],
    get isHost() { return N.hostId === me; },
    name: (id) => (N.players.find((p) => p.id === id) || {}).username || 'PLAYER',
    order: (id) => order.indexOf(id),
    now,
  };
  const msgCbs = [], leaveCbs = [], hostCbs = [];
  N.onLeave = (f) => leaveCbs.push(f); N.onHost = (f) => hostCbs.push(f);
  const deliver = (d, from) => { for (const f of msgCbs) { try { f(d, from); } catch (e) { console.error(e); } } };
  // messages that arrive before the game has registered its handlers wait here
  let early = [];
  N.on = (f) => { msgCbs.push(f); if (early) { const q = early; early = null; q.forEach(([d, from]) => deliver(d, from)); } };

  // ---------- peers ----------
  const peers = new Map();   // id -> { pc, r, u, link, rtt, epoch, tries, since, offerT }
  const peer = (id) => { let P = peers.get(id); if (!P) { P = { id, link: 'wait', rtt: null, epoch: 0, tries: 0, since: now(), pc: null }; peers.set(id, P); } return P; };
  const others = () => N.players.map((p) => p.id).filter((id) => id !== me);
  const iOffer = (id) => me < id;   // the smaller id makes the offer: no glare

  function closePc(P) { try { P.pc?.close(); } catch (e) {} P.pc = P.r = P.u = null; }
  function makePc(P, epoch) {
    closePc(P);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    P.pc = pc; P.epoch = epoch;
    // negotiated channels: both sides create them, no waiting for ondatachannel
    P.r = pc.createDataChannel('safe', { negotiated: true, id: 0, ordered: true });
    P.u = pc.createDataChannel('fast', { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 });
    const opened = () => { if (P.pc === pc && P.r.readyState === 'open' && P.u.readyState === 'open') { P.link = 'p2p'; P.tries = 0; } };
    for (const ch of [P.r, P.u]) {
      ch.onopen = opened;
      ch.onmessage = (e) => { if (P.pc !== pc) return; let d; try { d = JSON.parse(e.data); } catch { return; } recv(d, P.id, true); };
      ch.onclose = () => { if (P.pc === pc && P.link === 'p2p') { P.link = 'relay'; P.since = now(); } };
    }
    pc.onconnectionstatechange = () => {
      if (P.pc !== pc) return;
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') { if (P.link === 'p2p') P.link = 'relay'; P.since = now(); P.lost = now(); }
    };
    return pc;
  }
  // full SDP with every candidate in it (one message each way instead of a stream of candidates)
  const gathered = (pc) => new Promise((res) => {
    if (pc.iceGatheringState === 'complete') return res();
    const t = setTimeout(res, 2500);
    pc.addEventListener('icegatheringstatechange', () => pc.iceGatheringState === 'complete' && (clearTimeout(t), res()));
  });
  async function offer(P) {
    const epoch = P.epoch + 1, pc = makePc(P, epoch);
    P.offerT = now(); P.tries++;
    try {
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      if (P.pc !== pc) return;
      sig(P.id, { __rtc: 'offer', sdp: pc.localDescription.sdp, e: epoch });
    } catch (e) { console.warn('rtc offer', e); }
  }
  async function onSignal(d, from) {
    if (!N.players.some((p) => p.id === from) || forceRelay) return;
    const P = peer(from);
    if (d.__rtc === 'hi') {
      // they are here (and want links): the one who offers starts
      P.heard = true;
      if (iOffer(from) && P.link !== 'p2p' && (!P.pc || now() - (P.offerT || 0) > 4)) offer(P);
      return;
    }
    if (d.__rtc === 'offer' && !iOffer(from)) {
      const pc = makePc(P, d.e);
      try {
        await pc.setRemoteDescription({ type: 'offer', sdp: d.sdp });
        await pc.setLocalDescription(await pc.createAnswer());
        await gathered(pc);
        if (P.pc !== pc) return;
        P.heard = true;
        sig(from, { __rtc: 'answer', sdp: pc.localDescription.sdp, e: d.e });
      } catch (e) { console.warn('rtc answer', e); }
      return;
    }
    if (d.__rtc === 'answer' && iOffer(from) && P.pc && d.e === P.epoch && P.pc.signalingState === 'have-local-offer') {
      try { await P.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp }); } catch (e) { console.warn('rtc set answer', e); }
    }
  }
  const sig = (to, d) => xn.send(d, to);

  // ---------- relay (party channel) ----------
  const relayFast = new Map();   // key -> latest fast message waiting for the next relay tick
  function relayIds(to) { return (to ? [to] : others()).filter((id) => peer(id).link !== 'p2p'); }
  setInterval(() => {
    if (!relayFast.size) return;
    const ids = others().filter((id) => peer(id).link !== 'p2p');
    if (ids.length) for (const d of relayFast.values()) xn.send({ __r: d, rto: ids }, ids.length === 1 ? ids[0] : undefined);
    relayFast.clear();
  }, 1000 / RELAY_HZ);

  // ---------- send / receive ----------
  N.send = (d, { to = null, fast = false } = {}) => {
    const s = JSON.stringify(d);
    const targets = to ? [to] : others();
    let relay = false;
    for (const id of targets) {
      const P = peers.get(id);
      const ch = P && P.link === 'p2p' ? (fast ? P.u : P.r) : null;
      if (ch && ch.readyState === 'open') { try { ch.send(s); continue; } catch (e) {} }
      relay = true;
    }
    if (!relay) return;
    const ids = relayIds(to);
    if (!ids.length) return;
    if (fast) relayFast.set((to || '*') + ':' + (d.k || d.t || 'x'), d);   // only the newest position per stream goes through
    else xn.send({ __r: d, rto: ids }, ids.length === 1 ? ids[0] : undefined);
  };
  function recv(d, from, direct) {
    peer(from).heardT = now();
    if (d.__p != null) { N.send({ __q: d.__p }, { to: from, fast: true }); return; }
    if (d.__q != null) {
      // (a ping that waited behind a busy moment - loading a level - is not the network: skip the first slow ones, cap spikes)
      const P = peer(from), r = now() - d.__q;
      if (P.rtt == null) { if (r < 0.8 || (P.slow = (P.slow || 0) + 1) > 4) P.rtt = r; } else P.rtt = P.rtt * 0.8 + Math.min(r, P.rtt * 3 + 0.2) * 0.2;
      return;
    }
    if (early) early.push([d, from]); else deliver(d, from);
  }
  xn.on((d, from) => {
    if (!d) return;
    if (d.__rtc) return onSignal(d, from);
    if (d.__r) { if (!d.rto || d.rto.includes(me)) recv(d.__r, from, false); return; }
  });
  // the party says someone left - but party presence can blink (a slow tab, a reconnect). Only believe it once their
  // game has really gone quiet (nothing from them for 3 s), or two copies of the match would split apart
  const pendingLeave = new Map();
  xn.onLeave((id) => { if (N.players.some((p) => p.id === id) && !pendingLeave.has(id)) pendingLeave.set(id, now()); });
  setInterval(() => {
    for (const [id, t0] of pendingLeave) {
      const heard = peers.get(id)?.heardT ?? 0;
      if (now() - heard > 3) { pendingLeave.delete(id); leave(id); }
      else if (now() - t0 > 10) pendingLeave.delete(id);   // still talking to us 10 s later: it was a blink
    }
  }, 500);
  function leave(id) {
    const P = peers.get(id); if (P) closePc(P); peers.delete(id);
    if (!N.players.some((p) => p.id === id)) return;
    N.players = N.players.filter((p) => p.id !== id);
    leaveCbs.forEach((f) => { try { f(id); } catch (e) { console.error(e); } });
    if (id === N.hostId) {
      // host migration: the next player in party order takes over
      N.hostId = order.find((x) => N.players.some((p) => p.id === x)) || me;
      hostCbs.forEach((f) => { try { f(N.hostId); } catch (e) { console.error(e); } });
    }
  }

  // ---------- link upkeep: say hi (one broadcast) until linked, retry offers, give up to the relay ----------
  let hiT = -9;
  const tick = () => {
    const t = now();
    let want = false, fresh = false;
    for (const id of others()) {
      const P = peer(id);
      if (forceRelay) { P.link = 'relay'; continue; }
      if (P.link === 'p2p') continue;
      want = true;
      const age = t - P.since;
      if (age < LINK_GIVEUP) fresh = true;
      if (P.link === 'wait' && age > LINK_GIVEUP) P.link = 'relay';
      if (iOffer(id) && P.heard && (!P.pc || t - (P.offerT || 0) > (age < LINK_GIVEUP ? 4 : 15))) offer(P);
    }
    // quickly at first, then every 15 s in case a direct route opens up later
    if (want && t - hiT > (fresh ? 2 : 15)) { hiT = t; sig(undefined, { __rtc: 'hi' }); }
  };
  tick(); setInterval(tick, 500);
  setInterval(() => {
    const t = now();
    for (const id of others()) { const P = peer(id); if (P.link === 'p2p') N.send({ __p: t }, { to: id, fast: true }); else if (P.link === 'relay' && t - (P.pingT || 0) > 3) { P.pingT = t; N.send({ __p: t }, { to: id }); } }
  }, 1000);

  N.link = (id) => (id === me ? 'self' : forceRelay ? 'relay' : peer(id).link);
  N.rtt = (id) => peer(id).rtt;
  N.allLinked = () => others().every((id) => N.link(id) !== 'wait');
  N.waitLinks = (max = 8) => new Promise((res) => { const t0 = now(); const h = setInterval(() => { if (N.allLinked() || now() - t0 > max) { clearInterval(h); res(N.allLinked()); } }, 200); });
  N.linkInfo = () => others().map((id) => ({ id, name: N.name(id), link: N.link(id), rtt: N.rtt(id) }));
  window.__N = N;
  return N;
}

// ---------- interpolation: draw other players a little in the past, between two real updates ----------
export class Interp {
  constructor(delay = 0.1) { this.buf = []; this.off = null; this.delay = delay; this.gap = 1 / 30; }
  push(st, sentT) {
    const t = now(), o = t - sentT;
    // how often updates come (30 Hz direct, ~6 Hz over the relay): stay far enough behind to always have two
    if (this.lastSent != null && sentT > this.lastSent) this.gap = this.gap * 0.9 + Math.min(0.5, sentT - this.lastSent) * 0.1;
    this.lastSent = sentT;
    // smallest seen (sender clock -> my clock) offset, creeping up slowly so a slower route is followed too
    this.off = this.off == null ? o : Math.min(this.off + 0.0008, o);
    const lt = sentT + this.off;
    if (this.buf.length && lt <= this.buf[this.buf.length - 1].t) return;   // late / duplicate
    this.buf.push({ t: lt, s: st });
    if (this.buf.length > 40) this.buf.shift();
    this.lastRecv = t;
  }
  get latest() { return this.buf.length ? this.buf[this.buf.length - 1].s : null; }
  // how far in the past sample() draws (seconds): fast movers (cars) add velocity x (lag + half the ping) to be where they are NOW
  lag() { return Math.max(this.delay, this.gap * 1.6 + 0.02); }
  // { a, b, k }: the two states either side of "now - delay" and how far between them (k > 1 = a little ahead)
  sample() {
    const B = this.buf; if (!B.length) return null;
    const t = now() - this.lag();
    if (t <= B[0].t) return { a: B[0].s, b: B[0].s, k: 0 };
    for (let i = B.length - 1; i >= 0; i--) {
      if (B[i].t <= t) {
        const a = B[i], b = B[i + 1];
        if (!b) { const p = B[i - 1]; if (!p) return { a: a.s, b: a.s, k: 0 }; const k = 1 + Math.min(0.15, t - a.t) / Math.max(0.001, a.t - p.t); return { a: p.s, b: a.s, k }; }
        return { a: a.s, b: b.s, k: (t - a.t) / Math.max(0.001, b.t - a.t) };
      }
    }
    return { a: B[0].s, b: B[0].s, k: 0 };
  }
  clear() { this.buf = []; this.lastSent = null; }
}
export const lerp = (a, b, k) => a + (b - a) * k;
export const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
