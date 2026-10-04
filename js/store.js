// Current player state + the backend in use. Screens subscribe to re-render on change.
import * as local from './backend-local.js';
import { applyLook } from './cosmetics/apply.js';
import { configureSfx } from './sfx.js';

export const api = local; // swapped for the online backend once Supabase is configured

let me = null;
const subs = new Set();

function applySettings(u) {
  const s = { ...local.DEFAULT_SETTINGS, ...(u?.settings || {}) };
  configureSfx(s);
  document.body.classList.toggle('no-scan', !s.scanlines);
  document.body.classList.toggle('reduced', !!s.reducedMotion);
  applyLook(u?.equipped);
}

export const store = {
  get me() {
    return me;
  },
  set(u) {
    me = u;
    applySettings(u);
    subs.forEach((fn) => fn(me));
  },
  async refresh() {
    store.set(await api.me());
    return me;
  },
  on(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};
