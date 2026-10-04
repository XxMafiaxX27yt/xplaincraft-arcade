// Toasts, modals, confirm dialogs, reward popups.
import { $, esc } from './util.js';
import { sfx } from './sfx.js';

export function toast(msg, kind = 'info', ms = 3200) {
  const root = $('#toasts');
  const t = document.createElement('div');
  t.className = `toast t-${kind}`;
  t.innerHTML = msg;
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => {
    t.classList.remove('in');
    setTimeout(() => t.remove(), 400);
  }, ms);
}

export function errToast(e) {
  sfx.err();
  toast(esc(e?.message || String(e)), 'err');
}

let openModal = null;

export function modal(html, { wide = false, onClose } = {}) {
  closeModal();
  const root = $('#modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
    <button class="modal-x" data-close aria-label="Close">✕</button>${html}</div>`;
  root.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('in'));
  const close = () => {
    if (openModal !== api) return;
    openModal = null;
    wrap.classList.remove('in');
    setTimeout(() => wrap.remove(), 250);
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('mousedown', (e) => {
    if (e.target === wrap) close();
  });
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => (sfx.back(), close())));
  const api = { el: wrap.querySelector('.modal'), close };
  openModal = api;
  return api;
}

export function closeModal() {
  openModal?.close();
}

export function confirmBox(title, text, { ok = 'CONFIRM', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const m = modal(
      `<h3 class="m-title">${esc(title)}</h3><p class="m-text">${text}</p>
       <div class="m-actions"><button class="btn ghost" data-no>CANCEL</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(ok)}</button></div>`,
      { onClose: () => !answered && resolve(false) }
    );
    m.el.querySelector('[data-no]').onclick = () => {
      answered = true;
      m.close();
      resolve(false);
    };
    m.el.querySelector('[data-yes]').onclick = () => {
      answered = true;
      m.close();
      resolve(true);
    };
  });
}

// Shows "+XP +coins" and level-up.
export function rewardPopup({ coins = 0, xp = 0, levelUp = null, title = 'REWARD' }) {
  if (coins) sfx.coin();
  const lv = levelUp ? `<div class="rw-level">LEVEL UP <b>${levelUp}</b></div>` : '';
  toast(
    `<div class="rw"><span class="rw-t">${esc(title)}</span>${xp ? `<span class="rw-xp">+${xp} XP</span>` : ''}${
      coins ? `<span class="rw-c">+${coins} <i class="coin"></i></span>` : ''
    }</div>${lv}`,
    levelUp ? 'level' : 'reward',
    levelUp ? 4500 : 3000
  );
  if (levelUp) setTimeout(() => sfx.level(), 200);
}
