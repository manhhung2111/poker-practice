# Practice Hub

A phone-first practice app with two sections, picked from the home screen:

- **Poker**: the trainer described below.
- **Piano**: note-reading drills. Notes appear on the treble clef (right hand), the bass clef (left hand)
  or the grand staff (both). Answer on the on-screen keyboard or a MIDI keyboard. Accuracy and speed
  are tracked per note, and missed notes come up more often. Piano stats stay on the device and are
  not in the poker backup file yet.

Phone-first trainer for 9-max 100bb cash preflop decisions: drills by position and cards,
lessons, stats, and later full hands against bots. Full design: [docs/design.md](docs/design.md).

## Setup

Node.js is installed locally at `~/.local/node`. Add it to your PATH:

```sh
export PATH=~/.local/node/bin:$PATH
npm install
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Run all tests once |
| `npm run test:watch` | Tests in watch mode |
| `npm run build` | Installable PWA build → `dist/` |
| `npm run build:single` | Single-file build for phone previews → `dist-single/index.html` |
| `npm run preview:page` | Single-file build stripped for a claude.ai preview link → `dist-single/poker-trainer.html` |
| `npm run icons` | Re-render `public/icon.svg` to the PNG app icons |
| `npm run lint` | ESLint |

## Layout

- `src/core/`: pure poker logic, no React, fully unit-tested
  - `cards.ts`: cards, deck, shuffle
  - `hands.ts`: 169 hand classes, 13×13 grid, combos, categories
  - `rangeParser.ts`: range notation (`22+, A2s+, KTo-K8o`) ↔ sets of hands
  - `strength.ts`: hand strength ranking (Chen formula) and top-% percentiles
  - `random.ts`: seeded RNG for reproducible tests
  - `positions.ts`: 9-max positions, groups, valid matchups
  - `charts.ts`: chart format, compile/validate, lookup, action labels
  - `grading.ts`: correct/wrong + severity (close / clear / blunder)
  - `explain.ts`: the "why" text after each answer
  - `markdown.ts`, `glossary.ts`: lesson Markdown subset, auto-linking of glossary terms
  - `progress.ts`: lesson pass rule (16 of last 20), unlocks, allowed seats
  - `log.ts`, `review.ts`, `stats.ts`, `backup.ts`: answer log, spaced repetition of misses (3/10/30/100 hands), stats math, backup format
  - `overrides.ts`: your chart edits (stored as range notation), sanity warnings
  - `dealing.ts`: deals drill spots for every spot type, bet sizes, table state (smart: 60% borderline hands, or realistic)
- `src/core/engine/`: no-limit hold'em engine
  - `evaluator.ts`: best 5 of 7 cards (verified against all 2,598,960 five-card hands)
  - `game.ts`: blinds, turn order, min-raise and short all-in rules, streets, side pots, split pots, showdown (chips: 1bb = 10)
- `src/core/bots/`: bot players
  - `personality.ts`: Nit 🧊 / Regular 🎯 / Fish 🐟 / Maniac 🔥 settings
  - `handRead.ts`: postflop hand strength and draws
  - `brain.ts`: preflop from the default charts + personality, postflop from strength vs pot odds
- `src/core/table.ts`: table session (you + 8 bots, button, rebuys), mapping your preflop decisions to chart spots for grading, trivial-fold detection
- `src/core/handRecord.ts`: saved hands (players, actions, result, your graded decisions)
- `src/ui/play/`: Play tab (table, bet sizing, hand review, history, settings)
- `src/data/lessons/*.md`: the 5 lessons (edit freely; `[[term-id]]` links the glossary)
- `src/data/glossary.json`: glossary terms; `match` phrases are auto-linked in app text
- `src/data/ranges/`: the 25 default charts (JSON); `src/data/charts.test.ts` holds the chart sanity checks
- `src/storage/answers.ts`: answer log in IndexedDB (falls back to memory)
- `src/ui/`: components (RangeGrid, PlayingCard, MiniTable), drill screens (`ui/drill/`), chart screens
- `docs/design.md`: the agreed design and milestones

## Status

- [x] M0: Foundations
- [x] M1: Range charts and grid
- [x] M2: Open-or-fold drill
- [x] M3: Facing a raise, facing a 3-bet, blinds defense
- [x] M4: Lessons, glossary, tap-to-explain, locked progression
- [x] M5: Stats, leak heatmap, smart repetition, backup
- [x] M6: Range editor, installable + offline, polish

**Phase 1 is complete.**

- [x] M7: Game engine and bots (logic only)
- [x] M8: Table screen vs bots, preflop grading, hand review
- [x] M9: Equity calculator, postflop bot logic, equity hint
- [x] M10: Postflop grading, lessons 6–7

Testing tip: open the app with `#unlock-all` at the end of the URL to unlock every lesson.

## Install on your phone

The app is hosted at **https://manhhung2111.github.io/practice-hub/**. Every push to
`main` lints, tests, builds and redeploys it (`.github/workflows/deploy.yml`).

The claude.ai preview link can't be installed (previews don't allow offline service
workers). Any HTTPS static host works too: build with `npm run build` and publish `dist/`.
Paths are relative, so a `/repo-name/` subfolder works.

Then open the URL on your phone:
- **iPhone (Safari):** Share → Add to Home Screen.
- **Android (Chrome):** menu → Install app.

After the first visit it works offline. Note: an installed app keeps its own stats,
separate from the preview link; use Stats → Copy backup / Restore to move them.
