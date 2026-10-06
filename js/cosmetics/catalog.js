// Every cosmetic in the arcade, generated from styles x palettes + hand-made lists.
// item: { key, slot, id, name, rarity, value, buy, src, srcId, ...look data }
//   src: default | shop | event | eventReward | pass | level | crate | achievement | operator
import { PALETTES, PAL, RARITY, RARITIES } from './palettes.js';
import { SEASONS, EVENTS } from './seasons.js';
import { ACHIEVEMENTS } from './achievements.js';

export { RARITIES, RARITY, PALETTES, PAL };

export const SLOTS = [
  { id: 'skin', name: 'SKINS', hint: 'Your avatar', none: false },
  { id: 'frame', name: 'FRAMES', hint: 'Ring around your avatar', none: true },
  { id: 'banner', name: 'BANNERS', hint: 'Top of your profile', none: false },
  { id: 'nameplate', name: 'CALLSIGN BG', hint: 'Plate behind your name', none: true },
  { id: 'font', name: 'FONTS', hint: 'Font of your callsign', none: false },
  { id: 'effect', name: 'NAME FX', hint: 'Glow on your callsign', none: true },
  { id: 'title', name: 'TITLES', hint: 'Text under your name', none: true },
  { id: 'cursor', name: 'CURSORS', hint: 'Your mouse pointer', none: false },
  { id: 'click', name: 'CLICK FX', hint: 'What happens when you click', none: true },
  { id: 'pet', name: 'PETS', hint: 'A buddy next to your avatar', none: true },
  { id: 'backdrop', name: 'PROFILE BG', hint: 'Background of your profile page', none: true },
  { id: 'sticker', name: 'STICKERS', hint: 'Pin 3 on your profile', none: true, multi: 3 },
  { id: 'badge', name: 'BADGES', hint: 'Earned from achievements, show 3', none: true, multi: 3 },
  { id: 'theme', name: 'UI THEMES', hint: 'Colors of the whole arcade', none: false },
  { id: 'intro', name: 'INTRO', hint: 'Your boot screen style', none: false },
  { id: 'sound', name: 'SOUNDS', hint: 'Button sound pack', none: false },
];
export const SLOT = Object.fromEntries(SLOTS.map((s) => [s.id, s]));

const SLOT_MULT = { skin: 1.2, frame: 1, banner: 1, nameplate: 0.8, font: 0.9, effect: 1.1, title: 0.6, cursor: 0.7, click: 0.8, pet: 1.3, backdrop: 1, sticker: 0.4, badge: 1, theme: 1, intro: 0.8, sound: 0.7 };
const ORDER = RARITIES.map((r) => r.id);
const bump = (r, n = 1) => ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(r) + n)];
const valueOf = (slot, rarity) => Math.max(20, Math.round((RARITY[rarity].price * SLOT_MULT[slot]) / 10) * 10);

