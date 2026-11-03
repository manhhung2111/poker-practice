# Poker Practice Trainer — Design

Status: **Draft, awaiting approval** · Date: 2026-11-03

## 1. Purpose

A phone-first practice app for a casual player to learn and drill poker decisions based on
**position** and **cards**. It teaches concepts as you go, grades every decision, tracks
weaknesses, and later lets you play full hands against bots.

### Goals
- Learn standard 9-max preflop ranges well enough to apply them at a real table.
- Understand *why* a decision is right, not just memorize it.
- See your leaks and drill them until they're fixed.
- Later: practice in real hand flow, including postflop basics.

### Non-goals (for now)
- Real-money play or multiplayer with other people.
- Solver-exact (GTO) strategy or true EV-in-bb numbers.
- Accounts, servers, cross-device sync.
- Limped pots, tournament / short-stack play (possible future additions).

## 2. Key decisions

| Topic | Decision |
|---|---|
| Game format | 9-max, 100bb cash |
| Player | Casual player, hasn't studied charts |
| Platform | Local web app, phone-first, installable (PWA); native app possible later |
| Tech | React + TypeScript + Vite, Vitest for tests, data stored on device (IndexedDB) |
| Ranges | Simplified standard charts authored for this app; mostly pure actions; editable in-app |
| Chart detail | Grouped positions, ~24 charts total |
| Language | English |
| Learning | Lessons with **locked progression**, tap-to-explain terms, glossary |
| Phase 2 | 2a: real hands vs bots, preflop graded → 2b: postflop graded by guidelines |
| Bots | Mixed table of personalities (Nit / Regular / Fish / Maniac) |

## 3. Poker conventions

- **Positions (9-max, in order of action preflop):** UTG, UTG+1, MP, LJ, HJ, CO, BTN, SB, BB.
- **Position groups** (used for grouped charts):
  - Early: UTG, UTG+1, MP
  - Middle: LJ, HJ
  - Late: CO, BTN
  - Blinds: SB, BB (usually charted individually)
- **Bet sizes (fixed so charts are consistent):**
  - Open raise: 2.5bb (SB open: 3bb)
  - 3-bet: 3× the open in position, 4× out of position / from the blinds
  - 4-bet: ~2.2× the 3-bet
- **No limpers** in Phase 1. Every drill spot is either unopened, facing one raise,
  or facing one 3-bet.
- **Hand classes:** 169 (13 pairs, 78 suited, 78 offsuit), shown on a 13×13 grid.

## 4. App structure

Bottom tab bar:

```
[ 🎯 Drill ] [ 🃏 Play ] [ 📊 Stats ] [ 📚 Learn ]
```

- **Drill**: preflop flashcard drills (Phase 1).
- **Play**: full hands vs bots (hidden until Phase 2).
- **Stats**: accuracy, leaks, progress.
- **Learn**: lesson path, glossary, range charts (view + edit).

## 5. Drills (Phase 1)

### 5.1 Spot types
1. **Open or fold (RFI)**: folded to you. Fold or raise.
2. **Facing a raise**: one player opened. Fold, call, or 3-bet.
3. **Facing a 3-bet**: you opened, someone re-raised. Fold, call, or 4-bet.
4. **Blinds defense**: you're SB/BB facing an open (a "steal"). Fold, call, or 3-bet.

### 5.2 Drill setup screen
Remembers the last choice.
- Spot type: Open / Facing raise / Facing 3-bet / Blinds / Mixed
- Positions: all, or a chosen subset
- Mode: Endless / 25-hand session / Weak spots only
- Dealing: Smart (default) / Realistic (see §8.3)
- Only spot types unlocked through the lesson path can be selected (see §7.3).

### 5.3 Drill screen

