// The love sets: only NovexYT sees this. Pick a set (or single pieces), write a note, send it to someone special.
// The server checks who is giving (supabase/schema.sql love_gift), so nobody else can hand these out.
import { esc } from './util.js';
import { api, store } from './store.js';
import { sfx } from './sfx.js';
import { LOVE_GIVER, LOVE_SETS, LOVE_SLOT_NAMES, loveItems } from './cosmetics/catalog.js';
import { avatarHTML, callsignHTML, titleHTML, sceneAttrs, previewHTML } from './cosmetics/render.js';
import { modal, toast, errToast } from './ui.js';

export const canGiveLove = () => !!store.me && store.me.username.toLowerCase() === LOVE_GIVER.toLowerCase();

const setLook = (id) => Object.fromEntries(loveItems(id).filter((i) => !['sticker', 'badge'].includes(i.slot)).map((i) => [i.slot, i.id]));

export function openLoveGift(to) {
  const picked = new Set();
  const card = (L) => {
    const look = setLook(L.id), bn = sceneAttrs(loveItems(L.id).find((i) => i.slot === 'banner'));
    return `<button class="love-set" data-set="${L.id}">
      <span class="love-bn ${bn.cls}" style="${bn.style}"></span>
      <span class="love-who">${avatarHTML(look, 76, '', true)}<span class="love-cs">${callsignHTML(to, look, 'lg')}${titleHTML(look)}</span></span>
      <b>${esc(L.name)}</b><small>${esc(L.tag)} · ${loveItems(L.id).length} pieces</small>
      <span class="love-tick">✓ IN THE GIFT</span>
    </button>`;
  };
  const m = modal(`
    <div class="love-gift">
      <div class="love-h">💝 A GIFT FOR <b>${esc(to)}</b></div>
      <p class="dim small">One of a kind. Nobody else in the arcade can ever get these - only you can give them. Pick one set, two, or all three.</p>
      <div class="love-sets">${LOVE_SETS.map(card).join('')}</div>
      <details class="love-pieces"><summary>Choose single pieces instead</summary>
        <div class="love-grid">${LOVE_SETS.map((L) => loveItems(L.id).map((i) => `<label class="love-piece" title="${esc(i.name)}"><input type="checkbox" data-k="${i.key}"><span class="love-pv">${previewHTML(i)}</span><small>${esc(LOVE_SLOT_NAMES[i.slot] || i.slot)} · ${esc(L.name)}</small></label>`).join('')).join('')}</div>
      </details>
      <label class="fld"><span>YOUR NOTE (shows with the gift)</span><input data-msg maxlength="140" value="For you, always ♥"></label>
      <div class="love-foot"><span class="dim small" data-count>Nothing picked yet</span><button class="btn primary" data-send disabled>SEND WITH LOVE 💝</button></div>
    </div>`, { wide: true });
  const el = m.el;
  const sync = () => {
    el.querySelectorAll('[data-k]').forEach((c) => (c.checked = picked.has(c.dataset.k)));
    LOVE_SETS.forEach((L) => el.querySelector(`[data-set="${L.id}"]`).classList.toggle('on', loveItems(L.id).every((i) => picked.has(i.key))));
    el.querySelector('[data-count]').textContent = picked.size ? `${picked.size} piece${picked.size > 1 ? 's' : ''} in the gift` : 'Nothing picked yet';
    el.querySelector('[data-send]').disabled = !picked.size;
  };
  el.querySelectorAll('[data-set]').forEach((b) => (b.onclick = () => {
    const keys = loveItems(b.dataset.set).map((i) => i.key), all = keys.every((k) => picked.has(k));
    keys.forEach((k) => (all ? picked.delete(k) : picked.add(k)));
    sfx.click?.(); sync();
  }));
  el.querySelectorAll('[data-k]').forEach((c) => (c.onchange = () => ((c.checked ? picked.add(c.dataset.k) : picked.delete(c.dataset.k)), sync())));
  el.querySelector('[data-send]').onclick = async (e) => {
    e.target.disabled = true;
    try {
      const r = await api.loveGift(to, [...picked], el.querySelector('[data-msg]').value);
      if (r && r.username) store.set(r);
      sfx.ok?.();
      toast(`Sent to <b>${esc(to)}</b> with love 💝 It is waiting in their gifts.`, 'ok');
      m.close();
    } catch (err) {
      e.target.disabled = false;
      errToast(err);
    }
  };
  sync();
}
