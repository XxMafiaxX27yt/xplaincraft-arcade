// Battle pass seasons + yearly events (data only; items are generated in catalog.js).

export const PASS_TIERS = 50;
export const PASS_XP_PER_TIER = 250;

export const SEASONS = [
  {
    id: 's1', num: 1, name: 'NEON UPRISING', start: '2026-10-01', end: '2026-12-31', premium: 500,
    pals: ['overclock', 'uprising'], tagline: 'The grid wakes up. So do you.',
    skins: ['visor', 'robot', 'ninja', 'astro', 'knight', 'cyclops', 'headphones', 'demon'],
    frames: ['bolt', 'hex', 'wings', 'crown'], banners: ['lasers', 'city', 'grid', 'chevrons'],
    plates: ['scan', 'glitch', 'chip'], cursors: ['blade', 'bolt', 'diamond'], pets: ['bot', 'owl', 'dragon'],
    clicks: ['bolts', 'pixels'], effects: ['glitch', 'flicker'], backdrops: ['lasers', 'city'],
    titles: ['Uprising', 'Overclocked', 'Neon Rebel', 'Grid Runner', 'System Breaker', 'Season One'],
    stickers: [['⚡', 'Overload'], ['🤖', 'Unit'], ['🛰️', 'Uplink'], ['💾', 'Save State']],
  },
  {
    id: 's2', num: 2, name: 'FROSTBYTE', start: '2027-01-01', end: '2027-03-31', premium: 7500,
    pals: ['frostbyte', 'icequeen'], tagline: 'Cold logic. Colder hearts.',
    skins: ['visor', 'astro', 'knight', 'angel', 'bear', 'fox', 'crown', 'eyes'],
    frames: ['petals', 'ring', 'spikes', 'crown'], banners: ['mountains', 'aurora', 'stars', 'diamonds'],
    plates: ['holo', 'outline', 'split'], cursors: ['diamond', 'star', 'moon'], pets: ['fox', 'owl', 'jelly'],
    clicks: ['stars', 'bubbles'], effects: ['shimmer', 'chrome'], backdrops: ['aurora', 'stars'],
    titles: ['Frostbyte', 'Absolute Zero', 'Ice Cold', 'Snowblind', 'Season Two', 'Glacier'],
    stickers: [['❄️', 'Flake'], ['🧊', 'Cube'], ['🥶', 'Brr'], ['🏔️', 'Summit']],
  },
];