```
┌─────────────────────────┐
│ Facing raise · 12/25 ✅9 │
│                         │
│   UTG+1  raises 2.5bb   │
│   MP, LJ fold           │  ← action so far, plain text
│                         │
│   mini table: seats lit │  ← who raised, where you sit
│   YOU: CO               │
│                         │
│     [ K♠ ]  [ Q♠ ]      │
│                         │
├─────────────────────────┤
│ [ FOLD ] [ CALL ] [3-BET]│  ← big thumb buttons
└─────────────────────────┘
```

- Correct answer: quick ✅ and auto-advance after ~1s.
- Wrong answer: the feedback sheet stays until you tap **Next** (or swipe).

### 5.4 Feedback sheet

```
 ⚠ Clear mistake: you called
 Best: FOLD
 "KQs is strong, but vs an UTG+1 raise it's often
  dominated (AK, AQ, KK). 3-bet/call ranges here
  are tight."
 [ mini 13x13 grid, KQs highlighted ]
          [ Next hand ▸ ]
```

Details in §6.4 (severity) and §6.5 ("why" text).

## 6. Range data

### 6.1 Chart inventory (~24 charts)

| Spot | Charts |
|---|---|
| Open or fold | 8, one per position UTG → SB (exact, not grouped) |
| Facing a raise (incl. blinds defense) | 10: early/middle vs early, CO/BTN vs early, HJ/CO/BTN vs middle, BTN vs CO, SB vs early/middle, SB vs late, BB vs early, BB vs middle, BB vs late, BB vs SB |
| Facing a 3-bet | 7: early open vs 3-bet from behind / from the blinds, middle open vs behind / blinds, CO vs BTN, CO/BTN vs blinds, SB vs BB |

25 charts in total. A test checks that every valid position matchup maps to exactly one chart.

### 6.2 File format

One JSON file per chart in `src/data/ranges/`, written with standard range notation
(`22+`, `A2s+`, `KTo-K8o`). Hands not listed are folds. If a hand is listed under both
raise and call, raise wins; `mixed` entries override both.

```json
{
  "id": "facing-open/late-vs-early",
  "spot": "facing-open",
  "title": "CO/BTN facing an early-position raise",
  "hero": ["CO", "BTN"],
  "villain": ["UTG", "UTG+1", "MP"],
  "keyIdea": "Early raises are strong. Play tight; avoid hands that get dominated.",
  "actions": {
    "raise": "QQ+, AKs, AKo, A5s",
    "call":  "JJ-77, AQs-AJs, KQs, QJs, JTs"
  },
  "mixed": { "AQo": { "call": 0.5, "fold": 0.5 } },
  "notes": { "A5s": "Classic 3-bet bluff: blocks AA/AK, plays well when called." },
  "ev": {}
}
```

- `mixed`: optional frequencies. Any action with frequency > 0 counts as correct.
- `ev`: reserved for future EV data (e.g. imported solver charts). Not used in v1.
- `notes`: hand-specific "why" notes.

### 6.3 Editing (Learn → Range charts → a chart → Edit ranges)
- Pick an action, then tap or drag across cells to paint it. A stroke that starts on a
  cell that already has that action clears it to fold. Mixed hands from imported or
  edited data are kept; painting them makes them pure.
- Or edit the range text (`22+, A2s+, …`) and apply it to the grid, e.g. to paste a
  chart from another source.
- Live action shares and warnings for likely mistakes (AA/KK folded, 72o played).
- Edits are stored on the device as overrides (range notation) on top of the defaults,
  marked "Edited", used by drills and grading, and included in backups.
- Reset a chart to the app's default.

### 6.4 Severity rating
A fixed **hand strength ranking** of all 169 hands gives each hand a percentile. The
ranking uses the Chen formula (unrounded; ties broken by pair, top card, suitedness,
kicker), implemented in `src/core/strength.ts`. Percentiles are combo-weighted, out of
1326 combos.

For a wrong answer (`src/core/grading.ts`):
1. Find the nearest hand, by strength percentile, where the chosen action is correct.
   That is the edge of the region your hand is in.
2. **Depth** = that distance ÷ the size of the correct action's region. Folding QQ from
   UTG is deep inside a small raise region; opening KJo from UTG is right at the edge.