// ---------- style lists ----------
export const SKIN_STYLES = [
  ['visor', 'Visor'], ['eyes', 'Watcher'], ['skull', 'Bone'], ['cat', 'Neko'], ['cube', 'Monitor'], ['ghost', 'Specter'],
  ['pumpkin', 'Jack'], ['alien', 'Grey'], ['ninja', 'Shinobi'], ['gasmask', 'Hazmat'], ['astro', 'Astro'], ['demon', 'Fiend', 1],
  ['angel', 'Seraph', 1], ['robot', 'Bolt'], ['bear', 'Bruin'], ['bunny', 'Hopper'], ['fox', 'Kitsune'], ['frog', 'Croak'],
  ['crown', 'Monarch', 1], ['wizard', 'Arcanist', 1], ['headphones', 'DJ'], ['slime', 'Gloop'], ['cyclops', 'Cyclops'],
  ['plague', 'Plague'], ['knight', 'Paladin', 1],
];
export const FRAME_STYLES = [
  ['ring', 'Ring'], ['dual', 'Dual'], ['spin', 'Spinner'], ['orbit', 'Orbit'], ['flame', 'Flame'], ['pulse', 'Pulse'], ['hex', 'Hex'],
  ['square', 'Box'], ['spikes', 'Thorns'], ['wings', 'Wings'], ['crown', 'Crowned'], ['bolt', 'Volt'], ['pixel', 'Pixel'],
  ['gear', 'Gear'], ['petals', 'Bloom'], ['chain', 'Chains'],
];
export const BANNER_SCENES = [
  ['grid', 'Horizon Grid'], ['rain', 'Neon Rain'], ['circuit', 'Circuit'], ['static', 'Dead Channel'], ['drive', 'Sunset Drive'],
  ['moon', 'Moonrise'], ['aurora', 'Aurora'], ['galaxy', 'Galaxy'], ['city', 'Skyline'], ['waves', 'Waves'], ['mountains', 'Peaks'],
  ['stripes', 'Stripes'], ['hexgrid', 'Hive'], ['bokeh', 'Bokeh'], ['fireflies', 'Fireflies'], ['matrix', 'Code Rain'],
  ['scanbars', 'Scanbars'], ['triangles', 'Shards'], ['diamonds', 'Argyle'], ['fog', 'Fog'], ['sakura', 'Petal Fall'],
  ['lavalamp', 'Lava Lamp'], ['rings', 'Ripples'], ['lasers', 'Laser Show'], ['stars', 'Starfield'], ['chevrons', 'Chevrons'],
  ['polka', 'Polka'], ['zigzag', 'Zigzag'], ['plasma', 'Plasma'], ['sunburst', 'Sunburst'],
];
export const PLATE_STYLES = [
  ['solid', 'Solid'], ['edge', 'Edge'], ['gradient', 'Fade'], ['hazard', 'Hazard'], ['carbon', 'Carbon'], ['dots', 'Dots'],
  ['checker', 'Checker'], ['glitch', 'Glitch'], ['holo', 'Holo'], ['scan', 'Scan'], ['fire', 'Blaze'], ['liquid', 'Liquid'],
  ['chevron', 'Chevron'], ['split', 'Split'], ['outline', 'Outline'], ['tape', 'Tape'], ['chip', 'Chip'], ['brush', 'Brush'],
  ['stripe', 'Racing'], ['neonbox', 'Neon Box'],
];
export const CURSOR_SHAPES = [
  ['arrow', 'Arrow'], ['cross', 'Crosshair'], ['dot', 'Dot'], ['pixel', 'Pixel'], ['star', 'Star'], ['blade', 'Blade'],
  ['ghost', 'Ghost'], ['heart', 'Heart'], ['skull', 'Skull'], ['flame', 'Flame'], ['wand', 'Wand'], ['paw', 'Paw'],
  ['bolt', 'Bolt'], ['diamond', 'Gem'], ['ring', 'Ring'], ['rocket', 'Rocket'], ['leaf', 'Leaf'], ['moon', 'Moon'],
  ['plus', 'Plus'], ['hand', 'Hand'],
];
export const PET_TYPES = [
  ['blob', 'Blob'], ['cat', 'Kitty'], ['ghost', 'Boo'], ['bot', 'Botling'], ['bat', 'Bat'], ['fox', 'Fox Kit'], ['owl', 'Owl'],
  ['dragon', 'Drake'], ['slime', 'Slimey'], ['jelly', 'Jelly'], ['bunny', 'Bun'], ['chick', 'Chick'], ['fish', 'Fishy'],
  ['eye', 'Peeper'], ['star', 'Starlet'],
];
export const CLICK_TYPES = [
  ['sparks', 'Sparks'], ['hearts', 'Hearts'], ['stars', 'Stars'], ['pixels', 'Pixels'], ['rings', 'Ripples'], ['coins', 'Coins'],
  ['bolts', 'Zaps'], ['bubbles', 'Bubbles'], ['confetti', 'Confetti'], ['skulls', 'Skulls'],
];
export const EFFECT_TYPES = [
  ['glow', 'Glow'], ['flicker', 'Flicker'], ['gradient', 'Gradient'], ['shimmer', 'Shimmer'], ['glitch', 'Glitch'], ['fire', 'Fire'],
  ['outline', 'Outline'], ['chrome', 'Chrome'], ['rainbow', 'Rainbow'], ['pulse', 'Pulse'], ['shadow3d', '3D'], ['scan', 'Scanline'],
];
const BACKDROP_SCENES = ['grid', 'stars', 'rain', 'hexgrid', 'waves', 'bokeh', 'circuit', 'fog', 'matrix', 'aurora', 'polka', 'lasers', 'city'];

