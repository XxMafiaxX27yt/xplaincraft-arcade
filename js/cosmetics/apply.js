// Applies the player's look to the whole page: cursor, UI theme, click effects, sound pack.
import { find } from './catalog.js';
import { PAL } from './palettes.js';
import { cursorCSS, eqOf } from './render.js';
import { setSoundPack } from '../sfx.js';

let clickKind = null;
let clickPal = null;

export function applyLook(eq) {
  eq = eqOf(eq);
  const r = document.documentElement.style;
  const css = cursorCSS(eq.cursor);
  r.setProperty('--cur', css || 'auto');
  r.setProperty('--cur-ptr', css || 'pointer');

  const th = find('theme', eq.theme);
  const p = th && th.pal && PAL[th.pal];
  if (p) {
    // keep text readable: accent 2 must be bright, button text flips dark on light colors
    const bright = [p.c2, p.c3, p.c1].find((c) => lum(c) > 0.35) || '#22e6ff';
    r.setProperty('--mag', p.c1);
    r.setProperty('--cyan', bright === p.c1 && lum(p.c1) > 0.8 ? p.c1 : bright);
    r.setProperty('--vio', `color-mix(in srgb, ${p.c1} 55%, #1a0b3a)`);
    r.setProperty('--on-mag', lum(p.c1) > 0.55 ? '#0b0820' : '#ffffff');
  } else {
    ['--mag', '--cyan', '--vio', '--on-mag'].forEach((k) => r.removeProperty(k));
  }

  const c = find('click', eq.click);
  clickKind = c && c.kind ? c.kind : null;
  clickPal = c && c.pal ? PAL[c.pal] : null;

  setSoundPack(find('sound', eq.sound)?.pack || 'synth');
}

// relative brightness 0..1 of a #rrggbb color
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const R = (a, b) => a + Math.random() * (b - a);

// One particle: element styled by `css`, moved by keyframes `kf` (Web Animations).
function part(x, y, css, html, kf, dur, delay = 0, ease = 'cubic-bezier(.2,.7,.3,1)') {
  const s = document.createElement('i');
  s.className = 'cfx';
  s.style.cssText = `left:${x}px;top:${y}px;${css}`;
  if (html) s.innerHTML = html;
  document.body.appendChild(s);
  s.animate(kf, { duration: dur, delay, easing: ease, fill: 'both' }).onfinish = () => s.remove();
}
const T = (dx, dy, r = 0, sc = 1) => `translate(${dx}px,${dy}px) rotate(${r}deg) scale(${sc})`;

