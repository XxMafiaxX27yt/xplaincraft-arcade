// Drawing every cosmetic: avatars, frames, pets, cursors, banners, callsigns, titles, badges, stickers.
import { ITEM, find, DEFAULT_EQUIP, RARITY } from './catalog.js';
import { PAL } from './palettes.js';
import { ensureFont } from './fonts.js';
import { esc } from '../util.js';

const pv = (pid, pre = 'c') => {
  const p = PAL[pid];
  return p ? `--${pre}1:${p.c1};--${pre}2:${p.c2};--${pre}3:${p.c3};--${pre}d:${p.d};` : '';
};
const fxc = (pid) => (PAL[pid]?.fx ? `pfx-${PAL[pid].fx}` : '');
export const eqOf = (eq) => ({ ...DEFAULT_EQUIP, ...(eq || {}) });

// ---------- avatar ----------
function skinSVG(style, pid) {
  const p = PAL[pid] || PAL.neon;
  const B = p.d, T = p.c2, G = p.c1, A = p.c3;
  const H = `<rect x="14" y="18" width="36" height="27" rx="11" fill="${B}" stroke="${T}" stroke-width="3"/>`;
  const sh = `<path d="M8 64c2-12 12-17 24-17s22 5 24 17z" fill="${T}"/><path d="M20 64c1-6 6-9 12-9s11 3 12 9z" fill="${B}"/>`;
  const f = {
    visor: `${H}<rect x="18" y="27" width="28" height="8" rx="4" fill="${G}"/><rect x="20" y="28.5" width="8" height="2" rx="1" fill="#fff" opacity=".7"/>`,
    eyes: `${H}<ellipse cx="25" cy="31" rx="4" ry="5" fill="${G}"/><ellipse cx="39" cy="31" rx="4" ry="5" fill="${G}"/>`,
    skull: `<path d="M16 31a16 16 0 0 1 32 0v6l-4 3v5H20v-5l-4-3z" fill="${G}" stroke="${T}" stroke-width="2"/><circle cx="25" cy="31" r="5" fill="${B}"/><circle cx="39" cy="31" r="5" fill="${B}"/><circle cx="25" cy="31" r="1.7" fill="${A}"/><circle cx="39" cy="31" r="1.7" fill="${A}"/><path d="M32 36l-2 4h4z" fill="${B}"/><path d="M24 45v-3M28 45v-3M32 45v-3M36 45v-3M40 45v-3" stroke="${B}" stroke-width="1.5"/>`,
    cat: `<path d="M15 24l4-12 9 8M49 24l-4-12-9 8" fill="${B}" stroke="${T}" stroke-width="3" stroke-linejoin="round"/>${H}<path d="M21 31q4-4 8 0M35 31q4-4 8 0" stroke="${G}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M29 37q3 3 6 0" stroke="${A}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    cube: `<rect x="13" y="15" width="38" height="31" rx="3" fill="${B}" stroke="${T}" stroke-width="3"/><rect x="17" y="19" width="30" height="23" fill="#05080c"/><rect x="22" y="24" width="4" height="6" fill="${G}"/><rect x="38" y="24" width="4" height="6" fill="${G}"/><path d="M24 34h16v2H24z" fill="${G}"/><path d="M26 46h12v3H26z" fill="${T}"/>`,
    ghost: `<path d="M14 58V30a18 18 0 0 1 36 0v28l-6-5-6 5-6-5-6 5-6-5z" fill="${G}" opacity=".95"/><ellipse cx="26" cy="30" rx="3.5" ry="5" fill="${B}"/><ellipse cx="38" cy="30" rx="3.5" ry="5" fill="${B}"/><ellipse cx="32" cy="41" rx="3" ry="4" fill="${B}"/>`,
    pumpkin: `<path d="M31 14q1-5 5-6" stroke="${T}" stroke-width="3" fill="none"/><ellipse cx="22" cy="32" rx="10" ry="14" fill="${G}"/><ellipse cx="42" cy="32" rx="10" ry="14" fill="${G}"/><ellipse cx="32" cy="32" rx="11" ry="15" fill="${G}" stroke="${B}" stroke-opacity=".3" stroke-width="2"/><path d="M22 28l5-5 4 5zM33 28l5-5 4 5z" fill="${A}"/><path d="M21 37l4 4 3-3 4 4 4-4 3 3 4-4-3 6H24z" fill="${A}"/>`,
    alien: `<path d="M32 12c13 0 19 9 19 18 0 10-10 20-19 20s-19-10-19-20c0-9 6-18 19-18z" fill="${G}" opacity=".9"/><path d="M18 30c4-4 9-3 11 2-3 5-9 5-11-2zM46 30c-4-4-9-3-11 2 3 5 9 5 11-2z" fill="${B}"/><circle cx="22" cy="30" r="1.3" fill="#fff"/><circle cx="42" cy="30" r="1.3" fill="#fff"/><path d="M29 42q3 1.5 6 0" stroke="${B}" stroke-width="1.5" fill="none"/>`,
    ninja: `${H}<rect x="14" y="33" width="36" height="12" rx="6" fill="${T}"/><rect x="17" y="26" width="30" height="6" rx="3" fill="#05050a"/><path d="M21 29h6M37 29h6" stroke="${G}" stroke-width="2.5" stroke-linecap="round"/><path d="M50 22l8-3-5 6 6 1-8 2" fill="${A}"/><rect x="14" y="20" width="36" height="4" fill="${A}"/>`,
    gasmask: `${H}<circle cx="24" cy="29" r="6" fill="${G}" stroke="${T}" stroke-width="2.5"/><circle cx="40" cy="29" r="6" fill="${G}" stroke="${T}" stroke-width="2.5"/><circle cx="32" cy="42" r="7" fill="${T}"/><path d="M28 40h8M28 43h8" stroke="${B}" stroke-width="1.5"/><circle cx="22" cy="27" r="1.6" fill="#fff" opacity=".7"/>`,
    astro: `<path d="M32 8v5" stroke="${T}" stroke-width="2"/><circle cx="32" cy="7" r="2.5" fill="${A}"/><circle cx="32" cy="31" r="19" fill="${T}"/><circle cx="32" cy="31" r="14.5" fill="${B}"/><path d="M21 27a12 12 0 0 1 14-9" stroke="${G}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="38" cy="36" r="2" fill="${G}" opacity=".6"/>`,
    demon: `<path d="M17 22c-6-6-5-13-3-16 1 6 5 9 9 10zM47 22c6-6 5-13 3-16-1 6-5 9-9 10z" fill="${A}"/>${H}<path d="M20 28l9 3-9 2zM44 28l-9 3 9 2z" fill="${G}"/><path d="M26 39q6 4 12 0" stroke="${G}" stroke-width="2" fill="none"/><path d="M28 39l1 3 1-3M34 39l1 3 1-3" fill="#fff"/>`,
    angel: `<ellipse cx="32" cy="10" rx="12" ry="3.5" fill="none" stroke="${G}" stroke-width="3"/>${H}<path d="M21 31q4-3 8 0M35 31q4-3 8 0" stroke="${G}" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="21" cy="37" r="2.5" fill="${A}" opacity=".5"/><circle cx="43" cy="37" r="2.5" fill="${A}" opacity=".5"/>`,
    robot: `<path d="M32 9v8" stroke="${T}" stroke-width="2"/><circle cx="32" cy="8" r="3" fill="${G}"/><rect x="13" y="17" width="38" height="29" rx="4" fill="${B}" stroke="${T}" stroke-width="3"/><rect x="19" y="24" width="9" height="7" rx="1.5" fill="${G}"/><rect x="36" y="24" width="9" height="7" rx="1.5" fill="${G}"/><path d="M22 38h20M22 41h20M26 36v7M32 36v7M38 36v7" stroke="${T}" stroke-width="1.5"/><rect x="9" y="26" width="4" height="10" rx="1" fill="${A}"/><rect x="51" y="26" width="4" height="10" rx="1" fill="${A}"/>`,
    bear: `<circle cx="17" cy="18" r="7" fill="${B}" stroke="${T}" stroke-width="3"/><circle cx="47" cy="18" r="7" fill="${B}" stroke="${T}" stroke-width="3"/><circle cx="17" cy="18" r="3" fill="${A}"/><circle cx="47" cy="18" r="3" fill="${A}"/>${H}<ellipse cx="32" cy="37" rx="7" ry="5" fill="${T}"/><ellipse cx="32" cy="35" rx="2.5" ry="1.8" fill="${B}"/><circle cx="24" cy="29" r="2.5" fill="${G}"/><circle cx="40" cy="29" r="2.5" fill="${G}"/>`,
    bunny: `<ellipse cx="23" cy="10" rx="5" ry="12" fill="${B}" stroke="${T}" stroke-width="3"/><ellipse cx="41" cy="10" rx="5" ry="12" fill="${B}" stroke="${T}" stroke-width="3"/><ellipse cx="23" cy="10" rx="2" ry="8" fill="${A}"/><ellipse cx="41" cy="10" rx="2" ry="8" fill="${A}"/>${H}<circle cx="25" cy="30" r="3" fill="${G}"/><circle cx="39" cy="30" r="3" fill="${G}"/><path d="M30 37l2 2 2-2" stroke="${A}" stroke-width="2" fill="none"/>`,
    fox: `<path d="M14 26l2-16 12 10M50 26l-2-16-12 10" fill="${G}" stroke="${T}" stroke-width="2" stroke-linejoin="round"/>${H}<path d="M20 33l12 12 12-12-12 3z" fill="${A}"/><circle cx="32" cy="42" r="2" fill="${B}"/><path d="M21 28l6 2M43 28l-6 2" stroke="${G}" stroke-width="3" stroke-linecap="round"/>`,
    frog: `<circle cx="21" cy="19" r="7" fill="${G}"/><circle cx="43" cy="19" r="7" fill="${G}"/><circle cx="21" cy="19" r="3.5" fill="${B}"/><circle cx="43" cy="19" r="3.5" fill="${B}"/><ellipse cx="32" cy="33" rx="20" ry="13" fill="${G}"/><path d="M19 36q13 9 26 0" stroke="${B}" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="26" cy="31" r="1" fill="${B}"/><circle cx="38" cy="31" r="1" fill="${B}"/><circle cx="23" cy="38" r="2" fill="${A}" opacity=".6"/><circle cx="41" cy="38" r="2" fill="${A}" opacity=".6"/>`,
    crown: `<path d="M17 18l3-11 6 6 6-9 6 9 6-6 3 11z" fill="${A}" stroke="${T}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="32" cy="12" r="1.8" fill="${G}"/>${H}<rect x="18" y="28" width="28" height="7" rx="3.5" fill="${G}"/>`,
    wizard: `<path d="M12 22h40l-6-3L36 0 26 19z" fill="${T}"/><path d="M14 20h36" stroke="${G}" stroke-width="3"/><path d="M33 9l1.5 3 3 .5-2.2 2 .6 3-2.9-1.5-2.9 1.5.6-3-2.2-2 3-.5z" fill="${A}"/><rect x="15" y="21" width="34" height="24" rx="10" fill="#07060c"/><ellipse cx="25" cy="31" rx="3" ry="2" fill="${G}"/><ellipse cx="39" cy="31" rx="3" ry="2" fill="${G}"/><path d="M22 40l10 9 10-9" fill="${A}" opacity=".8"/>`,
    headphones: `${H}<rect x="18" y="27" width="28" height="8" rx="4" fill="${G}"/><path d="M12 30a20 20 0 0 1 40 0" stroke="${T}" stroke-width="4" fill="none"/><rect x="7" y="26" width="9" height="15" rx="4" fill="${A}"/><rect x="48" y="26" width="9" height="15" rx="4" fill="${A}"/>`,
    slime: `<path d="M12 46c0-20 8-32 20-32s20 12 20 32c0 3-3 4-5 2-1 5-5 5-6 1-2 4-6 4-7 0-2 4-6 4-8 0-2 2-5 1-5-1-3 2-9 2-9-2z" fill="${G}" opacity=".9"/><ellipse cx="25" cy="31" rx="4" ry="5" fill="#fff"/><ellipse cx="39" cy="31" rx="4" ry="5" fill="#fff"/><circle cx="26" cy="32" r="2.2" fill="${B}"/><circle cx="40" cy="32" r="2.2" fill="${B}"/><ellipse cx="22" cy="22" rx="3" ry="2" fill="#fff" opacity=".5"/>`,
    cyclops: `${H}<circle cx="32" cy="30" r="9" fill="#f4f2ff" stroke="${T}" stroke-width="2"/><circle cx="32" cy="30" r="5" fill="${G}"/><circle cx="32" cy="30" r="2.2" fill="${B}"/><circle cx="34" cy="28" r="1.2" fill="#fff"/><path d="M26 41h12" stroke="${A}" stroke-width="2" stroke-linecap="round"/>`,
    plague: `<path d="M12 46c0-24 9-34 20-34s20 10 20 34z" fill="${B}" stroke="${T}" stroke-width="2"/><path d="M22 32c6 0 10 2 10 6l-2 22c-4-8-10-16-14-22 0-4 2-6 6-6z" fill="${A}"/><circle cx="24" cy="27" r="5" fill="${G}" stroke="${T}" stroke-width="2"/><circle cx="40" cy="27" r="5" fill="${G}" stroke="${T}" stroke-width="2"/>`,
    knight: `<path d="M40 14c4-8 12-8 14-6-5 1-8 4-10 8z" fill="${G}"/><path d="M14 46V28c0-10 8-16 18-16s18 6 18 16v18z" fill="${T}" stroke="${B}" stroke-width="1.5"/><rect x="18" y="27" width="28" height="5" rx="1" fill="#05050a"/><path d="M20 29.5h24" stroke="${G}" stroke-width="2"/><path d="M32 33v12M27 36v6M37 36v6" stroke="${B}" stroke-width="1.5"/>`,
  }[style] || '';
  return `<svg viewBox="0 0 64 64" class="av-svg ${fxc(pid)}" xmlns="http://www.w3.org/2000/svg">${sh}${f}</svg>`;
}

