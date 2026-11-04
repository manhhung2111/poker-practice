# Piano Read a Row + Chords Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two piano drill modes, Read a row and Chords, beside the existing Single notes drill.

**Architecture:** Pure logic in `src/core/piano/` (chord spelling and pool, melody rows, stats), unit-tested.
UI in `src/ui/piano/`: `Staff` learns to draw several notes (row) or a stack (chord); `Keyboard` learns
selected/missed marks; two new drill components; setup and stats gain the new modes.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest (+ jsdom, @testing-library/react).

**Spec:** `docs/superpowers/specs/2026-11-04-piano-rows-and-chords-design.md`

## Global Constraints

- Single notes behaviour and its storage keys (`piano:stats`, `piano:settings` fields) keep working; old saved settings must load.
- On-screen answers are graded by pitch class; MIDI answers by exact MIDI number.
- Row length is 6 notes. Rows never stop after a mistake.
- Chords are major/minor triads in root position, spelled with single accidentals only, no E♯/B♯/C♭/F♭.
- Chord names (stats keys) are fixed: majors C, D♭, D, E♭, E, F, F♯, G, A♭, A, B♭, B; minors C, C♯, D, E♭, E, F, F♯, G, G♯, A, B♭, B.
- New storage keys: `piano:rows`, `piano:chords`. Not in the backup file.
- Reuse existing tokens and classes; both themes; phone width ≥ 360px with no horizontal scroll.
- Lint, `npm test`, `npm run build` all pass before each commit.

## Review Focus

1. Every Hand × Range × Sharps-and-flats combination yields a non-empty chord pool and valid rows (no crash on Start). → Task 1 and Task 2 tests.
2. Old `piano:settings` saved by PR #3 (has `length`, no `mode`) loads with mode `single` and that length. → Task 4 test.
3. Time spent on another tab or on Home is not counted as row or chord time (timer restarts when `active` becomes true). → Task 6 and Task 7 tests.
4. A MIDI player who presses the same key twice, or adds a 4th key, in a chord attempt: duplicates ignored; grading happens at the 3rd distinct key. → Task 7 test.
5. A row containing the same letter+octave twice shows the same accidental both times (accidentals hold for the row). → Task 2 test.

---

## File map

- Create `src/core/piano/chords.ts` (+ `chords.test.ts`): chord spelling, pool, grading.
- Create `src/core/piano/melody.ts` (+ `melody.test.ts`): row generation.
- Modify `src/core/piano/stats.ts` (+ test): generic keyed stats, row totals.
- Modify `src/ui/piano/settings.ts`: `mode`, per-mode lengths, migration.
- Modify `src/ui/piano/PianoSetup.tsx`: Drill choice, per-mode Session options.
- Modify `src/ui/piano/Staff.tsx`: draw a list of note columns.
- Modify `src/ui/piano/Keyboard.tsx`: `selected` and `missed` marks.
- Create `src/ui/piano/RowDrill.tsx` (+ test), `src/ui/piano/ChordDrill.tsx` (+ test).
- Modify `src/ui/piano/PianoDrill.tsx` (Single notes) only to pass the new Staff props.
- Modify `src/ui/piano/PianoApp.tsx`, `src/ui/piano/PianoStats.tsx`, `src/index.css`, `src/ui/screens.test.tsx`.

---

### Task 1: Chord spelling, pool and grading

**Files:** Create `src/core/piano/chords.ts`, `src/core/piano/chords.test.ts`

