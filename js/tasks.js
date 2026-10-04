// Daily tasks: 3 per day, picked from the player id + date so they stay the same all day.
import { GAMES, GENRES, GENRE } from './games.js';
import { hashStr, rng } from './util.js';

function pick(r, arr) {
  return arr[Math.floor(r() * arr.length)];
}

export function generateTasks(uid, dateKey) {
  const r = rng(hashStr(uid + '|' + dateKey));
  const list = [];

  // 1) a game-specific task, when any game has templates
  const withTasks = GAMES.filter((g) => g.tasks?.length);
  if (withTasks.length) {
    const g = pick(r, withTasks);
    const t = pick(r, g.tasks);
    list.push({ type: 'gameStat', game: g.id, stat: t.stat, target: t.target, text: t.text, coins: 80, xp: 60 });
  }

  const platPool = [
    { type: 'daily', target: 1, text: 'Claim your daily reward', coins: 30, xp: 20 },
    { type: 'equip', target: 1, text: 'Equip something in your locker', coins: 30, xp: 20 },
    { type: 'buy', target: 1, text: 'Buy any item from the shop', coins: 60, xp: 30 },
    { type: 'profile', target: 1, text: 'Update your profile bio', coins: 30, xp: 20 },
  ];

  // No games yet: only tasks that can actually be done.
  if (!GAMES.length) {
    const pool = [...platPool];
    while (list.length < 3) list.push({ ...pool.splice(Math.floor(r() * pool.length), 1)[0] });
    return list.map((t, i) => ({ ...t, id: `${dateKey}-${i}`, progress: 0, claimed: false }));
  }

  // 2) a play task
  const genresWithGames = GENRES.filter((gn) => GAMES.some((g) => g.genre === gn.id));
  const playPool = [
    () => ({ type: 'play', target: 3, text: 'Play 3 games', coins: 50, xp: 40 }),
    () => ({ type: 'play', target: 5, text: 'Play 5 games', coins: 70, xp: 60 }),
    () => ({ type: 'time', target: 300, text: 'Play for 5 minutes in total', coins: 60, xp: 50 }),
    () => ({ type: 'time', target: 600, text: 'Play for 10 minutes in total', coins: 90, xp: 70 }),
  ];
  if (genresWithGames.length) {
    playPool.push(() => {
      const gn = pick(r, genresWithGames);
      return { type: 'playGenre', genre: gn.id, target: 2, text: `Play 2 ${GENRE[gn.id].name} games`, coins: 60, xp: 50 };
    });
  }
  list.push(pick(r, playPool)());

  // 3) a platform task
  list.push({ ...pick(r, platPool) });

  return list.map((t, i) => ({ ...t, id: `${dateKey}-${i}`, progress: 0, claimed: false }));
}

export const ALL_DONE_BONUS = { coins: 100, xp: 75 };

// Apply an event to one task. Returns true if progress changed.
export function applyEvent(task, evt) {
  if (task.claimed || task.progress >= task.target) return false;
  let p = task.progress;
  switch (task.type) {
    case 'play':
      if (evt.kind === 'result') p += 1;
      break;
    case 'playGenre':
      if (evt.kind === 'result' && evt.genre === task.genre) p += 1;
      break;
    case 'time':
      if (evt.kind === 'result') p += Math.round(evt.duration);
      break;
    case 'gameStat':
      if (evt.kind === 'result' && evt.game === task.game) {
        const v = Number(evt.stats?.[task.stat] ?? (task.stat === 'score' ? evt.score : 0)) || 0;
        p = Math.max(p, v);
      }
      break;
    default:
      if (evt.kind === task.type) p += 1;
  }
  p = Math.min(task.target, p);
  if (p === task.progress) return false;
  task.progress = p;
  return true;
}
