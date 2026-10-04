// Current player state + the backend in use. Screens subscribe to re-render on change.
import * as local from './backend-local.js';
import { CONFIG } from './config.js';
import { applyLook } from './cosmetics/apply.js';
import { configureSfx } from './sfx.js';

// Online accounts when the server is configured. ?local in the address = this-device accounts (for testing).
const wantOnline = CONFIG.supabase.url && !new URLSearchParams(location.search).has('local');
export const api = wantOnline
  ? await import('./backend-online.js').catch((e) => {
      console.error('online backend failed to load, using this device', e);
      return local;
    })
  : local;

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