| Depth | Rating |
|---|---|
| ≤ 20% | 🟡 Close spot |
| 20–45% | 🟠 Clear mistake |
| > 45% | 🔴 Blunder |

Mixing up two ways of playing a hand (call vs raise) is capped at "clear mistake".
Thresholds live in one constant and can be tuned from user feedback.

### 6.5 "Why" text
Built from three layers, most specific first:
1. Hand-specific note from the chart (`notes`), if any.
2. Hand-type note, generated automatically from the hand's category (suited ace, offsuit
   broadway, small pair, suited connector, offsuit junk, ...).
3. The chart's `keyIdea`.

Glossary terms inside the text are tappable (§7.1).

### 6.6 Chart sanity tests
- Every chart resolves all 169 hands to an action, with frequencies summing to 1.
- Every valid position matchup maps to exactly one chart.
- Hands continued vs a 3-bet are always in that position's opening range.
- AA is never folded in any chart.
- RFI ranges are nested and widen from UTG to BTN.
- Every lesson and drill references charts that exist.
- Mixed frequencies sum to 1.

## 7. Learning layer

### 7.1 Tap-to-explain terms
Glossary terms (3-bet, defend, in position, dominated, blockers, equity, wet board, ...)
are underlined anywhere in the app. Tapping one opens a short card with a definition and
an example.

### 7.2 Glossary
Searchable list of all terms, in the Learn tab.

### 7.3 Lessons and locked progression

| # | Lesson | Unlocks drill |
|---|---|---|
| 1 | Positions & why they matter | Open or fold (late positions) |
| 2 | Opening ranges | Open or fold (all positions) |
| 3 | Facing a raise: call vs 3-bet | Facing a raise |
| 4 | Blinds & defending | Blinds defense |
| 5 | Facing a 3-bet | Facing a 3-bet |
| 6 | Pot odds & equity *(Phase 2)* | Play: graded hands |
| 7 | Board texture: wet vs dry *(Phase 2)* | Play: postflop |

- Each lesson: 1–2 minutes of reading with examples, then a few warm-up hands.
- **Unlock rule:** ≥ 80% accuracy over your last 20 hands of that lesson's drill unlocks
  the next lesson.
- Completed lessons and their drills stay open for review.
- Lesson and glossary text lives in content files (Markdown/JSON), not in code.
- A developer-only "unlock all" switch exists for testing.

## 8. Stats and smart repetition

### 8.1 Logged per answer
Timestamp, chart id, position(s), hand, your action, correct action(s), severity,
time to answer, and source (drill or play).

### 8.2 Stats screen
- Overall accuracy and trend over the last 7 and 30 days
- Accuracy by spot type and by position (weakest highlighted)
- Leak heatmap: 13×13 grid per chart, colored by miss rate
- Most-missed hands, with a "Drill these" button
- Lesson progress

### 8.3 Dealing modes
- **Smart (default):**
  - ~20% replays of hands you missed, when one is due and fits the drill. Spaced
    repetition: a miss is due again after 3 answers, then 10, 30 and 100 as you get it
    right; a fourth correct answer in a row removes it. A new miss restarts it.
  - the rest: 60% hands near the edge of a range, where decisions are hard (a hand is an
    "edge" hand when a neighbouring grid cell, or the next pair for pairs, has a different
    action), 40% random, so you keep seeing normal hands
- **Weak spots:** only hands from the review queue (due first), within the chosen spot
  and seats. Falls back to Smart when the queue is empty.
- **Realistic:** true card frequencies.

### 8.4 Storage
- Answer log in IndexedDB on the device; lesson progress and settings in localStorage.
  If storage is blocked, the app works in memory and says so on the Stats screen.
- Backup = one JSON text (answers + lesson progress; range edits join in M6).
  Copy to clipboard (works inside the claude.ai preview) or download (installed app),
  restore by pasting or picking a file. Reset all data has an in-page confirmation.