// Each click effect has its own shape AND its own motion.
const FX = {
  // thin hot streaks shooting out fast
  sparks(x, y, c) {
    for (let i = 0; i < 12; i++) {
      const a = (360 / 12) * i + R(-8, 8);
      const d = R(30, 60);
      part(x, y, `width:2px;height:${R(10, 18)}px;border-radius:2px;background:${c[i % 3]};box-shadow:0 0 6px ${c[i % 3]};transform-origin:50% 100%`, '',
        [{ transform: `rotate(${a}deg) translateY(0) scaleY(.3)`, opacity: 1 }, { transform: `rotate(${a}deg) translateY(${-d}px) scaleY(1)`, opacity: 1, offset: 0.5 }, { transform: `rotate(${a}deg) translateY(${-d * 1.3}px) scaleY(.2)`, opacity: 0 }], 420);
    }
  },
  // a few hearts float UP slowly, swaying
  hearts(x, y, c) {
    for (let i = 0; i < 5; i++) {
      const dx = R(-30, 30);
      part(x, y, `color:${c[i % 3]};font-size:${R(14, 24)}px;text-shadow:0 0 8px ${c[i % 3]};margin:-12px 0 0 -8px`, '♥',
        [{ transform: T(0, 0, 0, 0.3), opacity: 0 }, { transform: T(dx * 0.4, -20, -10, 1), opacity: 1, offset: 0.25 }, { transform: T(dx, -50, 10, 1), opacity: 0.9, offset: 0.6 }, { transform: T(dx * 0.6, -80, -8, 0.8), opacity: 0 }], 1200, i * 70, 'ease-out');
    }
  },
  // stars pop out, spin and twinkle in place
  stars(x, y, c) {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6;
      const d = R(24, 38);
      part(x, y, `color:${c[i % 3]};font-size:${R(12, 20)}px;text-shadow:0 0 10px ${c[i % 3]};margin:-10px 0 0 -7px`, '★',
        [{ transform: T(0, 0, 0, 0), opacity: 1 }, { transform: T(Math.cos(a) * d, Math.sin(a) * d, 180, 1.3), opacity: 1, offset: 0.4 }, { transform: T(Math.cos(a) * d, Math.sin(a) * d, 360, 0.6), opacity: 0.3, offset: 0.7 }, { transform: T(Math.cos(a) * d, Math.sin(a) * d, 400, 1), opacity: 0 }], 800);
    }
  },
  // chunky 8-bit squares burst then FALL with gravity, moving in steps
  pixels(x, y, c) {
    for (let i = 0; i < 10; i++) {
      const dx = R(-45, 45);
      const up = R(-50, -20);
      part(x, y, `width:7px;height:7px;background:${c[i % 3]};image-rendering:pixelated`, '',
        [{ transform: T(0, 0), opacity: 1 }, { transform: T(dx * 0.6, up), opacity: 1, offset: 0.35 }, { transform: T(dx, up + 70), opacity: 0 }], 700, 0, 'steps(7)');
    }
  },
  // 3 rings grow outward from the cursor, one after another
  rings(x, y, c) {
    for (let i = 0; i < 3; i++) {
      part(x, y, `width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:2px solid ${c[i % 3]};box-shadow:0 0 8px ${c[i % 3]}`, '',
        [{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(4.5)', opacity: 0 }], 650, i * 110, 'ease-out');
    }
  },
  // coins jump up, flip, then drop out of sight
  coins(x, y, c) {
    for (let i = 0; i < 5; i++) {
      const dx = R(-40, 40);
      part(x, y, `width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,${c[0]} 50%,${c[1]});box-shadow:0 0 6px ${c[0]}`, '',
        [{ transform: `translate(0,0) scaleX(1)`, opacity: 1 }, { transform: `translate(${dx * 0.5}px,-55px) scaleX(-1)`, opacity: 1, offset: 0.4 }, { transform: `translate(${dx * 0.8}px,-40px) scaleX(1)`, opacity: 1, offset: 0.6 }, { transform: `translate(${dx}px,40px) scaleX(-1)`, opacity: 0 }], 900, i * 40, 'cubic-bezier(.3,.6,.6,1)');
    }
  },
  // jagged lightning lines crack out from the click
  bolts(x, y, c) {
    for (let i = 0; i < 4; i++) {
      const a = 90 * i + R(-25, 25);
      const pts = [0, 0];
      let px = 0, py = 0;
      for (let k = 0; k < 4; k++) pts.push((px += R(-8, 8)), (py -= R(9, 14)));
      part(x, y, `width:40px;height:60px;margin:-60px 0 0 -20px;transform-origin:50% 100%;filter:drop-shadow(0 0 4px ${c[i % 3]})`,
        `<svg width="40" height="60" viewBox="-20 -60 40 60"><polyline points="${pts.join(' ')}" fill="none" stroke="${c[i % 3]}" stroke-width="2.5" stroke-linejoin="bevel"/></svg>`,
        [{ transform: `rotate(${a}deg) scale(.2)`, opacity: 1 }, { transform: `rotate(${a}deg) scale(1)`, opacity: 1, offset: 0.2 }, { opacity: 0.2, offset: 0.4 }, { opacity: 1, offset: 0.55 }, { transform: `rotate(${a}deg) scale(1.1)`, opacity: 0 }], 450, 0, 'linear');
    }
  },
  // hollow bubbles of different sizes rise and POP
  bubbles(x, y, c) {
    for (let i = 0; i < 6; i++) {
      const sz = R(8, 18);
      const dx = R(-25, 25);
      part(x, y, `width:${sz}px;height:${sz}px;margin:${-sz / 2}px 0 0 ${-sz / 2}px;border-radius:50%;border:2px solid ${c[i % 3]};background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.6) 0 15%,transparent 20%)`, '',
        [{ transform: T(0, 0, 0, 0.3), opacity: 1 }, { transform: T(dx * 0.5, -30, 0, 1), opacity: 1, offset: 0.5 }, { transform: T(dx, -60, 0, 1), opacity: 1, offset: 0.85 }, { transform: T(dx, -62, 0, 1.6), opacity: 0 }], R(800, 1100), i * 60, 'ease-out');
    }
  },
  // colorful paper strips spray up wide, then flutter down slowly
  confetti(x, y, c) {
    for (let i = 0; i < 16; i++) {
      const dx = R(-80, 80);
      const up = R(-90, -40);
      part(x, y, `width:${R(4, 7)}px;height:${R(8, 13)}px;background:${c[i % 3]}`, '',
        [{ transform: T(0, 0, 0), opacity: 1 }, { transform: T(dx * 0.6, up, R(180, 360)), opacity: 1, offset: 0.3 }, { transform: T(dx, up + 120, R(540, 900)), opacity: 0 }], R(1100, 1500), 0, 'cubic-bezier(.15,.6,.4,1)');
    }
  },
  // one big skull grins and fades while small ghosts drift up
  skulls(x, y, c) {
    part(x, y, `font-size:30px;color:${c[0]};text-shadow:0 0 12px ${c[0]};margin:-18px 0 0 -12px`, '☠',
      [{ transform: 'scale(.2) rotate(-20deg)', opacity: 0 }, { transform: 'scale(1.2) rotate(8deg)', opacity: 1, offset: 0.3 }, { transform: 'scale(1) rotate(0)', opacity: 1, offset: 0.6 }, { transform: 'scale(1.4)', opacity: 0 }], 800, 0, 'ease-out');
    for (let i = 0; i < 3; i++) {
      const dx = (i - 1) * 26;
      part(x, y, `font-size:13px;color:${c[1 + (i % 2)]};opacity:.8;margin:-8px 0 0 -6px`, '👻',
        [{ transform: T(0, 0, 0, 0.4), opacity: 0 }, { transform: T(dx, -40, 0, 1), opacity: 0.8, offset: 0.5 }, { transform: T(dx * 1.3, -75, 0, 0.8), opacity: 0 }], 1000, 150, 'ease-out');
    }
  },
};

export function burst(x, y, kind = clickKind, pal = clickPal) {
  if (!kind || !FX[kind] || document.body.classList.contains('reduced')) return;
  FX[kind](x, y, pal ? [pal.c1, pal.c2, pal.c3] : ['#ff2bd6', '#22e6ff', '#f6ff3a']);
}

// shop previews play their effect when hovered
let lastHover = null;
document.addEventListener('pointerover', (e) => {
  const demo = e.target.closest?.('[data-click-demo]');
  if (!demo || demo === lastHover) return;
  lastHover = demo;
  setTimeout(() => lastHover === demo && (lastHover = null), 900);
  const it = find('click', demo.dataset.clickDemo);
  const r = demo.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, it.kind, PAL[it.pal]);
});

document.addEventListener('pointerdown', (e) => {
  const demo = e.target.closest?.('[data-click-demo]');
  if (demo) {
    const it = find('click', demo.dataset.clickDemo);
    burst(e.clientX, e.clientY, it.kind, PAL[it.pal]);
    return;
  }
  if (clickKind && !e.target.closest('input, textarea')) burst(e.clientX, e.clientY);
});
