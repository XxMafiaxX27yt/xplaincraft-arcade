// Achievements: each gives its own badge (+ coins, sometimes a title).
// stat keys are computed in backend-local.js (statsFor).
import { PALETTES } from './palettes.js';

const A = (id, name, desc, stat, target, icon, rarity, coins, title = null) => ({ id, name, desc, stat, target, icon, rarity, coins, title });

const BASE = [
  A('lv5', 'Getting Started', 'Reach level 5', 'level', 5, '⭐', 'common', 100),
  A('lv10', 'Regular', 'Reach level 10', 'level', 10, '⭐', 'uncommon', 200, 'Regular'),
  A('lv20', 'Dedicated', 'Reach level 20', 'level', 20, '🌟', 'rare', 400),
  A('lv30', 'Veteran Player', 'Reach level 30', 'level', 30, '🌟', 'epic', 700, 'Veteran'),
  A('lv50', 'Half Century', 'Reach level 50', 'level', 50, '💫', 'legendary', 1500, 'Half Century'),
  A('lv75', 'Elite', 'Reach level 75', 'level', 75, '💫', 'exotic', 3000, 'Elite'),
  A('lv100', 'Centurion', 'Reach level 100', 'level', 100, '👑', 'mythic', 6000, 'Centurion'),
  A('st3', 'Coming Back', 'Daily reward streak of 3', 'streak', 3, '🔥', 'common', 80),
  A('st7', 'Full Week', 'Daily reward streak of 7', 'streak', 7, '🔥', 'uncommon', 200, 'Every Day'),
  A('st14', 'Two Weeks Strong', 'Daily reward streak of 14', 'streak', 14, '🔥', 'rare', 500),
  A('st30', 'Monthly Ritual', 'Daily reward streak of 30', 'streak', 30, '☄️', 'epic', 1200, 'Unbreakable'),
  A('st100', 'No Days Off', 'Daily reward streak of 100', 'streak', 100, '☄️', 'mythic', 5000, 'No Days Off'),
  A('tk10', 'Task Runner', 'Complete 10 daily tasks', 'tasks', 10, '✅', 'common', 100),
  A('tk50', 'Task Master', 'Complete 50 daily tasks', 'tasks', 50, '✅', 'rare', 400, 'Task Master'),
  A('tk200', 'Task Machine', 'Complete 200 daily tasks', 'tasks', 200, '⚙️', 'legendary', 1500, 'Task Machine'),
  A('own10', 'Collector', 'Own 10 cosmetics', 'owned', 10, '🎒', 'common', 80),
  A('own50', 'Hoarder', 'Own 50 cosmetics', 'owned', 50, '🎒', 'uncommon', 250),
  A('own100', 'Drip Lord', 'Own 100 cosmetics', 'owned', 100, '💎', 'rare', 600, 'Drip Lord'),
  A('own250', 'Wardrobe', 'Own 250 cosmetics', 'owned', 250, '💎', 'epic', 1500),
  A('own500', 'Museum', 'Own 500 cosmetics', 'owned', 500, '🏛️', 'legendary', 3000, 'Curator'),
  A('own1000', 'The Vault', 'Own 1000 cosmetics', 'owned', 1000, '🏛️', 'mythic', 8000, 'The Vault'),
  A('earn1k', 'Pocket Money', 'Earn 1,000 coins in total', 'earned', 1000, '🪙', 'common', 100),
  A('earn10k', 'Rich', 'Earn 10,000 coins in total', 'earned', 10000, '🪙', 'rare', 500, 'Rich'),
  A('earn100k', 'Tycoon', 'Earn 100,000 coins in total', 'earned', 100000, '💰', 'legendary', 3000, 'Tycoon'),
  A('spend1k', 'Shopper', 'Spend 1,000 coins', 'spent', 1000, '🛍️', 'common', 100),
  A('spend10k', 'Big Spender', 'Spend 10,000 coins', 'spent', 10000, '🛍️', 'rare', 600, 'Big Spender'),
  A('spend50k', 'Whale', 'Spend 50,000 coins', 'spent', 50000, '🐋', 'legendary', 2500, 'Whale'),
  A('cr1', 'Mystery Box', 'Open a crate', 'crates', 1, '📦', 'common', 50),
  A('cr10', 'Unboxer', 'Open 10 crates', 'crates', 10, '📦', 'rare', 400, 'Unboxer'),
  A('cr50', 'Crate Addict', 'Open 50 crates', 'crates', 50, '🎁', 'epic', 1200, 'Lucky'),
  A('fr1', 'First Friend', 'Make a friend', 'friends', 1, '🤝', 'common', 80),
  A('fr5', 'Squad', 'Have 5 friends', 'friends', 5, '🤝', 'uncommon', 250, 'Squad Leader'),
  A('fr10', 'Popular', 'Have 10 friends', 'friends', 10, '💬', 'rare', 500, 'Popular'),
  A('fr25', 'Celebrity', 'Have 25 friends', 'friends', 25, '📣', 'legendary', 1500, 'Celebrity'),
  A('bp10', 'Pass Climber', 'Reach pass tier 10', 'passTier', 10, '🎟️', 'uncommon', 200),
  A('bp25', 'Halfway There', 'Reach pass tier 25', 'passTier', 25, '🎟️', 'rare', 500),
  A('bp50', 'Max Tier', 'Reach pass tier 50', 'passTier', 50, '🏁', 'legendary', 1500, 'Max Tier'),
  A('ev1', 'Party Starter', 'Finish an event challenge', 'eventDone', 1, '🎉', 'common', 100),
  A('ev10', 'Event Regular', 'Finish 10 event challenges', 'eventDone', 10, '🎉', 'rare', 600, 'Festive'),
  A('ev30', 'Event Legend', 'Finish 30 event challenges', 'eventDone', 30, '🎆', 'legendary', 2000, 'Event Legend'),
  A('gp1', 'Player One', 'Play a game', 'plays', 1, '🕹️', 'common', 50),
  A('gp10', 'Warming Up', 'Play 10 games', 'plays', 10, '🕹️', 'common', 150),
  A('gp100', 'Arcade Rat', 'Play 100 games', 'plays', 100, '👾', 'rare', 600, 'Arcade Rat'),
  A('gp1000', 'No Life', 'Play 1,000 games', 'plays', 1000, '👾', 'legendary', 3000, 'No Life'),
  A('win1', 'First Blood', 'Win a game', 'wins', 1, '🏆', 'common', 80),
  A('win25', 'Winner', 'Win 25 games', 'wins', 25, '🏆', 'rare', 500, 'Winner'),
  A('win100', 'Champion', 'Win 100 games', 'wins', 100, '🏆', 'legendary', 2000, 'Champion'),
  A('pt1', 'One Hour', 'Play for 1 hour in total', 'hours', 1, '⏱️', 'uncommon', 200),
  A('pt10', 'Ten Hours', 'Play for 10 hours in total', 'hours', 10, '⏱️', 'epic', 1000, 'Time Bender'),
  A('pt50', 'Lost in the Neon', 'Play for 50 hours in total', 'hours', 50, '⌛', 'mythic', 5000, 'Lost in the Neon'),
  A('col1', 'Matching Fit', 'Complete 1 collection', 'collections', 1, '🧩', 'uncommon', 300, 'Matching'),
  A('col5', 'Set Builder', 'Complete 5 collections', 'collections', 5, '🧩', 'epic', 1200, 'Set Builder'),
  A('col15', 'Completionist', 'Complete 15 collections', 'collections', 15, '🧩', 'mythic', 6000, 'Completionist'),
  A('ach10', 'Achiever', 'Unlock 10 achievements', 'achievements', 10, '🎖️', 'rare', 500),
  A('ach40', 'Overachiever', 'Unlock 40 achievements', 'achievements', 40, '🎖️', 'legendary', 2500, 'Overachiever'),
  A('bio', 'About Me', 'Write a profile bio', 'bio', 1, '✍️', 'common', 50),
  A('style', 'Dressed Up', 'Equip 8 different cosmetic types', 'dressed', 8, '👕', 'uncommon', 200, 'Stylish'),
];

// One collection per standard palette: own at least one item of that color in
// skins, frames, banners, callsign BG and cursors.
export const COLLECTION_SLOTS = ['skin', 'frame', 'banner', 'nameplate', 'cursor'];
const COLLECTIONS = PALETTES.map((p) =>
  A(`set-${p.id}`, `${p.name} Collection`, `Own a ${p.name} skin, frame, banner, callsign BG and cursor`, `set:${p.id}`, 5, '🧩', p.rarity, 150 + 100 * ['common', 'uncommon', 'rare', 'epic', 'legendary', 'exotic', 'mythic'].indexOf(p.rarity), `${p.name} Collector`)
);
COLLECTIONS.forEach((c, i) => (c.pal = PALETTES[i].id));

export const ACHIEVEMENTS = [...BASE, ...COLLECTIONS];
export const ACH = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
