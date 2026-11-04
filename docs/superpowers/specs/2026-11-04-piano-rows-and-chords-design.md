# Piano: Read a Row and Chords — Design

Date: 2026-11-04 · Status: approved in conversation; pending written sign-off

## Why

The piano section (PR #3) drills one note at a time. That trains recognising single notes, but the
user wants two further skills:

- **Reading a piece:** reading notes one after another, keeping going, eyes moving ahead.
- **Recognising chords:** seeing a stacked chord as one shape (bottom note plus the gaps above it)
  and playing it, instead of working out each note separately.

Success: the user can pick either drill from the piano setup screen on a phone, practise a session
end to end, and see their progress in Stats.

## Goals

- Two new drill modes beside the existing one: **Single notes** (unchanged), **Read a row**, **Chords**.
- Both work on the on-screen keyboard and on a MIDI keyboard.
- Results feed the Stats tab.

## Non-goals (for now)

- Two-hand rows (melody on treble and bass line together). The user considered it and left it out.
- Naming chords from buttons (bottom note + major/minor). The user chose to **play the keys** instead.
- Chord inversions, 7th chords, diminished/augmented chords, key signatures, rhythm.
- Audio playback of notes or chords.

## Anti-goals

- Don't change how Single notes behaves or its stats keys.
- Don't make the row stop after a mistake. Keeping going is the skill.
- Don't show chords spelled wrongly (e.g. D major as D G♭ A). A misspelled chord teaches the wrong shape.

## Constraints

- Same app, same stack: React + TypeScript + Vite, phone first, both themes, offline PWA.
- Reuse what exists: `src/core/piano/notes.ts` (notes, staff steps, ranges, accidentals), `Staff`,
  `Keyboard`, `useMidi`, `safeStorage`, the setup/summary/stats styles.
- The existing setup options keep applying to the new modes: **Hand** (right = treble, left = bass,
  both = either staff per item), **Range** level, **Sharps & flats**, **Key names**, **MIDI keyboard**.
- On-screen keyboard is one octave, so on-screen answers are graded on pitch class (letter + ♯/♭);
  MIDI answers must match the exact octave. Same rule as Single notes.
- Stats live in localStorage under new `piano:*` keys; not in the backup file (unchanged limitation).

## What the user decided

### Drill choice

The piano setup screen gets a **Drill** choice at the top: Single notes · Read a row · Chords.
Settings are remembered as today.

### Read a row

- Six notes across one staff. The user plays them left to right. A gold bar marks the current note.
- Each answer colours that note: green if right, red if wrong. The row always moves on to the next
  note; after the sixth note, a short pause, then the next row.
- **Melodies are stepwise first:** early rows move mostly to the neighbouring note up or down,
  like real tunes. Later rows in the session mix in jumps.
- With Hand = Both, each row sits on one staff, and the staff changes from row to row.
- Session: 10 rows by default.
- Summary: note accuracy, average time per row, missed notes.
- Every note answered in a row also counts toward the per-note stats used by Single notes.

### Chords

- A three-note chord appears stacked on one staff (no key signature; accidentals drawn per note).
- **The user plays the keys:** on screen, tap the chord's keys in any order (tap again to unselect),
  then press **Check**. On MIDI, press the keys together; it checks on its own.
- Feedback: correct selected keys green, wrong selected keys red, missed keys outlined. The text
  names the chord and its notes, e.g. "F major: F A C".
- Start with **major and minor chords in root position** (the "snowman" shape).
- Stats tab gets a Chords section: accuracy per chord and the chords missed most.

## My calls (left to me; the user can overrule)

- **Session lengths per mode.** The Session control's choices change with the drill:
  Single notes 20 / 50 / Endless notes (unchanged); Read a row 5 / 10 / Endless rows (default 10);
  Chords 10 / 20 / Endless chords (default 20). Stored per mode so switching drills doesn't reset them.
- **Row melody rules.**
  - The first note is random within the level's range; each later note moves by a diatonic interval.
  - "Early" = the first half of a fixed-length session, or the first 5 rows of an endless one: moves of
    1 step (a 2nd) about 85% of the time and 2 steps (a 3rd) otherwise.
  - "Later": moves of 1–4 steps (2nd to 5th), weighted toward small ones (1: 40%, 2: 30%, 3: 15%, 4: 15%).
  - Direction is random but biased to keep moving the same way for a few notes, and it reflects off the
    range edges so every note stays inside the chosen level. No two neighbouring notes are identical.
  - With Sharps & flats on, each note has about a 20% chance of a ♯/♭, using the same valid set as
    Single notes (no E♯, B♯, C♭, F♭).
  - **Accidentals hold for the row**, as they would within a bar: once a letter-and-octave appears in a
    row, every later appearance of it in that row uses the same ♯/♭/natural. Its sign is redrawn each
    time (a courtesy accidental), so no natural sign is ever needed.
- **Row layout.** The clef sits on the left; the six notes are evenly spaced across the rest, with room
  for an accidental before each. The staff keeps the same height rules as Single notes for the level.
- **Row timing.** A note's time = from the previous answer (or the row appearing) to this answer, capped
  the same way as Single notes. Row time = first note shown to last note answered.
- **Chord set.** Major and minor triads in root position whose three notes all fit inside the level's
  range on that staff, **widened by one ledger line each way for chords** (2 steps). Without this the
  default setup (right hand, on the staff) would never show C major; with it, the treble staff gets
  C major on middle C, and D minor up to A5.
  - With Sharps & flats **off**, only chords made of natural notes: C, F, G major; D, E, A minor.
  - With it **on**: majors and minors on all 12 roots, spelled correctly by stacking letters (root,
    3rd, 5th letter) and adding ♯/♭ to hit the right pitches. Leave out any chord that needs a double
    sharp/flat or E♯/B♯/C♭/F♭.
  - Spelling is fixed per chord, and the name is the stats key, so it must not change later:
    - Majors: C, D♭, D, E♭, E, F, F♯, G, A♭, A, B♭, B.
    - Minors: C, C♯, D, E♭, E, F, F♯, G, G♯, A, B♭, B.
    - Check: every one of these spells with single accidentals only; a test asserts that.
- **Chord picking.** Missed chords come up more often, using the same weighting idea as notes; never the
  same chord twice in a row.
- **Chord grading.**
  - On screen: correct when the set of selected pitch classes equals the chord's three pitch classes.
    Check is enabled once at least one key is selected.
  - MIDI: collect note-on keys; grade once three different keys have been pressed, with a press more than
    1.5 s after the previous one starting a fresh attempt. Correct when those three MIDI numbers equal
    the chord's exactly.
- **Hand = Both.** Rows and chords show **only the staff in use** (its clef drawn, eyebrow label naming
  the hand), not the grand staff. A six-note row on a grand staff at the widest range is too tall for a
  phone, and the clef still has to be read. Single notes keeps its grand staff.
- **Check button.** Full width, directly under the keyboard, as in the mockup.
- **Stats storage.**
  - Row notes go into the existing per-note stats (`piano:stats`).
  - Rows: `piano:rows` holds totals (rows, clean rows with no mistake, notes, correct, total ms) for the
    Stats tab line "Rows: N · X% notes right · Y s per row".
  - Chords: `piano:chords` keyed like `treble:F major`, with the same `{ n, correct, ms }` shape.
- **Stats tab layout.** Add a Rows line and a Chords section (tiles per chord coloured by accuracy, plus
  "Practise these" for chords) under the existing note sections. Reset clears all piano keys.
- **Tests.** Pure functions get unit tests: melody generation (in range, stepwise share in early rows, no
  repeats), chord spelling (C major = C E G, D major = D F♯ A, E♭ major = E♭ G B♭, C♯ minor = C♯ E G♯,
  no double accidentals), chord fitting the range, chord grading (on-screen and MIDI). One jsdom test
  each drives a short row session and a short chord session to the summary.

## Left to the builder

- Component structure (one drill component per mode, or a shared shell).
- Exact visuals for the current-note bar, missed-key outline and the selected-key state, within the
  existing tokens and the mockup's look (gold bar, green/red notes, gold selected keys).
- Exact copy for hints and summaries, following the existing tone.