## 9. Phase 2: Play vs bots

### 9.1 Phase 2a: real hands, preflop graded
- Full 9-max hands: blinds, button movement, dealing, betting rounds.
- Your preflop decisions are graded against the same charts as the drills.
- Postflop isn't graded in 2a: the board runs out to showdown.

### 9.2 Phase 2b: postflop graded by guidelines
- **Equity:** Monte Carlo simulation of your hand against the bot's estimated range.
- **Pot odds:** required equity to call vs your equity.
- **Rule-based checks:** c-bet on dry vs wet boards, value-bet strong hands, avoid
  bluffing into many players.
- All postflop grades are labeled **guidelines**, not solver truth.

### 9.3 Bots
| Personality | Preflop | Postflop |
|---|---|---|
| 🧊 Nit | Tighter than the charts | Bets only strong hands, folds a lot |
| 🎯 Regular | Follows the charts | Equity/pot-odds based, balanced |
| 🐟 Fish | Plays too many hands, calls too much | Calls down light, rarely bluffs |
| 🔥 Maniac | Raises a lot | Bets and bluffs often |

- The table is a random mix. Personality icons are visible so you can adjust.
- Bot decisions include some randomness so they aren't predictable.

### 9.4 Game engine
- Betting rules, including min-raise and all-ins
- Side pots and split pots
- 7-card hand evaluator and showdown
- Practice chips with free rebuys

### 9.5 Table screen (portrait)

```
┌─────────────────────────┐
│   🐟     🧊     🎯       │
│ 🔥                 🐟    │
│      K♥ 7♣ 2♥  [ ][ ]   │
│ 🎯    Pot: 12bb     🧊   │
│        YOU (BTN)        │
│      [ A♥ ] [ 9♥ ]      │
│  equity 58% (toggle)    │
├─────────────────────────┤
│ [Fold] [Check] [Bet ▸]  │
│  ⅓   ½   ⅔   pot  all-in│
└─────────────────────────┘
```

- Fast-forward through bot actions.
- Optional "skip trivial folds", off by default and can be turned on.
- Optional live hints (pot odds, equity), off by default.

### 9.6 Hand review and history

```
Hand #142 · You: BTN A♥9♥ · Won 14bb
 Preflop  call vs MP raise   ✅ in range
 Flop     check (K♥7♣2♥)     ⚠ betting is better: flush draw + overcard
 Turn     call 8bb into 20   ✅ needed 29%, had 35%
```

- Hand histories are saved and can be replayed.
- Play decisions feed the same stats as drills.

## 10. Architecture

### 10.1 Folder structure (planned)

```
src/
  core/          # pure TypeScript, no React; fully unit-tested
    cards.ts         # Card, Rank, Suit, deck, shuffle
    hands.ts         # 169 hand classes, grid layout, categories
    rangeParser.ts   # "22+, A2s+, KTo-K8o" -> hand set
    strength.ts      # 169-hand strength ranking / percentiles
    charts.ts        # load charts, merge user overrides, lookup action
    grading.ts       # correct/incorrect, severity, why-text assembly
    dealing.ts       # smart / realistic spot generation, spaced repetition
    engine/          # Phase 2: betting, pots, evaluator, showdown
    bots/            # Phase 2: personalities, decision logic
    equity.ts        # Phase 2b: Monte Carlo equity
  data/
    ranges/          # chart JSON files
    lessons/         # lesson content
    glossary.json
  storage/           # IndexedDB wrapper, backup export/import
  ui/
    components/      # Card, RangeGrid, MiniTable, FeedbackSheet, Term, ...
    screens/         # Drill, DrillSetup, Stats, Learn, Lesson, RangeEditor, Play
  App.tsx
docs/
  design.md
```

Rule: all poker logic lives in `core/`, separate from the UI, so it can be tested on its
own and reused unchanged in a future native app.

### 10.2 Core types (sketch)