// start/end are 'MM-DD' (repeats every year) or full dates (one time). Ranges can cross New Year.
export const EVENTS = [
  {
    id: 'launch', name: 'LAUNCH WEEK', tagline: 'The arcade is open. Grab the launch gear.', start: '2026-10-02', end: '2026-10-12',
    pals: ['launch'], color: '#ff2bd6', decor: ['✦', '★', '✧'],
    skins: ['visor', 'robot', 'astro', 'crown'], frames: ['crown', 'orbit'], banners: ['lasers', 'stars'], plates: ['holo', 'chip'],
    cursors: ['star', 'rocket'], pets: ['bot'], clicks: ['confetti'], titles: ['Day One', 'Founder', 'First Wave'],
    stickers: [['🚀', 'Liftoff'], ['🎊', 'Launch']], reward: { skin: 'crown', title: 'Founder' },
  },
  {
    id: 'halloween', name: 'NIGHT OF SCREAMS', tagline: 'Halloween in the arcade. Something is wearing your skin.', start: '10-01', end: '11-02',
    pals: ['pumpkin', 'witch', 'bone'], color: '#ff8a1f', decor: ['🦇', '🎃', '👻'],
    skins: ['pumpkin', 'skull', 'ghost', 'wizard', 'plague', 'demon', 'cyclops', 'slime'], frames: ['spikes', 'chain', 'flame'],
    banners: ['moon', 'fog', 'city'], plates: ['fire', 'hazard', 'brush'], cursors: ['skull', 'flame', 'wand', 'ghost'],
    pets: ['bat', 'ghost', 'eye'], clicks: ['skulls', 'bubbles'], titles: ['Pumpkin King', 'Witching Hour', 'Bone Collector', 'Trick or Treat', 'Night Terror'],
    stickers: [['🎃', 'Jack'], ['🦇', 'Bat'], ['👻', 'Boo'], ['🕸️', 'Web'], ['🧟', 'Zombie'], ['🔮', 'Omen']], reward: { skin: 'pumpkin', title: 'Night Terror' },
  },
  {
    id: 'diwali', name: 'FESTIVAL OF LIGHTS', tagline: 'Diwali: light it up, neon style.', start: '11-01', end: '11-15',
    pals: ['diya', 'rangoli'], color: '#ffb02e', decor: ['🪔', '✨', '🎆'],
    skins: ['crown', 'angel', 'visor', 'cat'], frames: ['petals', 'pulse', 'orbit'], banners: ['bokeh', 'rings', 'stars'], plates: ['holo', 'gradient'],
    cursors: ['flame', 'star'], pets: ['chick', 'star'], clicks: ['sparks', 'confetti'], titles: ['Lightbringer', 'Diya', 'Rangoli Artist'],
    stickers: [['🪔', 'Diya'], ['🎇', 'Sparkler'], ['🍬', 'Mithai']], reward: { skin: 'angel', title: 'Lightbringer' },
  },
  {
    id: 'christmas', name: 'NEON NOEL', tagline: 'Christmas in the grid. The presents glow.', start: '12-01', end: '12-26',
    pals: ['candy', 'evergreen', 'snow'], color: '#3dd68c', decor: ['❄', '❅', '✦'],
    skins: ['bear', 'bunny', 'robot', 'angel', 'crown', 'frog'], frames: ['petals', 'ring', 'dual'], banners: ['mountains', 'stars', 'bokeh'],
    plates: ['tape', 'gradient', 'dots'], cursors: ['star', 'leaf', 'heart'], pets: ['bunny', 'chick', 'star'], clicks: ['stars', 'confetti'],
    titles: ['Santa\'s Hacker', 'Snowed In', 'Jingle Bot', 'Gift Giver'], stickers: [['🎄', 'Tree'], ['🎅', 'Santa'], ['🎁', 'Gift'], ['⛄', 'Snowman']],
    reward: { skin: 'bear', title: 'Santa\'s Hacker' },
  },
  {
    id: 'newyear', name: 'COUNTDOWN', tagline: 'New Year. New grid. Same legend.', start: '12-27', end: '01-07',
    pals: ['champagne', 'firework'], color: '#ffe6a8', decor: ['🎆', '✨', '🎇'],
    skins: ['crown', 'headphones', 'visor', 'astro'], frames: ['orbit', 'spin', 'crown'], banners: ['lasers', 'bokeh', 'city'], plates: ['holo', 'chip'],
    cursors: ['star', 'rocket'], pets: ['star'], clicks: ['confetti', 'sparks'], titles: ['Midnight', 'Resolution', 'Year One'],
    stickers: [['🥂', 'Cheers'], ['🎆', 'Boom'], ['🕛', 'Midnight']], reward: { skin: 'headphones', title: 'Midnight' },
  },
  {
    id: 'valentine', name: 'HEARTBREAK HOTEL', tagline: 'Valentine\'s week. Love is a high score.', start: '02-07', end: '02-15',
    pals: ['heart'], color: '#ff4f8b', decor: ['♥', '❤', '💕'],
    skins: ['cat', 'bunny', 'angel', 'eyes'], frames: ['petals', 'pulse'], banners: ['bokeh', 'polka'], plates: ['gradient', 'dots'],
    cursors: ['heart', 'wand'], pets: ['cat', 'bunny'], clicks: ['hearts'], titles: ['Heartbreaker', 'Lover Boy', 'Lovebug'],
    stickers: [['💘', 'Cupid'], ['💌', 'Letter'], ['🌹', 'Rose']], reward: { skin: 'cat', title: 'Heartbreaker' },
  },
  {
    id: 'holi', name: 'COLOR CLASH', tagline: 'Holi: throw color at everything.', start: '03-10', end: '03-25',
    pals: ['holi'], color: '#3dffa0', decor: ['●', '◆', '▲'],
    skins: ['slime', 'frog', 'visor', 'fox'], frames: ['dual', 'pixel'], banners: ['plasma', 'polka'], plates: ['brush', 'gradient'],
    cursors: ['paw', 'plus'], pets: ['slime', 'blob'], clicks: ['bubbles', 'confetti'], titles: ['Color Bomb', 'Rainbow Warrior'],
    stickers: [['🎨', 'Paint'], ['🌈', 'Rainbow']], reward: { skin: 'slime', title: 'Color Bomb' },
  },
  {
    id: 'fools', name: 'ERROR 404', tagline: 'April Fools: the arcade is definitely not broken.', start: '04-01', end: '04-07',
    pals: ['fool'], color: '#00ff66', decor: ['0', '1', '?'],
    skins: ['cube', 'cyclops', 'robot', 'eyes'], frames: ['pixel', 'square'], banners: ['static', 'matrix'], plates: ['glitch', 'scan'],
    cursors: ['pixel', 'plus'], pets: ['eye', 'bot'], clicks: ['pixels'], titles: ['404', 'Not a Bug', 'Glitched'],
    stickers: [['🐛', 'Bug'], ['🤡', 'Fool'], ['❓', '???']], reward: { skin: 'cube', title: 'Not a Bug' },
  },
  {
    id: 'summer', name: 'SYNTHWAVE SUMMER', tagline: 'Long nights, fast cars, neon sunsets.', start: '06-15', end: '07-15',
    pals: ['beach'], color: '#ff9f6b', decor: ['☀', '🌴', '~'],
    skins: ['headphones', 'visor', 'fox', 'frog'], frames: ['ring', 'orbit'], banners: ['drive', 'waves'], plates: ['gradient', 'split'],
    cursors: ['leaf', 'star'], pets: ['fish', 'chick'], clicks: ['bubbles', 'rings'], titles: ['Night Driver', 'Sunset Chaser'],
    stickers: [['🌴', 'Palm'], ['🏄', 'Surf'], ['🕶️', 'Shades']], reward: { skin: 'headphones', title: 'Night Driver' },
  },
];

// Event challenges (progress counted only while the event is live).
export const EVENT_CHALLENGES = [
  { id: 'daily', text: 'Claim the daily reward on {n} days', target: 3, coins: 150 },
  { id: 'tasks', text: 'Complete {n} daily tasks', target: 6, coins: 200 },
  { id: 'buy', text: 'Buy {n} items from the event shop', target: 2, coins: 250, reward: 'title' },
  { id: 'crate', text: 'Open {n} crates', target: 2, coins: 200 },
  { id: 'passxp', text: 'Earn {n} pass XP', target: 1500, coins: 300, reward: 'skin' },
];