// ---------- pets ----------
function petSVG(kind, pid) {
  const p = PAL[pid] || PAL.neon;
  const G = p.c1, T = p.c2, A = p.c3, D = p.d;
  const eyes = (y = 20, dx = 5, c = D) => `<circle cx="${20 - dx}" cy="${y}" r="2" fill="${c}"/><circle cx="${20 + dx}" cy="${y}" r="2" fill="${c}"/>`;
  const body = {
    blob: `<path d="M6 32c0-14 6-22 14-22s14 8 14 22z" fill="${G}"/>${eyes(22)}<ellipse cx="14" cy="16" rx="3" ry="2" fill="#fff" opacity=".5"/>`,
    cat: `<path d="M9 16l2-9 6 6M31 16l-2-9-6 6" fill="${G}"/><ellipse cx="20" cy="22" rx="12" ry="11" fill="${G}"/>${eyes(21)}<path d="M18 26l2 1.5 2-1.5" stroke="${D}" fill="none"/><path d="M32 30q6-2 4-10" stroke="${G}" stroke-width="3" fill="none"/>`,
    ghost: `<path d="M8 34V18a12 12 0 0 1 24 0v16l-4-3-4 3-4-3-4 3-4-3z" fill="${G}" opacity=".9"/>${eyes(18, 4)}<ellipse cx="20" cy="25" rx="2" ry="2.6" fill="${D}"/>`,
    bot: `<path d="M20 4v5" stroke="${T}" stroke-width="2"/><circle cx="20" cy="4" r="2" fill="${A}"/><rect x="8" y="9" width="24" height="20" rx="4" fill="${T}"/><rect x="11" y="13" width="18" height="9" rx="2" fill="${D}"/><rect x="14" y="16" width="3" height="3" fill="${G}"/><rect x="23" y="16" width="3" height="3" fill="${G}"/><rect x="12" y="29" width="4" height="5" fill="${T}"/><rect x="24" y="29" width="4" height="5" fill="${T}"/>`,
    bat: `<path d="M20 14c-6-8-16-6-18 2 4-2 7 0 8 3 2-2 5-2 6 1 1-3 3-4 4-4s3 1 4 4c1-3 4-3 6-1 1-3 4-5 8-3-2-8-12-10-18-2z" fill="${G}"/><ellipse cx="20" cy="20" rx="7" ry="8" fill="${G}"/>${eyes(19, 3, A)}<path d="M18 24l1 2 1-2 1 2 1-2" stroke="#fff" stroke-width=".8" fill="none"/>`,
    fox: `<path d="M8 18l1-12 8 7M32 18l-1-12-8 7" fill="${G}"/><path d="M8 18c0 10 6 16 12 16s12-6 12-16c0-5-6-8-12-8S8 13 8 18z" fill="${G}"/><path d="M12 22l8 10 8-10-8 2z" fill="#fff" opacity=".85"/>${eyes(19, 5)}<circle cx="20" cy="30" r="1.5" fill="${D}"/>`,
    owl: `<path d="M8 12l5 4M32 12l-5 4" stroke="${T}" stroke-width="3"/><ellipse cx="20" cy="22" rx="13" ry="13" fill="${T}"/><ellipse cx="20" cy="26" rx="8" ry="8" fill="${A}" opacity=".35"/><circle cx="14" cy="19" r="5" fill="#fff"/><circle cx="26" cy="19" r="5" fill="#fff"/><circle cx="14" cy="19" r="2.5" fill="${G}"/><circle cx="26" cy="19" r="2.5" fill="${G}"/><path d="M18 23l2 3 2-3z" fill="${A}"/>`,
    dragon: `<path d="M10 10l4 6M30 10l-4 6" stroke="${A}" stroke-width="3" stroke-linecap="round"/><path d="M4 22c4-2 6-6 8-4M36 22c-4-2-6-6-8-4" stroke="${T}" stroke-width="3" fill="none"/><ellipse cx="20" cy="22" rx="11" ry="10" fill="${G}"/><ellipse cx="20" cy="27" rx="6" ry="4" fill="${A}" opacity=".7"/>${eyes(19, 4)}<path d="M17 27h1M22 27h1" stroke="${D}" stroke-width="1.5"/>`,
    slime: `<path d="M6 33c0-12 6-20 14-20s14 8 14 20c-2 2-4 0-5-1-1 3-4 3-5 0-1 3-5 3-6 0-1 3-4 3-5 0-1 2-5 3-7 1z" fill="${G}" opacity=".85"/>${eyes(24, 4)}`,
    jelly: `<path d="M8 20a12 12 0 0 1 24 0z" fill="${G}" opacity=".9"/><path d="M11 20v10M16 20v13M20 20v9M24 20v13M29 20v10" stroke="${A}" stroke-width="2" stroke-linecap="round" class="pet-wave"/>${eyes(15, 4)}`,
    bunny: `<ellipse cx="15" cy="9" rx="3" ry="8" fill="${G}"/><ellipse cx="25" cy="9" rx="3" ry="8" fill="${G}"/><ellipse cx="20" cy="25" rx="11" ry="10" fill="${G}"/>${eyes(23, 4)}<circle cx="20" cy="27" r="1.4" fill="${A}"/>`,
    chick: `<circle cx="20" cy="22" r="12" fill="${G}"/><path d="M17 8q3-4 3 2q2-5 4 0" stroke="${G}" stroke-width="2" fill="none"/>${eyes(20, 4)}<path d="M18 24l2 3 2-3z" fill="${A}"/><path d="M8 24q-4 0-2 4M32 24q4 0 2 4" stroke="${G}" stroke-width="3" fill="none"/>`,
    fish: `<path d="M30 20l8-7v14z" fill="${T}"/><ellipse cx="18" cy="20" rx="14" ry="10" fill="${G}"/><circle cx="11" cy="18" r="2.5" fill="#fff"/><circle cx="11" cy="18" r="1.2" fill="${D}"/><path d="M17 12q4 8 0 16" stroke="${A}" stroke-width="2" fill="none"/>`,
    eye: `<path d="M20 4v6M8 8l4 5M32 8l-4 5" stroke="${T}" stroke-width="2"/><circle cx="20" cy="22" r="12" fill="#f4f2ff" stroke="${T}" stroke-width="2"/><circle cx="20" cy="22" r="6" fill="${G}"/><circle cx="20" cy="22" r="2.6" fill="${D}"/><circle cx="22" cy="20" r="1.2" fill="#fff"/>`,
    star: `<path d="M20 4l4.5 10 11 1-8.3 7.5 2.5 11L20 28l-9.7 5.5 2.5-11L4.5 15l11-1z" fill="${G}" stroke="${A}" stroke-width="1.2" stroke-linejoin="round"/>${eyes(18, 4)}<path d="M18 22q2 2 4 0" stroke="${D}" fill="none"/>`,
  }[kind] || '';
  return `<svg viewBox="0 0 40 40" class="pet-svg ${fxc(pid)}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

export function avatarHTML(eq, size = 44, extra = '', withPet = false) {
  eq = eqOf(eq);
  const s = find('skin', eq.skin);
  const fr = find('frame', eq.frame);
  const frameCls = fr.id === 'none' ? 'fr-none' : `fr-${fr.style} ${PAL[fr.pal]?.fx ? 'ffx-' + PAL[fr.pal].fx : ''}`;
  const av = `<span class="av ${frameCls} ${extra}" style="--s:${size}px;${fr.pal ? pv(fr.pal, 'f') : ''}">${skinSVG(s.style, s.pal)}</span>`;
  if (!withPet) return av;
  const pet = find('pet', eq.pet);
  return `<span class="avw" style="--s:${size}px">${av}${pet.id !== 'none' ? `<span class="pet">${petSVG(pet.kind, pet.pal)}</span>` : ''}</span>`;
}

// ---------- callsign / title ----------
export function callsignHTML(name, eq, cls = '') {
  eq = eqOf(eq);
  const f = find('font', eq.font);
  ensureFont(f.family);
  const np = find('nameplate', eq.nameplate);
  const ef = find('effect', eq.effect);
  const npc = np.id === 'none' ? 'np-none' : `np-${np.style}`;
  const efc = ef.id === 'none' ? '' : `ne-${ef.fx}`;
  return `<span class="cs ${npc} ${efc} ${cls}" data-t="${esc(name)}" style="font-family:'${f.family}';--fs:${f.scale || 1};${np.pal ? pv(np.pal, 'p') : ''}${ef.pal ? pv(ef.pal, 'e') : ''}"><b class="cs-t" data-t="${esc(name)}">${esc(name)}</b></span>`;
}

export function titleHTML(eq, cls = '') {
  const t = find('title', eqOf(eq).title);
  if (!t || t.id === 'none') return '';
  return `<span class="ttl ${cls}" style="--r:${RARITY[t.rarity].color}">${esc(t.text)}</span>`;
}

// ---------- banner / backdrop ----------
export function sceneAttrs(item) {
  if (!item || !item.scene) return { cls: 'bn', style: '' };
  return { cls: `bn bs-${item.scene} ${PAL[item.pal]?.fx ? 'bfx-' + PAL[item.pal].fx : ''}`, style: pv(item.pal) };
}
export function bannerHTML(eq, cls = '') {
  const a = sceneAttrs(find('banner', eqOf(eq).banner));
  return `<div class="${a.cls} ${cls}" style="${a.style}"></div>`;
}

// ---------- badges + stickers ----------
export function badgeHTML(id, size = 34) {
  const b = ITEM['badge:' + id];
  if (!b) return '';
  return `<span class="bdg ${fxc(b.pal)}" title="${esc(b.name)}" style="--s:${size}px;${pv(b.pal)}"><i>${b.icon}</i></span>`;
}
export function stickerHTML(id, size = 46) {
  const s = ITEM['sticker:' + id];
  if (!s) return '';
  return `<span class="stk" title="${esc(s.name)}" style="--s:${size}px;--r:${RARITY[s.rarity].color}">${s.emoji}</span>`;
}

// ---------- cursors ----------
function cursorSVG(shape, pid) {
  const p = PAL[pid] || PAL.neon;
  const G = p.c1, T = p.c2, A = p.c3, D = '#0b0a1a';
  const s = {
    arrow: [`<path d="M3 2v23l6-6 4 9 4-2-4-9h8z" fill="${D}" stroke="${G}" stroke-width="2" stroke-linejoin="round"/><path d="M6 8v10" stroke="${A}" stroke-width="2"/>`, 3, 2],
    cross: [`<circle cx="16" cy="16" r="9" fill="none" stroke="${G}" stroke-width="2"/><path d="M16 1v9M16 22v9M1 16h9M22 16h9" stroke="${G}" stroke-width="2"/><circle cx="16" cy="16" r="1.8" fill="${A}"/>`, 16, 16],
    dot: [`<circle cx="16" cy="16" r="12" fill="${G}" opacity=".18"/><circle cx="16" cy="16" r="8" fill="${G}" opacity=".35"/><circle cx="16" cy="16" r="4.5" fill="#fff"/>`, 16, 16],
    pixel: [`<path d="M3 3h3v3h3v3h3v3h3v3h3v3h-6v3h3v3h-3v3h-3v-3h-3v3H3z" fill="${G}" stroke="${D}" stroke-width="1" shape-rendering="crispEdges"/>`, 3, 3],
    star: [`<path d="M16 2l3.6 8.6 9.3.8-7.1 6.1 2.2 9.1L16 21.8 8 26.6l2.2-9.1-7.1-6.1 9.3-.8z" fill="${G}" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>`, 16, 16],
    blade: [`<path d="M2 2l20 17-3 3z" fill="#e6f4ff" stroke="${G}" stroke-width="1.2"/><path d="M18 24l6-6M21 21l7 7" stroke="${A}" stroke-width="3" stroke-linecap="round"/>`, 2, 2],
    ghost: [`<path d="M6 28V14a10 10 0 0 1 20 0v14l-3.3-3-3.4 3-3.3-3-3.3 3-3.4-3z" fill="${G}" stroke="${T}" stroke-width="1.5"/><circle cx="12.5" cy="14" r="2.2" fill="${D}"/><circle cx="19.5" cy="14" r="2.2" fill="${D}"/>`, 16, 4],
    heart: [`<path d="M16 28S3 20 3 11a6.5 6.5 0 0 1 13-2 6.5 6.5 0 0 1 13 2c0 9-13 17-13 17z" fill="${G}" stroke="#fff" stroke-width="1.2"/>`, 16, 6],
    skull: [`<path d="M5 15a11 11 0 0 1 22 0v5l-3 2v5H8v-5l-3-2z" fill="${G}" stroke="${D}" stroke-width="1.2"/><circle cx="11.5" cy="15" r="3" fill="${D}"/><circle cx="20.5" cy="15" r="3" fill="${D}"/>`, 16, 4],
    flame: [`<path d="M16 2c3 7 10 9 10 18a10 10 0 0 1-20 0c0-5 3-7 4-10 1 3 3 4 3 4 1-5 0-8 3-12z" fill="${G}" stroke="${A}" stroke-width="1.2"/><path d="M16 16c2 3 5 4 5 8a5 5 0 0 1-10 0c0-3 3-4 5-8z" fill="${A}"/>`, 16, 2],
    wand: [`<path d="M4 28L20 12" stroke="${T}" stroke-width="3" stroke-linecap="round"/><path d="M23 2l1.8 4.2 4.2 1.8-4.2 1.8L23 14l-1.8-4.2L17 8l4.2-1.8z" fill="${G}"/>`, 23, 8],
    paw: [`<ellipse cx="16" cy="21" rx="7" ry="6" fill="${G}"/><circle cx="7" cy="13" r="3" fill="${G}"/><circle cx="12.5" cy="7.5" r="3" fill="${G}"/><circle cx="19.5" cy="7.5" r="3" fill="${G}"/><circle cx="25" cy="13" r="3" fill="${G}"/>`, 16, 4],
    bolt: [`<path d="M18 1L5 18h9l-3 13 14-18h-9z" fill="${G}" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>`, 16, 1],
    diamond: [`<path d="M16 3l11 10-11 16L5 13z" fill="${G}" stroke="#fff" stroke-width="1.2"/><path d="M5 13h22M16 3l-4 10 4 16 4-16z" stroke="${T}" stroke-width="1" fill="none"/>`, 16, 3],
    ring: [`<circle cx="16" cy="16" r="10" fill="none" stroke="${G}" stroke-width="3"/><circle cx="16" cy="16" r="2" fill="${A}"/>`, 16, 16],
    rocket: [`<path d="M4 4c10 0 18 4 22 14l-8 8C8 22 4 14 4 4z" fill="${G}" stroke="${D}" stroke-width="1"/><circle cx="13" cy="13" r="3" fill="${D}"/><path d="M22 22l6 6M18 26l2 4M26 18l4 2" stroke="${A}" stroke-width="2"/>`, 4, 4],
    leaf: [`<path d="M4 28C4 12 14 4 28 4c0 14-8 24-24 24z" fill="${G}" stroke="${T}" stroke-width="1.2"/><path d="M4 28L20 12" stroke="${T}" stroke-width="1.5"/>`, 4, 28],
    moon: [`<path d="M20 3a13 13 0 1 0 9 22A11 11 0 0 1 20 3z" fill="${G}" stroke="#fff" stroke-width="1"/>`, 16, 16],
    plus: [`<path d="M12 2h8v10h10v8H20v10h-8V20H2v-8h10z" fill="${G}" stroke="${D}" stroke-width="1.5"/>`, 16, 16],
    hand: [`<path d="M10 30c-4-4-7-8-7-11 0-2 2-3 4-1l3 3V5a2 2 0 0 1 4 0v9-2a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v8c0 4-2 6-4 8z" fill="${G}" stroke="${D}" stroke-width="1.3"/>`, 12, 3],
  }[shape] || [``, 0, 0];
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${s[0]}</svg>`, hot: [s[1], s[2]] };
}

