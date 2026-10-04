// The intro: press start -> boot log -> sign up / log in -> "HELLO, NAME" -> loading -> arcade reveal.
import { $, esc, sleep } from './util.js';
import { sfx } from './sfx.js';
import { api, store } from './store.js';
import { CONFIG } from './config.js';
import { find } from './cosmetics/catalog.js';
import { PAL } from './cosmetics/palettes.js';

// Boot screen colors from the player's INTRO cosmetic.
function applyIntro(u) {
  const it = find('intro', u?.equipped?.intro || 'neon');
  const p = PAL[it?.pal] || PAL.neon;
  const b = $('#boot');
  b.style.setProperty('--b1', p.c1 === '#ffffff' ? p.c3 : p.c1);
  b.style.setProperty('--b2', p.c2.length && p.c2 !== '#000000' ? p.c2 : p.c3);
}

const B = CONFIG.brand;
let skipping = false;

function wait(ms) {
  return skipping ? Promise.resolve() : sleep(ms);
}

function logoHTML(cls = '') {
  return `<div class="logo ${cls}">
    <div class="logo-top">${esc(B.top)}</div>
    <div class="logo-name" data-text="${esc(B.name)}">${esc(B.name)}</div>
    <div class="logo-line"></div>
  </div>`;
}

async function typeLine(box, text, cls = '') {
  const line = document.createElement('div');
  line.className = 'bl ' + cls;
  box.appendChild(line);
  for (let i = 0; i < text.length; i++) {
    if (skipping) {
      line.textContent = text;
      break;
    }
    line.textContent = text.slice(0, i + 1);
    if (i % 2 === 0) sfx.type();
    await sleep(12);
  }
  return line;
}

function pressStart(root) {
  return new Promise((resolve) => {
    root.innerHTML = `<div class="boot-stage">
      ${logoHTML('logo-boot')}
      <div class="press">PRESS ANY KEY TO START</div>
      <div class="boot-ver">v${esc(B.version)} · build ${new Date().getFullYear()}</div>
    </div>`;
    const go = () => {
      window.removeEventListener('keydown', go);
      window.removeEventListener('pointerdown', go);
      sfx.unlock();
      sfx.boot();
      resolve();
    };
    window.addEventListener('keydown', go);
    window.addEventListener('pointerdown', go);
  });
}

async function bootLog(root) {
  root.innerHTML = `<div class="boot-stage left"><div class="boot-log" id="blog"></div></div>`;
  const box = $('#blog', root);
  const lines = [
    ['XC-OS ' + B.version + ' // NEON KERNEL', 'hi'],
    ['memory check ............ 65536K OK'],
    ['gpu ...................... WebGL ' + (document.createElement('canvas').getContext('webgl2') ? '2.0' : '1.0') + ' OK'],
    ['audio .................... OK'],
    ['mounting cartridges ...... OK'],
    ['player link .............. WAITING', 'warn'],
  ];
  for (const [t, c] of lines) {
    await typeLine(box, '> ' + t, c);
    await wait(90);
  }
  await wait(350);
}

function authPanel(root) {
  return new Promise((resolve) => {
    let tab = 'new';
    const render = () => {
      root.innerHTML = `<div class="boot-stage">
        ${logoHTML('logo-small')}
        <form class="auth" autocomplete="on" novalidate>
          <div class="auth-title">IDENTIFY YOURSELF</div>
          <div class="auth-tabs">
            <button type="button" class="${tab === 'new' ? 'on' : ''}" data-tab="new">NEW PLAYER</button>
            <button type="button" class="${tab === 'old' ? 'on' : ''}" data-tab="old">I HAVE AN ACCOUNT</button>
          </div>
          <label class="fld"><span>CALLSIGN</span>
            <input name="u" maxlength="16" autocomplete="username" placeholder="your player name" required></label>
          <label class="fld"><span>PASSWORD</span>
            <input name="p" type="password" autocomplete="${tab === 'new' ? 'new-password' : 'current-password'}" placeholder="${tab === 'new' ? 'at least 6 characters' : 'your password'}" required></label>
          ${tab === 'new' ? `<label class="fld"><span>CONFIRM PASSWORD</span><input name="p2" type="password" autocomplete="new-password" placeholder="type it again" required></label>` : ''}
          <div class="auth-err" aria-live="polite"></div>
          <button class="btn primary big" type="submit">${tab === 'new' ? 'CREATE ACCOUNT' : 'LOG IN'}</button>
          <div class="auth-note">${api.MODE === 'local' ? 'Accounts are saved on this device for now.' : 'Online account.'}</div>
        </form>
      </div>`;
      const f = $('form', root);
      f.querySelectorAll('[data-tab]').forEach((b) =>
        b.addEventListener('click', () => {
          sfx.click();
          tab = b.dataset.tab;
          render();
        })
      );
      f.u.focus();
      f.addEventListener('input', () => sfx.type());
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('.auth-err', f);
        err.textContent = '';
        try {
          if (tab === 'new' && f.p.value !== f.p2.value) throw new Error('Passwords do not match');
          const u = tab === 'new' ? await api.signUp(f.u.value, f.p.value) : await api.logIn(f.u.value, f.p.value);
          sfx.ok();
          resolve({ u, isNew: tab === 'new' });
        } catch (ex) {
          sfx.err();
          err.textContent = ex.message;
          f.classList.remove('shake');
          void f.offsetWidth;
          f.classList.add('shake');
        }
      });
    };
    render();
  });
}