export const FONTS = [
  ['orbitron', 'Orbitron', 'Orbitron', 'common', 1],
  ['rajdhani', 'Rajdhani', 'Rajdhani', 'common', 1.05],
  ['teko', 'Teko', 'Teko', 'common', 1.25],
  ['bebas', 'Bebas Neue', 'Bebas Neue', 'common', 1.2],
  ['russo', 'Russo One', 'Russo One', 'common', 1],
  ['vt323', 'Terminal', 'VT323', 'uncommon', 1.35],
  ['audiowide', 'Audiowide', 'Audiowide', 'uncommon', 1],
  ['righteous', 'Righteous', 'Righteous', 'uncommon', 1],
  ['fredoka', 'Bubble', 'Fredoka', 'uncommon', 1.05],
  ['caveat', 'Handwritten', 'Caveat', 'uncommon', 1.3],
  ['specialelite', 'Typewriter', 'Special Elite', 'uncommon', 1],
  ['silkscreen', 'Silkscreen', 'Silkscreen', 'rare', 1],
  ['bungee', 'Bungee', 'Bungee', 'rare', 1],
  ['blackops', 'Black Ops', 'Black Ops One', 'rare', 1],
  ['permanentmarker', 'Graffiti', 'Permanent Marker', 'rare', 1.05],
  ['bangers', 'Comic', 'Bangers', 'rare', 1.15],
  ['zendots', 'Zen Dots', 'Zen Dots', 'rare', 0.95],
  ['wallpoet', 'Wallpoet', 'Wallpoet', 'epic', 1],
  ['pixel', 'Pixel 8-bit', 'Press Start 2P', 'epic', 0.72],
  ['creepster', 'Creepster', 'Creepster', 'epic', 1.15],
  ['pacifico', 'Pacifico', 'Pacifico', 'epic', 1],
  ['lobster', 'Lobster', 'Lobster', 'epic', 1.05],
  ['rubikmono', 'Heavy Mono', 'Rubik Mono One', 'epic', 0.9],
  ['majormono', 'Major Mono', 'Major Mono Display', 'legendary', 1],
  ['nosifer', 'Nosifer', 'Nosifer', 'legendary', 0.85],
  ['eater', 'Eater', 'Eater', 'legendary', 1],
  ['butcherman', 'Butcherman', 'Butcherman', 'legendary', 1],
  ['gothic', 'Gothic', 'UnifrakturMaguntia', 'legendary', 1.1],
  ['rubikglitch', 'Glitch', 'Rubik Glitch', 'exotic', 1],
  ['wetpaint', 'Wet Paint', 'Rubik Wet Paint', 'exotic', 1],
  ['faster', 'Speed', 'Faster One', 'exotic', 1.05],
  ['bungeeshade', 'Shadow Block', 'Bungee Shade', 'mythic', 1],
  ['monoton', 'Monoton', 'Monoton', 'mythic', 1.05],
];

const TITLES = {
  common: ['Rookie', 'Player', 'Gamer', 'Button Masher', 'Casual', 'Newcomer', 'Snack Break', 'AFK', 'Lag Victim', 'Noob', 'Try Hard', 'Just Vibing', 'Night Owl', 'Early Bird', 'Respawner', 'Side Quest', 'Coin Collector', 'Joystick', 'Speedrunner (Slow)', 'Tutorial Skipper', 'One More Game', 'Thumb Warrior', 'Pixel Pusher', 'Main Character'],
  uncommon: ['Sharpshooter', 'Brainiac', 'Survivor', 'Chill Mode', 'Zen Master', 'Puzzle Head', 'Daredevil', 'Night Runner', 'Neon Kid', 'Glow Up', 'Combo Breaker', 'Ghost Hunter', 'Trickster', 'Wildcard', 'Lucky Charm', 'Quick Draw', 'High Roller', 'Bug Finder', 'Rage Quitter', 'Clutch'],
  rare: ['Shadow', 'Phantom', 'Overthinker', 'Mind Bender', 'Fearless', 'Untouchable', 'Glitch Hunter', 'Code Breaker', 'Sleepless', 'Arcade Royalty', 'Night Shift', 'Hidden Boss', 'Mastermind', 'Last One Standing', 'Silent Killer', 'Brain.exe', 'Ctrl Alt Defeat', 'Chaos Agent', 'Synth Lord', 'Cyber Punk'],
  epic: ['The Unkillable', 'Nightmare Fuel', 'Brainstorm', 'Living Legend', 'Neon Demon', 'Final Boss', 'Data Ghost', 'Reality Bender', 'Void Walker', 'Paradox', 'Infinite Loop', 'Kernel Panic', 'Dream Eater', 'Fear Itself'],
  legendary: ['Arcade God', 'The Chosen One', 'Grid Master', 'Immortal', 'Neon Legend', 'Overlord', 'The Architect', 'Unstoppable', 'Mythmaker', 'Eclipse'],
  exotic: ['Singularity', 'Beyond the Grid', 'Error: Too Good', 'Glitch in the Matrix', 'Hyperdrive', 'Prismatic'],
  mythic: ['Ascended', 'The One Above All', 'Eternal', 'Origin'],
};