**Interfaces:**
- Consumes: `Note`, `Clef`, `Hand`, `Level`, `LEVEL_STEPS`, `clefsFor`, `midi`, `pitchClass`, `diatonic`, `noteFromDiatonic`, `LETTERS`, `ACC_SYMBOL` from `notes.ts`; `Rng` from `random.ts`.
- Produces:
  - `type Quality = 'major' | 'minor'`
  - `interface Chord { clef: Clef; quality: Quality; notes: [Note, Note, Note] }` (low to high)
  - `chordName(c: Chord): string` → e.g. `"F major"`, `"C♯ minor"` (root letter + accidental + quality)
  - `chordKey(c: Chord): string` → `` `${clef}:${chordName}` ``
  - `CHORD_ROOTS: Record<Quality, { letter: number; acc: -1 | 0 | 1 }[]>` (the fixed lists above)
  - `spellTriad(root: Note, quality: Quality): [Note, Note, Note]`
  - `chordPool(hand: Hand, level: Level, accidentals: boolean): Chord[]`
  - `pickChord(pool: readonly Chord[], last: Chord | null, weight?: (c: Chord) => number, rng?: Rng): Chord`
  - `isChordCorrectOnScreen(c: Chord, pitchClasses: ReadonlySet<number>): boolean`
  - `isChordCorrectMidi(c: Chord, midis: readonly number[]): boolean`

- [ ] **Step 1: Write failing tests** in `chords.test.ts`:
  - `spells triads`: names of `spellTriad` notes (via `noteName` without octave, i.e. `letterName`) — C major `['C','E','G']`, D major `['D','F♯','A']`, E♭ major `['E♭','G','B♭']`, C♯ minor `['C♯','E','G♯']`, G♯ minor `['G♯','B','D♯']`, B♭ minor `['B♭','D♭','F']`, F♯ major `['F♯','A♯','C♯']`.
  - `every listed chord spells with single valid accidentals`: for each root in `CHORD_ROOTS` both qualities, no note is E♯/B♯/C♭/F♭ and `|acc| <= 1`; and the semitone gaps are `[4,3]` for major, `[3,4]` for minor (via `midi`).
  - `naturals-only pool`: `chordPool('both','wide',false)` names (deduped) equal `{C major, F major, G major, D minor, E minor, A minor}`.
  - `range widened one ledger line`: `chordPool('right','staff',false)` contains `treble:C major` with bottom note C4 and `treble:D minor` reaching A5; no note has `staffStep < -2` or `> 10`.
  - `never empty`: for every hand × level × accidentals, `chordPool(...).length > 0`.
  - `grading`: C4-E4-G4 major — on-screen `{0,4,7}` true, `{0,4}` false, `{0,4,7,9}` false; MIDI `[64,60,67]` true, `[72,64,67]` false.
  - `pickChord never repeats`: 300 seeded picks, no two consecutive equal `chordKey`.
