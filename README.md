# Rooftop Sniper

A simple browser sniper game. Pure HTML, CSS and JavaScript. No libraries, no image files.
(It loads two Google Fonts, Bungee and Nunito. If they cannot load, it falls back to system fonts.)

## How to run it

**Quickest:** double-click `index.html`.

**In Antigravity (or VS Code):** open the `rooftop-sniper` folder, run `npx serve` in a terminal, and open the link it prints.

## How the player moves through the game

1. **Start screen:** Start button on the left, the sniper stands on the right.
2. Press Start: the sniper walks away.
3. **Step 1:** pick a mode. **Time Attack** or **Endless**.
4. **Time Attack:** map, then difficulty, then time (30, 60 or 90 seconds). The last choice starts the game.
5. **Endless:** map, then difficulty. The last choice starts the game.
6. **Endless rules:** 3 hearts. You lose one heart only when you shoot a civilian. Thieves that escape do not cost a heart (they only break your combo).
7. Game over: results, then Play again or New mission.

## Files

| File | What it does |
|------|--------------|
| `index.html` | The page: start screen, menu steps, game over screen, and the "how to play" text (good for SEO) |
| `css/style.css` | Colors (at the top, in `:root`), buttons, cards, mobile layout |
| `js/game.js` | The whole game. Sections are numbered 1 to 7 |

## Easy things to change (all in `js/game.js`)

- **Menu text and options:** `STEP_DEFS` in section 7 (names, descriptions, the 30/60/90 seconds).
- **Difficulty numbers:** `DIFFS` in section 1 (bullets, target speed, civilian chance, scope shake, scope size).
- **Maps:** `MAPS` in section 1. To add one, copy an entry and add it to `STEP_DEFS.map` (and `built.yourmap = buildMap(...)` at the bottom).
- **Endless:** hearts are `lives: 3` in `startGame()`. Targets speed up for the first 120 seconds (`spawnTarget()`).
- **Sniper look:** `drawSniper()`. Start screen position: `drawIdleScene()`.
- **Start screen scenery:** `buildLanding()`.

## Put it online

Upload the whole folder (keep the structure) to any hosting: your WordPress hosting (as a subfolder), Netlify, Vercel, or GitHub Pages.

## Before you publish (SEO)

- Change `<title>` and `<meta name="description">` in `index.html` to your real keyword.
- Keep the "How to play" text under the game. Search engines read text, not the canvas.
