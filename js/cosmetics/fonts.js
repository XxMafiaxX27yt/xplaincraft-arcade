// Loads Google Fonts only when a cosmetic font is actually shown.
const loaded = new Set(['Orbitron', 'Rajdhani', 'Share Tech Mono']);

export function ensureFont(family) {
  if (!family || loaded.has(family)) return;
  loaded.add(family);
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap`;
  document.head.appendChild(l);
}
