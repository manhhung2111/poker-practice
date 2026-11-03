# Poker Practice Trainer

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
| `npm run lint` | ESLint |

## Layout

- `src/core/`: pure poker logic, no React, fully unit-tested
  - `cards.ts`: cards, deck, shuffle
  - `hands.ts`: 169 hand classes, 13×13 grid, combos, categories
  - `rangeParser.ts`: range notation (`22+, A2s+, KTo-K8o`) ↔ sets of hands
  - `strength.ts`: hand strength ranking (Chen formula) and top-% percentiles
  - `random.ts`: seeded RNG for reproducible tests
- `src/data/`: range charts, lessons, glossary (from M1)
- `src/ui/`: components and screens (from M1)
- `docs/design.md`: the agreed design and milestones

## Status

- [x] M0: Foundations
- [ ] M1: Range charts and grid
- [ ] M2: Open-or-fold drill