async function hello(root, name, isNew) {
  root.innerHTML = `<div class="boot-stage">
    <div class="hello"><span class="hello-w">${isNew ? 'HELLO' : 'WELCOME BACK'},</span>
    <span class="hello-n glitch" data-text="${esc(name)}"></span></div></div>`;
  const n = $('.hello-n', root);
  await wait(450);
  for (let i = 0; i < name.length; i++) {
    n.textContent = name.slice(0, i + 1);
    n.dataset.text = n.textContent;
    sfx.type();
    await wait(70);
  }
  n.textContent = name;
  n.dataset.text = name;
  await wait(1100);
}

async function loading(root, isNew) {
  const steps = [
    'DOWNLOADING NEEDED DATA',
    'CONFIGURING SETTINGS',
    isNew ? 'BUILDING PLAYER PROFILE' : 'SYNCING PLAYER PROFILE',
    'LOADING COSMETICS',
    'WARMING UP CARTRIDGES',
    'CALIBRATING NEON',
  ];
  root.innerHTML = `<div class="boot-stage">
    <div class="load">
      <div class="load-msg">INITIALIZING</div>
      <div class="load-bar"><i></i></div>
      <div class="load-pct">0%</div>
      <div class="load-list"></div>
    </div></div>`;
  const msg = $('.load-msg', root);
  const bar = $('.load-bar i', root);
  const pct = $('.load-pct', root);
  const list = $('.load-list', root);
  for (let i = 0; i < steps.length; i++) {
    msg.textContent = steps[i] + '...';
    sfx.type();
    const from = (i / steps.length) * 100;
    const to = ((i + 1) / steps.length) * 100;
    for (let p = from; p <= to; p += 4) {
      bar.style.width = p + '%';
      pct.textContent = Math.round(p) + '%';
      await wait(18);
    }
    const li = document.createElement('div');
    li.innerHTML = `<b>✓</b> ${steps[i]}`;
    list.appendChild(li);
    await wait(110);
  }
  bar.style.width = '100%';
  pct.textContent = '100%';
  msg.textContent = 'READY';
  sfx.ok();
  await wait(450);
}

// Runs the whole sequence; resolves with the logged-in player.
export async function runBoot() {
  const root = $('#boot');
  root.classList.remove('hidden');
  skipping = false;

  let current = await api.me();
  applyIntro(current);
  const short = current?.settings?.intro === 'short';

  if (!short) {
    await pressStart(root);
    const skipBtn = document.createElement('button');
    skipBtn.className = 'boot-skip';
    skipBtn.textContent = 'SKIP ▸▸';
    skipBtn.onclick = () => (skipping = true);
    document.body.appendChild(skipBtn);
    await bootLog(root);
    let isNew = false;
    if (!current) {
      skipBtn.hidden = true;
      skipping = false;
      ({ u: current, isNew } = await authPanel(root));
      applyIntro(current);
      skipBtn.hidden = false;
    }
    await hello(root, current.username, isNew);
    await loading(root, isNew);
    skipBtn.remove();
  } else {
    if (!current) {
      await pressStart(root);
      ({ u: current } = await authPanel(root));
    }
    root.innerHTML = `<div class="boot-stage"><div class="hello"><span class="hello-w">WELCOME BACK,</span><span class="hello-n">${esc(current.username)}</span></div></div>`;
    await sleep(700);
  }

  store.set(current);
  sfx.whoosh();
  root.classList.add('out');
  await sleep(700);
  root.classList.add('hidden');
  root.classList.remove('out');
  root.innerHTML = '';
  return current;
}
