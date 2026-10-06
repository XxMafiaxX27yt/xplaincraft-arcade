// Color palettes shared by every cosmetic type. Each standard palette is also a "collection" set.
// c1 = main glow, c2 = secondary, c3 = accent, d = dark body tone, fx = animated look

export const RARITIES = [
  { id: 'common', name: 'COMMON', color: '#a3abc9', price: 60, w: 0 },
  { id: 'uncommon', name: 'UNCOMMON', color: '#3dffa0', price: 150, w: 1 },
  { id: 'rare', name: 'RARE', color: '#2ea8ff', price: 350, w: 2 },
  { id: 'epic', name: 'EPIC', color: '#b35cff', price: 800, w: 3 },
  { id: 'legendary', name: 'LEGENDARY', color: '#ffb52e', price: 1800, w: 4 },
  { id: 'exotic', name: 'EXOTIC', color: '#ff3d9a', price: 4000, w: 5 },
  { id: 'mythic', name: 'MYTHIC', color: '#ff3b3b', price: 9000, w: 6 },
  { id: 'love', name: 'ONE OF A KIND', color: '#ff6fae', price: 20000, w: 7 },   // the love sets: never sold, only gifted
];
export const RARITY = Object.fromEntries(RARITIES.map((r) => [r.id, r]));

const P = (id, name, rarity, c1, c2, c3, d, fx = null) => ({ id, name, rarity, c1, c2, c3, d, fx });

// Standard palettes: sold in the shop, each one is a collection.
export const PALETTES = [
  P('neon', 'Neon', 'common', '#22e6ff', '#3b3580', '#ff2bd6', '#1d1a44'),
  P('magenta', 'Magenta', 'common', '#ff2bd6', '#5d1f6e', '#22e6ff', '#2a0f33'),
  P('toxic', 'Toxic', 'common', '#3dffa0', '#1f5c3a', '#f6ff3a', '#0f2a1c'),
  P('lemon', 'Lemon', 'common', '#f6ff3a', '#5c5a1a', '#ff2bd6', '#26250c'),
  P('violet', 'Violet', 'common', '#a77bff', '#3e2a80', '#22e6ff', '#1a1238'),
  P('ember', 'Ember', 'common', '#ff8a3a', '#6e2f12', '#ffd93a', '#2b1308'),
  P('sky', 'Sky', 'common', '#5cb8ff', '#1e4a7a', '#ffffff', '#0c1d33'),
  P('mint', 'Mint', 'common', '#7dffd8', '#1f6656', '#ff9bf0', '#0d2a24'),
  P('sunset', 'Sunset', 'uncommon', '#ff7a3a', '#ff2bd6', '#ffd93a', '#2b1030'),
  P('ice', 'Ice', 'uncommon', '#bdf4ff', '#5aa9c9', '#ffffff', '#122838'),
  P('blood', 'Blood', 'uncommon', '#ff3355', '#6e0f1f', '#ffb3c0', '#2a050c'),
  P('rose', 'Rose', 'uncommon', '#ff9bc8', '#7a2a52', '#fff0f7', '#2b1020'),
  P('ocean', 'Ocean', 'uncommon', '#1fd1c1', '#1a4f8a', '#bdf4ff', '#081a2e'),
  P('forest', 'Forest', 'uncommon', '#7bd64a', '#2a5c1f', '#e8d27a', '#0f2410'),
  P('steel', 'Steel', 'uncommon', '#c9d3e8', '#4a5470', '#22e6ff', '#1a1f2e'),
  P('synth', 'Synthwave', 'rare', '#ff2bd6', '#22e6ff', '#ffd93a', '#1b0a33'),
  P('cyber', 'Cyber', 'rare', '#f6ff3a', '#22e6ff', '#ff2bd6', '#12141f'),
  P('venom', 'Venom', 'rare', '#9dff3a', '#8b2bff', '#3dffa0', '#140a22'),
  P('aurora', 'Aurora', 'rare', '#3dffa0', '#8b5cf6', '#22e6ff', '#081428'),
  P('lava', 'Lava', 'rare', '#ff5a1f', '#ffc93a', '#ff2a2a', '#200804'),
  P('frost', 'Frost', 'rare', '#e6fbff', '#7ad7ff', '#a77bff', '#101c30'),
  P('chrome', 'Chrome', 'epic', '#f2f5ff', '#8a94b0', '#22e6ff', '#2a2f40', 'shine'),
  P('obsidian', 'Obsidian', 'epic', '#b35cff', '#120e1a', '#ff2bd6', '#050308'),
  P('galaxy', 'Galaxy', 'epic', '#c45cff', '#2b1a6e', '#ffffff', '#0a0620'),
  P('plasma', 'Plasma', 'epic', '#ff4bf0', '#5a2bff', '#22e6ff', '#14062a', 'pulse'),
  P('gold', 'Gold', 'legendary', '#ffd76a', '#b8860b', '#fff3b0', '#3a2706', 'shine'),
  P('diamond', 'Diamond', 'legendary', '#d9fbff', '#5fd3ff', '#ffffff', '#0e2a3a', 'shine'),
  P('inferno', 'Inferno', 'legendary', '#ff3d00', '#ffb300', '#fff3b0', '#2a0500', 'pulse'),
  P('holo', 'Holo', 'exotic', '#ffd1f7', '#b9f5ff', '#fff6b0', '#2a2440', 'holo'),
  P('glitch', 'Glitch', 'exotic', '#ffffff', '#ff2bd6', '#22e6ff', '#0d0d18', 'glitch'),
  P('quantum', 'Quantum', 'exotic', '#7af0ff', '#ff4bf0', '#b8ff3a', '#060a1a', 'holo'),
  P('void', 'Void', 'mythic', '#ffffff', '#14141c', '#c45cff', '#000000', 'aura'),
  P('prism', 'Prism', 'mythic', '#ff2bd6', '#22e6ff', '#f6ff3a', '#140a24', 'prism'),
  P('celestial', 'Celestial', 'mythic', '#fff3b0', '#8b5cf6', '#ffffff', '#0a0a2a', 'aura'),
];

