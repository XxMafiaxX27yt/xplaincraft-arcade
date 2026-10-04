# NOVEX × XPLAINCRAFT'S GAMING ARCADE

Browser arcade: intro → account → SINGLEPLAYER / MULTIPLAYER → 2D / 3D → lobby (Horror, Fun, Mind-Tricky, Relaxing, ???) → game.
Around it: profile, friends, shop & locker (skins, frames, banners, callsign BG, fonts, cursors), daily tasks, daily reward, leaderboards, settings.

## Run it

It must be served over http (not opened as a file):

```
python -m http.server 8787 --directory .
```

Then open http://localhost:8787

## Files

| Path | What |
|---|---|
| `index.html` | the arcade page |
| `css/arcade.css` | layout + neon style |
| `css/cosmetics.css` | frames, banners, callsign plates, avatar effects |
| `js/app.js` | router, top bar, mode → 2D/3D → lobby → game details |
| `js/views.js` | profile, friends, shop, tasks, leaderboards, settings |
| `js/boot.js` | intro: press start, boot log, sign up / log in, HELLO, loading |
| `js/backend-local.js` | accounts + saving (this device, localStorage) |
| `js/store.js` | current player + which backend is used |
| `js/cosmetics.js` | every cosmetic item, prices, avatar/cursor drawing |
| `js/tasks.js` | daily task picking + progress |
| `js/games.js` | genres + game list (empty for now) |
| `js/host.js` | runs a game full-screen and gives XP/coins when it ends |
| `sdk/arcade-sdk.js` | the script every game includes |

## Cosmetics, pass, events

- `js/cosmetics/palettes.js` — 7 rarities + all color palettes
- `js/cosmetics/catalog.js` — builds all ~2,300 items (styles × palettes + lists). Add styles/palettes here.
- `js/cosmetics/render.js` — draws avatars, frames, pets, cursors, banners, callsigns, badges, stickers
- `js/cosmetics/seasons.js` — battle pass seasons + yearly events (dates, themes, items)
- `js/cosmetics/achievements.js` — achievements and collections
- `js/economy.js` — crates, featured shop, level road, pass tracks, event calendar, prices
- `js/views-shop.js`, `js/views-pass.js`, `js/views-op.js` — shop/locker, pass/events, operator console

Operator mode: type the secret code anywhere outside a text box.

## Adding a game (later)

1. Make `games/2d/my-game.html` (one game = one HTML file) and include `<script src="../../sdk/arcade-sdk.js"></script>`.
2. In the game: `await XC.ready()`, `XC.start()` when a run starts, `XC.end({ score, won, stats })` when it ends, `XC.exit()` to leave.
3. Add an entry to `GAMES` in `js/games.js` (id, title, dim, genre, modes, file, glyph, art, desc, controls, tasks).

## Online accounts (next)

Right now accounts live in the browser. Online accounts/friends across devices use Supabase (free):
fill `supabase.url` and `supabase.anonKey` in `js/config.js` once the project exists.
