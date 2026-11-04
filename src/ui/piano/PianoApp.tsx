import { useCallback, useEffect, useState } from 'react'
import type { Prompt } from '../../core/piano/notes'
import { type PianoStats, parsePianoStats, recordNote } from '../../core/piano/stats'
import { HomeTab } from '../HomeTab'
import { safeStorage } from '../storage'
import { PianoDrill } from './PianoDrill'
import { PianoSetup } from './PianoSetup'
import { PianoStatsScreen } from './PianoStats'
import { loadPianoSettings, savePianoSettings } from './settings'

type Tab = 'practice' | 'stats'
const STATS_KEY = 'piano:stats'

function loadStats(): PianoStats {
  try {
    return parsePianoStats(JSON.parse(safeStorage.get(STATS_KEY) ?? 'null'))
  } catch {
    return {}
  }
}

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
  const [run, setRun] = useState<number | null>(null)

  useEffect(() => savePianoSettings(settings), [settings])
  useEffect(() => safeStorage.set(STATS_KEY, JSON.stringify(stats)), [stats])

  const onAnswer = useCallback((p: Prompt, correct: boolean, ms: number) => setStats((s) => recordNote(s, p, correct, ms)), [])

  return (
    <>
      <main className="app">
        <div hidden={tab !== 'practice'}>
          {run !== null ? (
            <PianoDrill key={run} settings={settings} stats={stats} active={active && tab === 'practice'} onAnswer={onAnswer} onExit={() => setRun(null)} />
          ) : (
            <PianoSetup settings={settings} onChange={setSettings} onStart={() => setRun(Date.now())} />
          )}
        </div>
        {tab === 'stats' && <PianoStatsScreen stats={stats} onReset={() => setStats({})} />}
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