const STICKERS = {
  common: [['😀', 'Grin'], ['😂', 'LOL'], ['😎', 'Cool'], ['👍', 'Nice'], ['👋', 'Hi'], ['🔥', 'Fire'], ['💯', '100'], ['🎮', 'Gamer'], ['⭐', 'Star'], ['❤️', 'Love'], ['😴', 'Sleepy'], ['🤔', 'Hmm'], ['😭', 'Cry'], ['👀', 'Eyes'], ['🙃', 'Upside'], ['😤', 'Huff'], ['🥲', 'Smile Cry'], ['🫡', 'Salute'], ['🍕', 'Pizza'], ['☕', 'Coffee']],
  uncommon: [['💀', 'Dead'], ['👻', 'Ghost'], ['🤖', 'Robot'], ['👾', 'Invader'], ['🎯', 'Bullseye'], ['🧠', 'Brain'], ['⚡', 'Zap'], ['🌙', 'Moon'], ['🍀', 'Lucky'], ['🎲', 'Dice'], ['🧩', 'Puzzle'], ['🕹️', 'Stick'], ['🍩', 'Donut'], ['🐱', 'Cat'], ['🐶', 'Dog'], ['🦊', 'Fox'], ['🐸', 'Frog'], ['🐼', 'Panda'], ['🌮', 'Taco'], ['🧃', 'Juice']],
  rare: [['🐉', 'Dragon'], ['🦄', 'Unicorn'], ['🌋', 'Volcano'], ['🌌', 'Galaxy'], ['🛸', 'UFO'], ['🗡️', 'Blade'], ['🏹', 'Bow'], ['🔮', 'Orb'], ['🧪', 'Potion'], ['🪐', 'Planet'], ['🦖', 'Rex'], ['🐙', 'Octo'], ['🦉', 'Owl'], ['🦇', 'Bat'], ['🕷️', 'Spider']],
  epic: [['👑', 'Crown'], ['💎', 'Gem'], ['🌈', 'Rainbow'], ['☄️', 'Comet'], ['🧿', 'Evil Eye'], ['🎭', 'Masks'], ['🗿', 'Moai'], ['🪬', 'Hamsa'], ['🫀', 'Heart'], ['🌀', 'Vortex']],
  legendary: [['🏆', 'Trophy'], ['🐲', 'Dragon Face'], ['🌟', 'Superstar'], ['⚜️', 'Crest'], ['🔱', 'Trident'], ['🪽', 'Wing']],
  exotic: [['🫠', 'Melt'], ['🪩', 'Disco'], ['🧬', 'DNA'], ['🕳️', 'Hole']],
  mythic: [['♾️', 'Infinity'], ['☯️', 'Balance'], ['🌠', 'Wish']],
};

const INTROS = [['neon', 'Default', 'common'], ['blood', 'Blood Boot', 'uncommon'], ['toxic', 'Matrix Boot', 'uncommon'], ['ember', 'Amber CRT', 'uncommon'], ['synth', 'Synthwave Boot', 'rare'], ['ice', 'Ice Boot', 'rare'], ['violet', 'Violet Boot', 'rare'], ['gold', 'Golden Boot', 'legendary'], ['holo', 'Holo Boot', 'exotic'], ['void', 'Void Boot', 'mythic']];
const THEMES = [['arcade', 'Arcade (default)', 'common'], ['neon', 'Cyan', 'common'], ['toxic', 'Toxic', 'common'], ['ember', 'Ember', 'common'], ['lemon', 'Lemon', 'common'], ['sky', 'Sky', 'uncommon'], ['blood', 'Blood', 'uncommon'], ['rose', 'Rose', 'uncommon'], ['ocean', 'Ocean', 'uncommon'], ['forest', 'Forest', 'uncommon'], ['synth', 'Synthwave', 'rare'], ['cyber', 'Cyber', 'rare'], ['venom', 'Venom', 'rare'], ['aurora', 'Aurora', 'rare'], ['lava', 'Lava', 'rare'], ['chrome', 'Chrome', 'epic'], ['galaxy', 'Galaxy', 'epic'], ['plasma', 'Plasma', 'epic'], ['gold', 'Gold', 'legendary'], ['diamond', 'Diamond', 'legendary'], ['holo', 'Holo', 'exotic'], ['prism', 'Prism', 'mythic']];
const SOUNDS = [['synth', 'Synth (default)', 'common'], ['8bit', '8-Bit', 'common'], ['bubbles', 'Bubbles', 'uncommon'], ['keys', 'Keyboard', 'uncommon'], ['glass', 'Glass', 'rare'], ['scifi', 'Sci-Fi', 'rare'], ['horror', 'Horror', 'epic'], ['piano', 'Piano', 'legendary']];

// ---------- build ----------
const items = [];
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function add(slot, id, name, rarity, src, data = {}, srcId = null) {
  const value = valueOf(slot, rarity);
  items.push({ key: `${slot}:${id}`, slot, id, name, rarity, value, buy: src === 'shop' || src === 'event', src, srcId, ...data });
}

// defaults (free, everyone owns them)
add('skin', 'visor-neon', 'Neon Visor', 'common', 'default', { style: 'visor', pal: 'neon' });
add('frame', 'none', 'No Frame', 'common', 'default');
add('banner', 'grid-synth', 'Horizon Grid', 'common', 'default', { scene: 'grid', pal: 'synth' });
add('nameplate', 'none', 'Plain', 'common', 'default');
add('effect', 'none', 'No Effect', 'common', 'default');
add('title', 'none', 'No Title', 'common', 'default', { text: '' });
add('cursor', 'system', 'System', 'common', 'default');
add('click', 'none', 'No Click FX', 'common', 'default');
add('pet', 'none', 'No Pet', 'common', 'default');
add('backdrop', 'none', 'Plain', 'common', 'default');
add('font', 'orbitron', 'Orbitron', 'common', 'default', { family: 'Orbitron', scale: 1 });
add('theme', 'arcade', 'Arcade (default)', 'common', 'default', { pal: null });
add('intro', 'neon', 'Default', 'common', 'default', { pal: 'neon' });
add('sound', 'synth', 'Synth (default)', 'common', 'default', { pack: 'synth' });