- [ ] **Step 2:** Run `npx vitest run src/core/piano/chords.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `chords.ts`. `spellTriad`: letters root, root+2, root+4 (diatonic, octave carried); choose each upper note's `acc` so semitones above the root are 4/7 (major) or 3/7 (minor). `chordPool`: for each clef in `clefsFor(hand)`, each root in `CHORD_ROOTS[q]` (only `acc === 0` roots and chords whose three notes are all natural when `accidentals` is false), each octave placing the chord with bottom step ≥ `lo - 2` and top step ≤ `hi + 2` where `[lo, hi] = LEVEL_STEPS[level]`. `pickChord` mirrors `pickPrompt` (exclude last key, weighted).
- [ ] **Step 4:** Run the test file → PASS.
- [ ] **Step 5: Commit** `feat(piano): chord spelling, pool and grading`.

### Task 2: Melody rows

**Files:** Create `src/core/piano/melody.ts`, `src/core/piano/melody.test.ts`

**Interfaces:**
- Consumes: `Note`, `Clef`, `Level`, `LEVEL_STEPS`, `staffStep`, `noteFromDiatonic`, `diatonic` from `notes.ts`; `Rng`, `seededRng`.
- Produces:
  - `type Phase = 'early' | 'later'`
  - `ROW_LENGTH = 6`
  - `makeRow(clef: Clef, level: Level, accidentals: boolean, phase: Phase, rng?: Rng): Note[]`
  - `phaseFor(rowIndex: number, sessionRows: number): Phase` — `sessionRows` 0 means endless.

- [ ] **Step 1: Write failing tests:**
  - `rows have 6 notes inside the level` for each clef × level × phase over 200 seeded rows (`staffStep` within `LEVEL_STEPS[level]`).
  - `no neighbouring repeats`: `diatonic(a) !== diatonic(b)` for neighbours.
  - `early rows are mostly steps`: over 300 early rows, share of moves of exactly 1 step ≥ 0.75; no move > 2 steps.
  - `later rows jump up to a 5th`: all moves ≤ 4 steps; some move of 3 or 4 steps appears.
  - `accidentals off → all natural`; `accidentals on → some ♯/♭, none E♯/B♯/C♭/F♭`.
  - `accidentals hold for the row`: for any two notes with equal letter+octave in one row, `acc` is equal (500 seeded rows, accidentals on).
  - `phaseFor`: `(0,10)`..`(4,10)` early, `(5,10)` later; `(4,0)` early, `(5,0)` later.
- [ ] **Step 2:** Run `npx vitest run src/core/piano/melody.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Steps per spec: early 1 step 85% / 2 steps 15%; later 1:40%, 2:30%, 3:15%, 4:15%. Direction keeps the previous direction with probability 0.7; a move that would leave the range reflects. ~20% accidental chance per note using the Single-notes valid set; a `Map` from `diatonic` to `acc` enforces the hold rule. `phaseFor` = early when `rowIndex < (sessionRows ? sessionRows / 2 : 5)`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(piano): melody row generator`.

### Task 3: Stats for chords and rows

**Files:** Modify `src/core/piano/stats.ts`, `src/core/piano/stats.test.ts`

**Interfaces:**
- Produces:
  - `recordStat<T extends Record<string, NoteStat>>(stats: T, key: string, correct: boolean, ms: number): T` (capped ms as today; `recordNote` becomes a wrapper)
  - `parseKeyedStats(raw: unknown, keyPattern: RegExp): Record<string, NoteStat>`; `parsePianoStats` uses it with `/^(treble|bass):/`
  - `statWeight(s: NoteStat | undefined): number` (today's `noteWeight` body; `noteWeight` delegates)
  - `interface RowTotals { rows: number; clean: number; notes: number; correct: number; ms: number }`
  - `EMPTY_ROWS: RowTotals`, `recordRow(t: RowTotals, notesRight: number, notes: number, ms: number): RowTotals`, `parseRowTotals(raw: unknown): RowTotals`

- [ ] **Step 1: Failing tests:** `recordRow` counts a clean row only when `notesRight === notes`; `parseRowTotals` returns `EMPTY_ROWS` for junk and negative numbers; `parseKeyedStats` keeps `treble:F major` with pattern `/^(treble|bass):/`; existing tests still pass unchanged.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(piano): keyed stats and row totals`.

### Task 4: Settings and setup screen

**Files:** Modify `src/ui/piano/settings.ts`, `src/ui/piano/PianoSetup.tsx`; Create `src/ui/piano/settings.test.ts`

**Interfaces:**
- Produces:
  - `type DrillMode = 'single' | 'row' | 'chord'`
  - `PianoSettings` gains `mode: DrillMode` and replaces `length` with `lengths: Record<DrillMode, number>`
  - `SESSION_CHOICES: Record<DrillMode, readonly number[]>` = `{ single: [20, 50, 0], row: [5, 10, 0], chord: [10, 20, 0] }`
  - `DEFAULT_PIANO_SETTINGS.lengths = { single: 20, row: 10, chord: 20 }`, `mode: 'single'`
  - `sessionLength(s: PianoSettings): number` → `s.lengths[s.mode]`

