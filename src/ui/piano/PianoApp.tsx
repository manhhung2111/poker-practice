import { useCallback, useEffect, useState } from 'react'
import { type Chord, chordKey } from '../../core/piano/chords'
import type { Prompt } from '../../core/piano/notes'
import {
  EMPTY_ROWS,
  type NoteStat,
  type PianoStats,
  type RowTotals,
  parseKeyedStats,
  parsePianoStats,
  parseRowTotals,
  recordNote,
  recordRow,
  recordStat,
} from '../../core/piano/stats'
import { HomeTab } from '../HomeTab'
import { safeStorage } from '../storage'
import { ChordDrill } from './ChordDrill'
import { PianoDrill } from './PianoDrill'
import { PianoSetup } from './PianoSetup'
import { PianoStatsScreen } from './PianoStats'
import { RowDrill } from './RowDrill'
import { loadPianoSettings, savePianoSettings } from './settings'

type Tab = 'practice' | 'stats'
const STATS_KEY = 'piano:stats'
const ROWS_KEY = 'piano:rows'
const CHORDS_KEY = 'piano:chords'

/** Reads a stored JSON value through `parse`, falling back on anything unreadable. */
function load<T>(key: string, parse: (raw: unknown) => T): () => T {
  return () => {
    try {
      return parse(JSON.parse(safeStorage.get(key) ?? 'null'))
    } catch {
      return parse(null)
    }
  }
}
const loadStats = load<PianoStats>(STATS_KEY, parsePianoStats)
const loadRows = load<RowTotals>(ROWS_KEY, parseRowTotals)
const loadChords = load<Record<string, NoteStat>>(CHORDS_KEY, (raw) => parseKeyedStats(raw, /^(treble|bass):/))

const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  {
    id: 'practice',
    label: 'Practice',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M9 18V5l11-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="17" cy="16" r="3" />
      </svg>
    ),
  },
  {
    id: 'stats',
    label: 'Stats',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
]

export function PianoApp({ active = true, onHome }: { active?: boolean; onHome?: () => void }) {
  const [tab, setTab] = useState<Tab>('practice')
  const [settings, setSettings] = useState(loadPianoSettings)
  const [stats, setStats] = useState(loadStats)
  const [rows, setRows] = useState(loadRows)
  const [chords, setChords] = useState(loadChords)
  const [run, setRun] = useState<number | null>(null)

  useEffect(() => savePianoSettings(settings), [settings])
  useEffect(() => safeStorage.set(STATS_KEY, JSON.stringify(stats)), [stats])

  useEffect(() => safeStorage.set(ROWS_KEY, JSON.stringify(rows)), [rows])
  useEffect(() => safeStorage.set(CHORDS_KEY, JSON.stringify(chords)), [chords])

  const onAnswer = useCallback((p: Prompt, correct: boolean, ms: number) => setStats((s) => recordNote(s, p, correct, ms)), [])
  const onRow = useCallback((right: number, total: number, ms: number) => setRows((t) => recordRow(t, right, total, ms)), [])
  const onChord = useCallback((c: Chord, correct: boolean, ms: number) => setChords((s) => recordStat(s, chordKey(c), correct, ms)), [])
  const drillActive = active && tab === 'practice'
  const exit = () => setRun(null)

  return (
    <>
      <main className="app">
        <div hidden={tab !== 'practice'}>
          {run !== null ? (
            settings.mode === 'row' ? (
              <RowDrill key={run} settings={settings} active={drillActive} onNote={onAnswer} onRow={onRow} onExit={exit} />
            ) : settings.mode === 'chord' ? (
              <ChordDrill key={run} settings={settings} chordStats={chords} active={drillActive} onChord={onChord} onExit={exit} />
            ) : (
              <PianoDrill key={run} settings={settings} stats={stats} active={drillActive} onAnswer={onAnswer} onExit={exit} />
            )
          ) : (
            <PianoSetup settings={settings} onChange={setSettings} onStart={() => setRun(Date.now())} />
          )}
        </div>
        {tab === 'stats' && (
          <PianoStatsScreen
            stats={stats}
            rows={rows}
            chords={chords}
            onReset={() => {
              setStats({})
              setRows(EMPTY_ROWS)
              setChords({})
            }}
          />
        )}
      </main>
      <nav className="tabbar" aria-label="Piano">
        <div className="tabbar-inner">
          {onHome && <HomeTab onHome={onHome} />}
          {TABS.map((t) => (
            <button key={t.id} type="button" className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