// standard shop items: styles x palettes (each list uses a different spread so every palette shows up everywhere)
PALETTES.forEach((p, pi) => {
  SKIN_STYLES.forEach(([s, n, b], si) => {
    if ((si + pi) % 2 === 0 && !(s === 'visor' && p.id === 'neon')) add('skin', `${s}-${p.id}`, `${p.name} ${n}`, b ? bump(p.rarity, b) : p.rarity, 'shop', { style: s, pal: p.id });
  });
  FRAME_STYLES.forEach(([s, n], si) => (si + pi) % 3 === 0 && add('frame', `${s}-${p.id}`, `${p.name} ${n}`, p.rarity, 'shop', { style: s, pal: p.id }));
  BANNER_SCENES.forEach(([s, n], si) => (si + pi) % 7 === 0 && !(s === 'grid' && p.id === 'synth') && add('banner', `${s}-${p.id}`, `${n} · ${p.name}`, p.rarity, 'shop', { scene: s, pal: p.id }));
  PLATE_STYLES.forEach(([s, n], si) => (si + pi) % 4 === 0 && add('nameplate', `${s}-${p.id}`, `${p.name} ${n}`, p.rarity, 'shop', { style: s, pal: p.id }));
  CURSOR_SHAPES.forEach(([s, n], si) => (si + pi) % 4 === 1 && add('cursor', `${s}-${p.id}`, `${p.name} ${n}`, p.rarity, 'shop', { shape: s, pal: p.id }));
  PET_TYPES.forEach(([s, n], si) => (si + pi) % 8 === 0 && add('pet', `${s}-${p.id}`, `${p.name} ${n}`, bump(p.rarity), 'shop', { kind: s, pal: p.id }));
  CLICK_TYPES.forEach(([s, n], si) => (si + pi) % 7 === 0 && add('click', `${s}-${p.id}`, `${p.name} ${n}`, p.rarity, 'shop', { kind: s, pal: p.id }));
  EFFECT_TYPES.forEach(([s, n], si) => (si + pi) % 11 === 0 && add('effect', `${s}-${p.id}`, `${p.name} ${n}`, bump(p.rarity), 'shop', { fx: s, pal: p.id }));
  BACKDROP_SCENES.forEach((s, si) => (si + pi) % 9 === 0 && add('backdrop', `${s}-${p.id}`, `${BANNER_SCENES.find((b) => b[0] === s)[1]} · ${p.name}`, p.rarity, 'shop', { scene: s, pal: p.id }));
});
FONTS.slice(1).forEach(([id, name, family, r, scale]) => add('font', id, name, r, 'shop', { family, scale }));
Object.entries(TITLES).forEach(([r, list]) => list.forEach((t) => add('title', 't-' + slug(t), t, r, 'shop', { text: t })));
Object.entries(STICKERS).forEach(([r, list]) => list.forEach(([e, n]) => add('sticker', 's-' + slug(n), n, r, 'shop', { emoji: e })));
INTROS.slice(1).forEach(([p, n, r]) => add('intro', p, n, r, 'shop', { pal: p }));
THEMES.slice(1).forEach(([p, n, r]) => add('theme', p, n, r, 'shop', { pal: p }));
SOUNDS.slice(1).forEach(([p, n, r]) => add('sound', p, n, r, 'shop', { pack: p }));