```ts
type Position = 'UTG'|'UTG+1'|'MP'|'LJ'|'HJ'|'CO'|'BTN'|'SB'|'BB';
type Action = 'fold' | 'call' | 'raise';      // raise = open / 3-bet / 4-bet by context
type HandClass = string;                       // 'AKs', 'QJo', '77'
type SpotType = 'rfi' | 'facing-open' | 'facing-3bet' | 'blinds';

interface Chart {
  id: string; spot: SpotType; title: string;
  hero: Position[]; villain?: Position[];
  keyIdea: string;
  strategy: Record<HandClass, Partial<Record<Action, number>>>; // frequencies, sum 1
  notes: Record<HandClass, string>;
}

interface Spot {
  chartId: string; hero: Position; villain?: Position;
  cards: [Card, Card]; history: string[];      // e.g. ['UTG+1 raises 2.5bb', 'MP folds']
}

interface AnswerLog {
  at: number; chartId: string; hand: HandClass; chosen: Action;
  correct: Action[]; severity: 'none'|'close'|'clear'|'blunder';
  ms: number; source: 'drill' | 'play';
}
```

### 10.3 Preview on phone
Each milestone build is bundled into a single file and published as a **private
claude.ai artifact link**, so it opens on the phone without running a server. Data is
stored per device and browser.

## 11. Milestones

Each milestone ends with a check on the phone and user feedback before the next starts.

### Phase 1: Drills and learning
| # | Milestone | Result |
|---|---|---|
| M0 | Foundations: project setup (reuse scaffold), PWA config, Vitest, `cards`, `hands`, `rangeParser`, `strength` | Tests only |
| M1 | Author ~24 charts, chart sanity tests, `RangeGrid` component, chart browser | Browse charts on phone |
| M2 | Open-or-fold drill end to end: setup, drill screen, grading, severity, why-text, feedback sheet | **First usable trainer** |
| M3 | Facing raise, facing 3-bet, blinds; mini table | All preflop drills |
| M4 | Glossary, tap-to-explain, lessons 1–5, locked progression | Learning path |
| M5 | Answer log, stats screen, leak heatmap, smart dealing, backup | Progress tracking |
| M6 | Range editor, installable + offline, polish | **Phase 1 complete** |

### Phase 2a: Real hands, preflop graded
| # | Milestone | Result |
|---|---|---|
| M7 | Game engine: betting, all-ins, side pots, evaluator, showdown | Tests only |
| M8 | Table screen, bots, preflop grading, hand review, history | Play real hands |

### Phase 2b: Postflop
| # | Milestone | Result |
|---|---|---|
| M9 | Equity calculator, postflop bot logic, equity hint | Live equity |
| M10 | Postflop grading, lessons 6–7 | **Full game** |

## 12. Testing

Automated (Vitest) for every place where a bug would teach wrong poker:
- Range parser: all notation forms, edge cases (`22+`, `A2s+`, `KTo-K8o`, `AK`)
- Chart sanity checks (§6.6)
- Grading and severity thresholds
- Smart dealing distribution and spaced-repetition schedule
- Hand evaluator against known hand rankings
- Betting rules and side pots, including multi-way all-in cases
- Equity calculator against known values (e.g. AA vs KK ≈ 82%, AKs vs QQ ≈ 46%)

Manual: try each milestone on the phone.

## 13. Risks and open questions

- **Chart quality:** charts are simplified standard ranges written for this app, not
  solver output. Mitigation: sanity tests, editable charts, import support.
- **Severity is a proxy** based on hand strength distance, not true EV. It is presented
  as close / clear / blunder, never as bb numbers.
- **Postflop grading (2b)** is heuristic. It is labeled as guidelines.
- **Device-only storage** can be lost if browser data is cleared. Mitigation: backup export.
- **Existing scaffold:** a Vite React-TS project was partly created during an interrupted
  command. M0 verifies it and either reuses it or recreates it cleanly.
- **Future:** tournament / short-stack charts, limped pots, native app wrapper
  (Capacitor), optional AI coach explanations.
