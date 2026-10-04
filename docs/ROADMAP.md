# XplainCraft Arcade — Roadmap & Status

Updated 2026-10-04.

## Already built (tested)
- Intro: press start → boot log → sign up / log in → "HELLO name" → loading → arcade
- Hub: SINGLEPLAYER / MULTIPLAYER → 2D / 3D → lobby with 5 genres (Horror, Fun, Mind-Tricky, Relaxing, ???)
- Accounts (this browser only for now), profile, bio, friends, leaderboards, settings
- 2,300 cosmetics in 16 types, 7 rarities (Common → Mythic)
- Shop (featured daily, crates, browse), Locker, Battle Pass (S1 + S2), 9 yearly events + custom events
- Achievements (91), Level Road 1-100, daily reward, daily tasks, gifts
- Operator mode: type **OWL1961** anywhere
- Game kit (games/kit/kit.js), auto registry (tools/build_registry.py), auto tester + covers (tools/test_games.py)
- 21 horror games built + tested (see docs/2D-SINGLEPLAYER-GAMES.md, horror #1–21)

## THE WEEK PLAN (2026-10-04 → 2026-10-11)

### Day 1 — Online
- Supabase project (user creates the free account)
- Online accounts (log in from any device), profiles, friends, requests, presence (online / in game)
- Global leaderboards, gifts, inbox, operator role checked on the server
- Move cosmetics / coins / pass / events / achievements to the server (no cheating from the browser)
- Battle Pass seasons auto-generate every 3 months (never runs out)

### Day 2 — Multiplayer + Party
- Party: invite friends, join by code / link, party chat with stickers
- Game rooms: host picks game, ready-up, start together, rematch
- Real-time engine for MP games (Supabase Realtime)
- Same-screen (local) multiplayer support in the kit
- First 10 MP 2D games

### Day 3 — Mobile
- Touch controls for every game (joystick / buttons / swipe) built into the kit
- Phone layout for every page, portrait + landscape
- Install as app (PWA: "Add to Home Screen", offline cache)
- Test on low phones (Snapdragon 480 class)

### Day 4–6 — Games
- All 19 old games rebuilt in the new style
- 2D singleplayer: target **200 games** (40 per genre), every one tested + cover
- 2D multiplayer: target **20 games**
- Per-game tasks + achievements

### Day 7 — Launch
- Full test pass (PC + phone), fix everything found
- Publish on GitHub Pages
- User + friend play-test, bug fixes

### After the week
- Remaining 2D singleplayer games up to 500
- More 2D multiplayer games
- 3D games (singleplayer, then multiplayer, incl. the stunt/lap racer)

## Needed from the user
1. Supabase free account + project (Day 1)
2. GitHub repo choice for Pages (old xplaincraft-arcade repo or new one)
3. A friend for multiplayer tests (Day 2 / Day 7)

## Rules from the user
- Every button must really work. No fake features.
- Every game and cosmetic must look AND play different — no reskins.
- Each game needs a good cover + preview before playing.
- Cyberpunk neon, clean.