// ---------- battle pass items (not in the shop) ----------
const RAMP = ['rare', 'epic', 'legendary', 'exotic', 'mythic'];
SEASONS.forEach((se) => {
  const list = [];
  const push = (slot, id, name, data) => list.push([slot, id, name, data]);
  se.pals.forEach((pid) => {
    const p = PAL[pid];
    se.skins.forEach((s) => push('skin', `${s}-${pid}`, `${p.name} ${SKIN_STYLES.find((x) => x[0] === s)[1]}`, { style: s, pal: pid }));
    se.frames.forEach((s) => push('frame', `${s}-${pid}`, `${p.name} ${FRAME_STYLES.find((x) => x[0] === s)[1]}`, { style: s, pal: pid }));
    se.banners.forEach((s) => push('banner', `${s}-${pid}`, `${BANNER_SCENES.find((x) => x[0] === s)[1]} · ${p.name}`, { scene: s, pal: pid }));
    se.plates.forEach((s) => push('nameplate', `${s}-${pid}`, `${p.name} ${PLATE_STYLES.find((x) => x[0] === s)[1]}`, { style: s, pal: pid }));
    se.cursors.forEach((s) => push('cursor', `${s}-${pid}`, `${p.name} ${CURSOR_SHAPES.find((x) => x[0] === s)[1]}`, { shape: s, pal: pid }));
    se.pets.forEach((s) => push('pet', `${s}-${pid}`, `${p.name} ${PET_TYPES.find((x) => x[0] === s)[1]}`, { kind: s, pal: pid }));
    se.clicks.forEach((s) => push('click', `${s}-${pid}`, `${p.name} ${CLICK_TYPES.find((x) => x[0] === s)[1]}`, { kind: s, pal: pid }));
    se.effects.forEach((s) => push('effect', `${s}-${pid}`, `${p.name} ${EFFECT_TYPES.find((x) => x[0] === s)[1]}`, { fx: s, pal: pid }));
    se.backdrops.forEach((s) => push('backdrop', `${s}-${pid}`, `${BANNER_SCENES.find((x) => x[0] === s)[1]} · ${p.name}`, { scene: s, pal: pid }));
  });
  se.titles.forEach((t) => push('title', 't-' + slug(t), t, { text: t }));
  se.stickers.forEach(([e, n]) => push('sticker', 's-' + slug(se.id + '-' + n), n, { emoji: e }));
  push('theme', se.pals[0], `${PAL[se.pals[0]].name} Theme`, { pal: se.pals[0] });
  push('intro', se.pals[1], `${PAL[se.pals[1]].name} Boot`, { pal: se.pals[1] });
  list.forEach(([slot, id, name, data], i) => {
    const r = RAMP[Math.min(RAMP.length - 1, Math.floor((i / list.length) * RAMP.length))];
    add(slot, id, name, r, 'pass', data, se.id);
  });
});

// ---------- event items ----------
EVENTS.forEach((ev) => {
  const shopList = [];
  ev.pals.forEach((pid) => {
    const p = PAL[pid];
    ev.skins.forEach((s) => shopList.push(['skin', `${s}-${pid}`, `${p.name} ${SKIN_STYLES.find((x) => x[0] === s)[1]}`, { style: s, pal: pid }]));
    ev.frames.forEach((s) => shopList.push(['frame', `${s}-${pid}`, `${p.name} ${FRAME_STYLES.find((x) => x[0] === s)[1]}`, { style: s, pal: pid }]));
    ev.banners.forEach((s) => shopList.push(['banner', `${s}-${pid}`, `${BANNER_SCENES.find((x) => x[0] === s)[1]} · ${p.name}`, { scene: s, pal: pid }]));
    ev.plates.forEach((s) => shopList.push(['nameplate', `${s}-${pid}`, `${p.name} ${PLATE_STYLES.find((x) => x[0] === s)[1]}`, { style: s, pal: pid }]));
    ev.cursors.forEach((s) => shopList.push(['cursor', `${s}-${pid}`, `${p.name} ${CURSOR_SHAPES.find((x) => x[0] === s)[1]}`, { shape: s, pal: pid }]));
    ev.pets.forEach((s) => shopList.push(['pet', `${s}-${pid}`, `${p.name} ${PET_TYPES.find((x) => x[0] === s)[1]}`, { kind: s, pal: pid }]));
    ev.clicks.forEach((s) => shopList.push(['click', `${s}-${pid}`, `${p.name} ${CLICK_TYPES.find((x) => x[0] === s)[1]}`, { kind: s, pal: pid }]));
  });
  ev.stickers.forEach(([e, n]) => shopList.push(['sticker', 's-' + slug(ev.id + '-' + n), n, { emoji: e }]));
  const rewardTitle = ev.reward.title;
  ev.titles.filter((t) => t !== rewardTitle).forEach((t) => shopList.push(['title', 't-' + slug(t), t, { text: t }]));
  shopList.forEach(([slot, id, name, data]) => {
    const r = data.pal ? PAL[data.pal].rarity : slot === 'title' ? 'epic' : 'rare';
    add(slot, id, name, r, 'event', data, ev.id);
  });
  // challenge rewards: an exotic skin in the first palette + a title + a theme
  const p0 = PAL[ev.pals[0]];
  add('skin', `${ev.reward.skin}-${ev.id}-x`, `${p0.name} ${SKIN_STYLES.find((x) => x[0] === ev.reward.skin)[1]} EX`, 'exotic', 'eventReward', { style: ev.reward.skin, pal: ev.pals[0] }, ev.id);
  add('title', 't-' + slug(rewardTitle), rewardTitle, 'exotic', 'eventReward', { text: rewardTitle }, ev.id);
  add('theme', `${ev.id}-theme`, `${ev.name} Theme`, 'epic', 'eventReward', { pal: ev.pals[0] }, ev.id);
  add('intro', `${ev.id}-boot`, `${ev.name} Boot`, 'epic', 'eventReward', { pal: ev.pals[ev.pals.length - 1] }, ev.id);
});