- [ ] **Step 1: Failing tests** (`settings.test.ts`, jsdom): old shape `{hand:'left',level:'ledger',accidentals:true,labels:false,length:50,midi:false}` loads as `mode:'single'`, `lengths.single === 50`, other lengths default; an invalid `lengths.row` (e.g. 7) falls back to 10; unknown `mode` → `'single'`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement load/save. In `PianoSetup`, add a first fieldset "Drill" (segmented: Single notes · Read a row · Chords) with one hint line each — "One note at a time." / "Six notes, left to right. Keep going." / "Play the three notes of a chord." The Session segmented uses `SESSION_CHOICES[mode]` with unit labels `notes` / `rows` / `chords`. Update `PianoDrill` and `PianoApp` to read `sessionLength(settings)` instead of `settings.length`.
- [ ] **Step 4:** Run `npm test` → PASS (existing PianoDrill test updated to `lengths: {...DEFAULT.lengths, single: 2}`).
- [ ] **Step 5: Commit** `feat(piano): drill mode setting and per-mode sessions`.

### Task 5: Staff and Keyboard for several notes

**Files:** Modify `src/ui/piano/Staff.tsx`, `src/ui/piano/Keyboard.tsx`, `src/ui/piano/PianoDrill.tsx`, `src/index.css`

**Interfaces:**
- Produces:
  - `type NoteMark = 'neutral' | 'right' | 'wrong' | 'upcoming'`
  - `interface StaffColumn { notes: Note[]; mark?: NoteMark }` — one x position; several notes = a stacked chord
  - `Staff` props become `{ clefs: Clef[]; clef: Clef; level: Level; columns: StaffColumn[]; current?: number; levelPad?: number }`. Columns are spread evenly from x = 70 to 280 (a single column sits at x = 190 as today). `current` draws the gold bar behind that column. `levelPad` (in steps, default 0) widens the margins for chords (pass 2).
  - Accidentals in a chord column: draw each sign to the left of the column; if two signs are within 4 steps of each other, offset the lower one a further 12 units left.
  - `KeyMark` gains `'selected'` (gold, `--accent`) and `'missed'` (green outline, no fill).

- [ ] **Step 1:** Update `PianoDrill` to pass `columns={[{ notes: [prompt.note], mark }]}` and `clef={prompt.clef}`. Run `npm test` → PASS (no behaviour change).
- [ ] **Step 2:** Visual check: a temporary `zz-preview.tsx` page rendering a 6-note row with `current=2` and marks right/wrong, and chords C4-E4-G4 (ledger), E♭-G-B♭ and C♯-E-G♯ (stacked signs), in both themes via headless Chrome at 500px. Expected: notes don't overlap, ledger lines per note, signs don't collide. Delete the preview files afterwards.
- [ ] **Step 3: Commit** `feat(piano): staff columns, chord stacks, key selection marks`.

### Task 6: Read a row drill

**Files:** Create `src/ui/piano/RowDrill.tsx`, `src/ui/piano/RowDrill.test.tsx`; Modify `src/index.css`

**Interfaces:**
- Consumes: `makeRow`, `phaseFor`, `ROW_LENGTH` (Task 2); `Staff` columns (Task 5); `isCorrect`, `noteName` (notes.ts); `useMidi`; `sessionLength`.
- Produces: `RowDrill(props: { settings: PianoSettings; active: boolean; onNote: (p: Prompt, correct: boolean, ms: number) => void; onRow: (right: number, total: number, ms: number) => void; onExit: () => void })`

Behaviour: clef per row = `settings.hand` both → random clef each row, else fixed; `Staff` always gets `clefs={[rowClef]}` (only the staff in use). On-screen taps grade by pitch class, MIDI by exact note (`isCorrect(note, midi, exact)`). Each answer marks that column right/wrong, records `onNote`, moves `current` on. After the 6th answer, wait 700 ms, call `onRow`, show next row (or the summary when `rowIndex === sessionLength`). Header: "Row 3 / 10" and running note %. Hint line: "Note 3 of 6". Timer restarts on new row and when `active` turns true. Summary: big score `right/total` notes, "X% right · Y s per row · Z clean rows", Missed chips (unique).