export function cursorCSS(id) {
  const c = find('cursor', id);
  if (!c || !c.shape) return null;
  const { svg, hot } = cursorSVG(c.shape, c.pal);
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${hot[0]} ${hot[1]}, auto`;
}

// ---------- click effect preview pictures (one look per effect) ----------
function clickIcon(kind) {
  const c1 = 'var(--c1)', c2 = 'var(--c2)', c3 = 'var(--c3)';
  const ray = (n, r1, r2, col, w = 2) => Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n;
    return `<line x1="${40 + Math.cos(a) * r1}" y1="${40 + Math.sin(a) * r1}" x2="${40 + Math.cos(a) * r2}" y2="${40 + Math.sin(a) * r2}" stroke="${[c1, c2, c3][i % 3]}" stroke-width="${w}" stroke-linecap="round"/>`;
  }).join('');
  const g = {
    sparks: ray(12, 10, 30, c1, 2),
    hearts: [[40, 52, 1], [26, 34, .7], [54, 28, .8], [42, 16, .55]].map(([x, y, s], i) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 8C-10 0-10-9-4-10c3 0 4 2 4 4 0-2 1-4 4-4 6 1 6 10-4 18z" fill="${[c1, c2, c3][i % 3]}"/>`).join(''),
    stars: [[40, 40, 1.2], [18, 22, .7], [62, 24, .6], [20, 60, .6], [62, 60, .7]].map(([x, y, s], i) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0-10l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="${[c1, c2, c3][i % 3]}"/>`).join(''),
    pixels: [[34, 34], [44, 30], [28, 44], [50, 42], [38, 50], [22, 58], [56, 60], [40, 66], [60, 26], [18, 30]].map(([x, y], i) => `<rect x="${x}" y="${y}" width="7" height="7" fill="${[c1, c2, c3][i % 3]}"/>`).join(''),
    rings: [10, 20, 30].map((r, i) => `<circle cx="40" cy="40" r="${r}" fill="none" stroke="${[c1, c2, c3][i]}" stroke-width="2.5" opacity="${1 - i * .25}"/>`).join(''),
    coins: [[40, 20], [24, 36], [56, 34], [34, 56], [52, 58]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="${i % 2 ? 3 : 7}" ry="7" fill="${c1}" stroke="${c2}" stroke-width="1.5"/>`).join(''),
    bolts: [0, 90, 180, 270].map((a, i) => `<polyline transform="rotate(${a} 40 40)" points="40,36 36,26 43,22 38,10 44,4" fill="none" stroke="${[c1, c2, c3][i % 3]}" stroke-width="2.5" stroke-linejoin="bevel"/>`).join(''),
    bubbles: [[40, 54, 9], [26, 36, 6], [52, 30, 7], [36, 16, 4], [58, 50, 4]].map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${[c1, c2, c3][i % 3]}" stroke-width="2"/><circle cx="${x - r / 3}" cy="${y - r / 3}" r="${r / 4}" fill="#fff" opacity=".6"/>`).join(''),
    confetti: Array.from({ length: 14 }, (_, i) => `<rect x="${12 + ((i * 37) % 56)}" y="${8 + ((i * 23) % 60)}" width="4" height="9" fill="${[c1, c2, c3][i % 3]}" transform="rotate(${(i * 47) % 180} ${14 + ((i * 37) % 56)} ${12 + ((i * 23) % 60)})"/>`).join(''),
    skulls: `<text x="40" y="52" font-size="34" text-anchor="middle" fill="${c1}">☠</text><text x="16" y="24" font-size="12" text-anchor="middle">👻</text><text x="64" y="20" font-size="10" text-anchor="middle">👻</text>`,
  }[kind] || '';
  return `<svg viewBox="0 0 80 80">${g}</svg>`;
}