// ---------- level road items (palette Veteran) ----------
[['skin', 'knight'], ['skin', 'wizard'], ['skin', 'crown'], ['skin', 'astro'], ['skin', 'robot'], ['frame', 'crown'], ['frame', 'wings'], ['frame', 'gear'],
  ['banner', 'mountains'], ['banner', 'sunburst'], ['nameplate', 'chip'], ['nameplate', 'carbon'], ['cursor', 'blade'], ['cursor', 'diamond'],
  ['pet', 'owl'], ['pet', 'dragon'], ['click', 'stars'], ['effect', 'chrome'], ['backdrop', 'hexgrid']].forEach(([slot, s], i) => {
  const key = { skin: 'style', frame: 'style', nameplate: 'style', banner: 'scene', backdrop: 'scene', cursor: 'shape', pet: 'kind', click: 'kind', effect: 'fx' }[slot];
  const names = { skin: SKIN_STYLES, frame: FRAME_STYLES, nameplate: PLATE_STYLES, banner: BANNER_SCENES, backdrop: BANNER_SCENES, cursor: CURSOR_SHAPES, pet: PET_TYPES, click: CLICK_TYPES, effect: EFFECT_TYPES }[slot];
  add(slot, `${s}-veteran`, `Veteran ${names.find((x) => x[0] === s)[1]}`, RAMP[Math.min(4, Math.floor(i / 4))], 'level', { [key]: s, pal: 'veteran' });
});
['Level Up', 'Grinder', 'Unstoppable Climber', 'Summit', 'The Hundred'].forEach((t, i) => add('title', 't-' + slug(t), t, RAMP[i], 'level', { text: t }));

// ---------- crate-only items (palette Mystic) ----------
SKIN_STYLES.filter((_, i) => i % 3 === 0).forEach(([s, n]) => add('skin', `${s}-mystic`, `Mystic ${n}`, 'exotic', 'crate', { style: s, pal: 'mystic' }));
FRAME_STYLES.filter((_, i) => i % 3 === 1).forEach(([s, n]) => add('frame', `${s}-mystic`, `Mystic ${n}`, 'exotic', 'crate', { style: s, pal: 'mystic' }));
BANNER_SCENES.filter((_, i) => i % 5 === 2).forEach(([s, n]) => add('banner', `${s}-mystic`, `${n} · Mystic`, 'exotic', 'crate', { scene: s, pal: 'mystic' }));
CURSOR_SHAPES.filter((_, i) => i % 4 === 3).forEach(([s, n]) => add('cursor', `${s}-mystic`, `Mystic ${n}`, 'exotic', 'crate', { shape: s, pal: 'mystic' }));
PET_TYPES.filter((_, i) => i % 4 === 0).forEach(([s, n]) => add('pet', `${s}-mystic`, `Mystic ${n}`, 'mythic', 'crate', { kind: s, pal: 'mystic' }));
['Jackpot', 'Lucky Seven', 'Loot Goblin', 'RNG Blessed'].forEach((t) => add('title', 't-' + slug(t), t, 'exotic', 'crate', { text: t }));

// ---------- operator-only ----------
add('skin', 'knight-operator', 'Operator Paladin', 'mythic', 'operator', { style: 'knight', pal: 'operator' });
add('skin', 'visor-operator', 'Operator Visor', 'mythic', 'operator', { style: 'visor', pal: 'operator' });
add('frame', 'crown-operator', 'Operator Crown', 'mythic', 'operator', { style: 'crown', pal: 'operator' });
add('banner', 'matrix-operator', 'Operator Feed', 'mythic', 'operator', { scene: 'matrix', pal: 'operator' });
add('nameplate', 'glitch-operator', 'Operator Plate', 'mythic', 'operator', { style: 'glitch', pal: 'operator' });
add('effect', 'glitch-operator', 'Operator Glitch', 'mythic', 'operator', { fx: 'glitch', pal: 'operator' });
add('cursor', 'cross-operator', 'Operator Reticle', 'mythic', 'operator', { shape: 'cross', pal: 'operator' });
add('pet', 'owl-operator', 'OWL-1961', 'mythic', 'operator', { kind: 'owl', pal: 'operator' });
add('title', 't-operator', 'OPERATOR', 'mythic', 'operator', { text: 'OPERATOR' });
add('badge', 'operator', 'Operator', 'mythic', 'operator', { icon: '⛨', pal: 'operator' });