- [ ] **Step 1: Failing jsdom test** (fake timers, seeded `Math.random` via `vi.spyOn(Math, 'random')` sequence or by tapping until done): with `lengths.row = 1`, 6 taps call `onNote` 6 times; a 7th tap before the 700 ms is ignored; after `advanceTimersByTime(700)` `onRow` is called once with `total 6` and "Session done" shows. Second test: render with `active={false}`, advance 10 s, rerender `active`, tap → first `onNote` ms < 1000.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(piano): read-a-row drill`.

### Task 7: Chords drill

**Files:** Create `src/ui/piano/ChordDrill.tsx`, `src/ui/piano/ChordDrill.test.tsx`, `src/ui/piano/midiChord.ts` (+ `midiChord.test.ts`)

**Interfaces:**
- Consumes: `chordPool`, `pickChord`, `chordKey`, `chordName`, `isChordCorrectOnScreen`, `isChordCorrectMidi` (Task 1); `statWeight` (Task 3); `Staff` (`levelPad=2`), `Keyboard` marks (Task 5); `useMidi`.
- Produces:
  - `ChordDrill(props: { settings: PianoSettings; chordStats: Record<string, NoteStat>; active: boolean; onChord: (c: Chord, correct: boolean, ms: number) => void; onExit: () => void })`
  - `midiChord.ts`: `interface Attempt { keys: number[]; lastAt: number }`, `addPress(a: Attempt, midi: number, at: number): Attempt` (resets when `at - lastAt > 1500`; ignores duplicates), `complete(a: Attempt): boolean` (3 distinct keys).

Behaviour: `Staff` gets `clefs={[chord.clef]}`. Tap toggles a key `selected`; **Check** (full width under the keyboard, disabled with nothing selected) grades. Feedback: selected-and-right → `right`, selected-and-wrong → `wrong`, unselected chord tones → `missed`; text "F major: F A C" (green ✓ when right). Next chord after 450 ms (right) / 2000 ms (wrong). MIDI grades on `complete`. Summary like Row with "Missed" chord chips.

- [ ] **Step 1: Failing tests.** `midiChord.test.ts`: duplicates ignored; 4th key after complete starts a fresh attempt only after a gap > 1500 ms; gap resets. `ChordDrill.test.tsx` (jsdom): Check disabled initially; tapping C twice unselects; select three keys, Check → `onChord` once, keys disabled until advance; `lengths.chord = 1` → "Session done" after the wait.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(piano): chords drill`.

### Task 8: Wire into the app, stats tab, verify, ship

**Files:** Modify `src/ui/piano/PianoApp.tsx`, `src/ui/piano/PianoStats.tsx`, `src/ui/screens.test.tsx`, `src/index.css`, `README.md`

- [ ] **Step 1:** `PianoApp` loads/saves `piano:rows` (`parseRowTotals`) and `piano:chords` (`parseKeyedStats`); renders `PianoDrill` / `RowDrill` / `ChordDrill` by `settings.mode`; row notes go through the same `recordNote` as Single notes. Reset clears all three stats.
- [ ] **Step 2:** `PianoStatsScreen` gets `rows: RowTotals` and `chords` props. Adds a "Rows" line ("N rows · X% notes right · Y s per row · Z clean") and a "Chords" section (tiles per chord name coloured like the note grid, plus "Practise these" via `weakest(chords)`). The empty state shows only when all three are empty.
- [ ] **Step 3:** Smoke tests in `screens.test.tsx`: `RowDrill` and `ChordDrill` render for every hand × level × accidentals; stats render with sample rows/chords.
- [ ] **Step 4:** `npm run lint && npm test && npm run build` → all pass. Screenshots (headless Chrome, 500px, both themes) of setup, a row mid-way, a chord after a wrong Check, and the stats tab; delete preview files.
- [ ] **Step 5:** README piano bullet mentions rows and chords. Commit `feat(piano): rows and chords in app and stats`, push, open a PR.