// Special palettes: only from the pass, events, levels, crates or operator.
export const SPECIAL_PALETTES = [
  P('overclock', 'Overclock', 'epic', '#00ffd5', '#ff0080', '#ffffff', '#08061a', 'pulse'), // pass S1
  P('uprising', 'Uprising', 'legendary', '#ff2a6d', '#05d9e8', '#d1f7ff', '#01012b', 'shine'), // pass S1
  P('frostbyte', 'Frostbyte', 'epic', '#9ef0ff', '#3a6bff', '#ffffff', '#06102a', 'pulse'), // pass S2
  P('icequeen', 'Ice Throne', 'mythic', '#e6fbff', '#7a5cff', '#ffffff', '#0a0c2a', 'aura'), // pass S2
  P('pumpkin', 'Pumpkin', 'rare', '#ff8a1f', '#2b1a0a', '#9dff3a', '#1a0d03'),
  P('witch', 'Witch', 'epic', '#9d4bff', '#1a0d2a', '#3dffa0', '#0a0614'),
  P('bone', 'Bone', 'legendary', '#f2ecd8', '#5a5242', '#ff3355', '#1a1712', 'shine'),
  P('candy', 'Candy Cane', 'rare', '#ff3355', '#ffffff', '#3dffa0', '#2a0a10'),
  P('evergreen', 'Evergreen', 'epic', '#3dd68c', '#0d3a22', '#ffd76a', '#06180e'),
  P('snow', 'Snowfall', 'legendary', '#ffffff', '#9ec9ff', '#ffd76a', '#0e1a2e', 'shine'),
  P('champagne', 'Champagne', 'epic', '#ffe6a8', '#8a6a2a', '#ffffff', '#1f1608', 'shine'),
  P('firework', 'Firework', 'legendary', '#ff2bd6', '#ffd93a', '#22e6ff', '#0a0618', 'prism'),
  P('heart', 'Heartbeat', 'rare', '#ff4f8b', '#7a1238', '#ffd1e1', '#2a0614'),
  P('diya', 'Diya', 'epic', '#ffb02e', '#8a2a0a', '#fff3b0', '#200a02', 'pulse'),
  P('rangoli', 'Rangoli', 'legendary', '#ff2bd6', '#ffd93a', '#3dffa0', '#1a0820', 'holo'),
  P('holi', 'Color Clash', 'epic', '#ff2bd6', '#3dffa0', '#f6ff3a', '#14081a', 'holo'),
  P('fool', 'Error 404', 'exotic', '#00ff66', '#ff00aa', '#ffffff', '#000000', 'glitch'),
  P('beach', 'Beach Drive', 'rare', '#ff9f6b', '#1fd1c1', '#ffd93a', '#0a1a24'),
  P('launch', 'Launch Day', 'legendary', '#ff2bd6', '#8b5cf6', '#22e6ff', '#0c0820', 'shine'),
  P('veteran', 'Veteran', 'epic', '#c9a86a', '#3a3020', '#ffffff', '#141008'),
  P('mystic', 'Mystic', 'exotic', '#7a5cff', '#ff4bf0', '#7af0ff', '#08041a', 'holo'),
  P('operator', 'Operator', 'mythic', '#ff0040', '#000000', '#ffffff', '#0a0004', 'glitch'),
  // love sets (only NovexYT can give them)
  P('forever', 'Forever', 'love', '#ff5c8a', '#ffcf6a', '#fff1f5', '#2a0a18', 'love'),
  P('sweetheart', 'Sweetheart', 'love', '#ff4f9a', '#ff2d4b', '#ffe0ec', '#2a0612', 'love'),
  P('starlight', 'Starlight', 'love', '#c9a7ff', '#ff8fc8', '#fff4fd', '#120a2e', 'love'),
];

export const PAL = Object.fromEntries([...PALETTES, ...SPECIAL_PALETTES].map((p) => [p.id, p]));