// ---------- love sets: one of a kind, never sold; only NovexYT can give them ----------
// (the server enforces it: supabase/schema.sql love_gift + save_me drops love items nobody gave you)
export const LOVE_GIVER = 'NovexYT';
export const LOVE_SETS = [
  { id: 'forever', name: 'Forever', tag: 'rose + gold', skin: 'heart', frame: 'hearts', scene: 'lovesun', plate: 'love', fx: 'love', title: 'Forever Yours',
    font: ['Great Vibes', 1.45], cursor: 'heart', click: 'hearts', pet: 'heart', sticker: ['🌹', 'Forever Rose'], badge: '♥', sound: 'musicbox' },
  { id: 'sweetheart', name: 'Sweetheart', tag: 'pink + red', skin: 'cupid', frame: 'hearts', scene: 'love', plate: 'love', fx: 'love', title: 'My Favourite Person',
    font: ['Dancing Script', 1.25], cursor: 'heart', click: 'hearts', pet: 'teddy', sticker: ['💌', 'Love Letter'], badge: '❥', sound: 'chimes' },
  { id: 'starlight', name: 'Starlight', tag: 'lavender + pink', skin: 'moonlove', frame: 'hearts', scene: 'lovesky', plate: 'love', fx: 'love', title: 'Soulmate',
    font: ['Parisienne', 1.35], cursor: 'heart', click: 'hearts', pet: 'lovebird', sticker: ['💖', 'Starlight Heart'], badge: '♡', sound: 'harp' },
];
export const LOVE_SLOT_NAMES = { skin: 'Avatar', frame: 'Frame', banner: 'Banner', nameplate: 'Callsign BG', font: 'Font', effect: 'Name FX', title: 'Title', cursor: 'Cursor', click: 'Click FX', pet: 'Pet', backdrop: 'Profile BG', sticker: 'Sticker', badge: 'Badge', theme: 'UI Theme', intro: 'Intro', sound: 'Sounds' };
LOVE_SETS.forEach((L) => {
  const id = 'love-' + L.id, pal = L.id, N = L.name, a = (slot, name, data) => add(slot, id, name, 'love', 'love', { pal, ...data }, L.id);
  a('skin', `${N} Heart`, { style: L.skin });
  a('frame', `${N} Frame`, { style: L.frame });
  a('banner', `${N} Sky`, { scene: L.scene });
  a('nameplate', `${N} Plate`, { style: L.plate });
  a('font', `${N} Script`, { family: L.font[0], scale: L.font[1] });
  a('effect', `${N} Glow`, { fx: L.fx });
  a('title', L.title, { text: L.title });
  a('cursor', `${N} Cursor`, { shape: L.cursor });
  a('click', `${N} Hearts`, { kind: L.click });
  a('pet', `${N} Buddy`, { kind: L.pet });
  a('backdrop', `${N} Backdrop`, { scene: L.scene });
  a('sticker', L.sticker[1], { emoji: L.sticker[0] });
  a('badge', N, { icon: L.badge });
  a('theme', `${N} Theme`, {});
  a('intro', `${N} Boot`, {});
  a('sound', `${N} Music Box`, { pack: L.sound });
});
export const isLove = (it) => it?.src === 'love';
export const loveItems = (setId) => items.filter((i) => i.src === 'love' && (!setId || i.srcId === setId));

// ---------- achievement badges + titles ----------
ACHIEVEMENTS.forEach((a) => {
  add('badge', a.id, a.name, a.rarity, 'achievement', { icon: a.icon, pal: a.pal || ({ common: 'steel', uncommon: 'toxic', rare: 'sky', epic: 'violet', legendary: 'gold', exotic: 'holo', mythic: 'prism' }[a.rarity]) }, a.id);
  if (a.title && !items.some((i) => i.key === 'title:t-' + slug(a.title))) add('title', 't-' + slug(a.title), a.title, a.rarity, 'achievement', { text: a.title }, a.id);
});

// the love sets are left out of every list (shop, crates, unlock-all, operator gifts); they are only found by key
export const ALL_ITEMS = items.filter((i) => i.src !== 'love');
export const ITEM = Object.fromEntries(items.map((i) => [i.key, i]));
export const BY_SLOT = Object.fromEntries(SLOTS.map((s) => [s.id, items.filter((i) => i.slot === s.id)]));
export const STARTER_OWNED = items.filter((i) => i.src === 'default').map((i) => i.key);
export const DEFAULT_EQUIP = Object.fromEntries(SLOTS.map((s) => [s.id, s.multi ? [] : items.find((i) => i.slot === s.id && i.src === 'default').id]));
export const titleKey = (t) => 'title:t-' + slug(t);

export function find(slot, id) {
  return ITEM[`${slot}:${id}`] || BY_SLOT[slot]?.find((i) => i.src === 'default') || null;
}

// duplicate check (keys must be unique)
if (items.length !== Object.keys(ITEM).length) {
  const seen = new Set();
  items.forEach((i) => (seen.has(i.key) ? console.warn('duplicate cosmetic', i.key) : seen.add(i.key)));
}