// ---------- shop / locker previews ----------
export function previewHTML(it) {
  switch (it.slot) {
    case 'skin':
      return avatarHTML({ skin: it.id }, 84);
    case 'frame':
      return avatarHTML({ frame: it.id }, 66);
    case 'banner':
    case 'backdrop': {
      const a = sceneAttrs(it);
      return it.scene ? `<span class="pv-banner ${a.cls}" style="${a.style}"></span>` : '<span class="pv-none">—</span>';
    }
    case 'nameplate':
      return callsignHTML('CALLSIGN', { nameplate: it.id });
    case 'effect':
      return callsignHTML('CALLSIGN', { effect: it.id });
    case 'font':
      ensureFont(it.family);
      return `<span class="pv-font" style="font-family:'${it.family}';--fs:${it.scale || 1}">Aa XC</span>`;
    case 'title':
      return it.text ? `<span class="ttl big" style="--r:${RARITY[it.rarity].color}">${esc(it.text)}</span>` : '<span class="pv-none">—</span>';
    case 'cursor': {
      if (!it.shape) return `<span class="pv-cursor"><span class="pv-sys">⮝</span><small>default</small></span>`;
      const { svg } = cursorSVG(it.shape, it.pal);
      return `<span class="pv-cursor" style="cursor:${cursorCSS(it.id)}"><img alt="" src="data:image/svg+xml;utf8,${encodeURIComponent(svg)}"/><small>hover me</small></span>`;
    }
    case 'click':
      return it.kind ? `<span class="pv-click" data-click-demo="${esc(it.id)}" style="${pv(it.pal)}">${clickIcon(it.kind)}<small>hover / click</small></span>` : '<span class="pv-none">—</span>';
    case 'pet':
      return it.kind ? `<span class="pv-pet">${petSVG(it.kind, it.pal)}</span>` : '<span class="pv-none">—</span>';
    case 'sticker':
      return it.emoji ? stickerHTML(it.id, 60) : '<span class="pv-none">—</span>';
    case 'badge':
      return badgeHTML(it.id, 60);
    case 'theme':
    case 'intro': {
      const p = PAL[it.pal] || { c1: '#ff2bd6', c2: '#22e6ff', c3: '#8b5cf6', d: '#0c0a1b' };
      return `<span class="pv-theme ${it.slot === 'intro' ? 'intro' : ''}" style="--c1:${p.c1};--c2:${p.c2};--c3:${p.c3};--cd:${p.d}"><i></i><i></i><i></i></span>`;
    }
    case 'sound':
      return `<span class="pv-sound" data-sound-demo="${esc(it.pack)}">♪ <small>tap to hear</small></span>`;
  }
  return '';
}

export { petSVG, skinSVG, pv as palVars };
