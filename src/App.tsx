import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Spot } from './core/dealing'
import type { Grade } from './core/grading'
import {
  type ProgressState,
  allowedSeats,
  lessonProgress,
  parseProgress,
  recordAnswer,
  windowScore,
} from './core/progress'
import { DEFAULT_CHARTS } from './data/charts'
import { LESSONS } from './data/learning'
import { DrillScreen } from './ui/drill/DrillScreen'
import { DrillSetup } from './ui/drill/DrillSetup'
import { type DrillSettings, loadSettings, saveSettings } from './ui/drill/settings'
import { GlossaryScreen } from './ui/learn/GlossaryScreen'
import { TermContext } from './ui/learn/glossaryContext'
import { LearnHome } from './ui/learn/LearnHome'
import { LessonScreen } from './ui/learn/LessonScreen'
import { TermSheet } from './ui/learn/TermSheet'
import { ChartDetail } from './ui/screens/ChartDetail'
import { ChartList } from './ui/screens/ChartList'
import { safeStorage } from './ui/storage'

type Tab = 'drill' | 'stats' | 'learn'
type LearnView =
  | { kind: 'home' }
  | { kind: 'lesson'; id: string }
  | { kind: 'charts' }
  | { kind: 'chart'; id: string }
  | { kind: 'glossary' }

interface DrillRun {
  key: number
  settings: DrillSettings
  lessonId?: string
}

const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  {
    id: 'drill',
    label: 'Drill',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="4" y="3" width="11" height="16" rx="2" />
        <path d="M9 21h8a2 2 0 0 0 2-2V7" />
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
  {
    id: 'learn',
    label: 'Learn',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H11v18H5.5A2.5 2.5 0 0 1 3 18.5z" />
        <path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H13v18h5.5a2.5 2.5 0 0 0 2.5-2.5z" />
      </svg>
    ),
  },
]

const TAB_KEY = 'poker-trainer:tab'
const PROGRESS_KEY = 'poker-trainer:progress'

function loadProgress(): ProgressState {
  try {
    return parseProgress(JSON.parse(safeStorage.get(PROGRESS_KEY) ?? 'null'))
  } catch {
    return {}
  }
}

/** Developer/test switch (design §7.3): open the app with #unlock-all to unlock every lesson. */
const readUnlockAll = () => typeof location !== 'undefined' && location.hash === '#unlock-all'

export default function App() {
  const [tab, setTab] = useState<Tab>(() => {
    const saved = safeStorage.get(TAB_KEY)
    return saved === 'drill' || saved === 'stats' || saved === 'learn' ? saved : 'learn'
  })
  const [settings, setSettings] = useState(loadSettings)
  const [progress, setProgress] = useState(loadProgress)
  const [unlockAll, setUnlockAll] = useState(readUnlockAll)
  const [drill, setDrill] = useState<DrillRun | null>(null)
  const [learn, setLearn] = useState<LearnView>({ kind: 'home' })
  const [term, setTerm] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const allowed = useMemo(() => allowedSeats(progress, LESSONS, unlockAll), [progress, unlockAll])

  useEffect(() => safeStorage.set(TAB_KEY, tab), [tab])
  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => safeStorage.set(PROGRESS_KEY, JSON.stringify(progress)), [progress])
  useEffect(() => window.scrollTo(0, 0), [tab, learn, drill?.key])
  useEffect(() => {
    const onHash = () => setUnlockAll(readUnlockAll())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 4000)
    return () => clearTimeout(t)
  }, [banner])

  const onAnswer = useCallback((spot: Spot, grade: Grade) => {
    setProgress((prev) => {
      const r = recordAnswer(prev, LESSONS, spot.type, spot.hero, grade.correct)
      if (r.passed.length) {
        const passed = LESSONS.find((l) => l.id === r.passed[r.passed.length - 1])!
        const next = LESSONS.find((l) => l.number === passed.number + 1)
        setBanner(
          next
            ? `Lesson ${passed.number} passed! Lesson ${next.number} is unlocked.`
            : `Lesson ${passed.number} passed! You finished the preflop course.`,
        )
      }
      return r.state
    })
  }, [])

  const startDrill = (s: DrillSettings, lessonId?: string) => {
    setDrill({ key: Date.now(), settings: s, lessonId })
    setTab('drill')
  }

  const runLesson = drill?.lessonId ? LESSONS.find((l) => l.id === drill.lessonId) : undefined
  const runLessonProgress = runLesson && lessonProgress(progress, runLesson.id)

  const learnScreen = () => {
    switch (learn.kind) {
      case 'lesson': {
        const lesson = LESSONS.find((l) => l.id === learn.id)!
        return (
          <LessonScreen
            lesson={lesson}
            next={LESSONS.find((l) => l.number === lesson.number + 1)}
            progress={progress}
            onBack={() => setLearn({ kind: 'home' })}
            onDrill={() =>
              startDrill(
                { spot: lesson.drill.spot, positions: lesson.drill.positions, session: 'endless', dealing: 'smart' },
                lesson.id,
              )
            }
          />
        )
      }
      case 'charts':
        return (
          <>
            <BackRow onBack={() => setLearn({ kind: 'home' })} />
            <ChartList charts={DEFAULT_CHARTS} onOpen={(id) => setLearn({ kind: 'chart', id })} />
          </>
        )
      case 'chart': {
        const chart = DEFAULT_CHARTS.find((c) => c.id === learn.id)!
        return <ChartDetail key={chart.id} chart={chart} onBack={() => setLearn({ kind: 'charts' })} />
      }
      case 'glossary':
        return <GlossaryScreen onBack={() => setLearn({ kind: 'home' })} />
      default:
        return (
          <LearnHome
            lessons={LESSONS}
            progress={progress}
            unlockAll={unlockAll}
            onLesson={(id) => setLearn({ kind: 'lesson', id })}
            onCharts={() => setLearn({ kind: 'charts' })}
            onGlossary={() => setLearn({ kind: 'glossary' })}
          />
        )
    }
  }

  return (
    <TermContext.Provider value={setTerm}>
      <main className="app">
        {/* Kept mounted while hidden, so switching tabs doesn't lose a drill in progress. */}
        <div hidden={tab !== 'drill'}>
          {drill ? (
            <DrillScreen
              key={drill.key}
              charts={DEFAULT_CHARTS}
              settings={drill.settings}
              allowed={allowed}
              lesson={
                runLesson && runLessonProgress
                  ? {
                      number: runLesson.number,
                      title: runLesson.title,
                      passed: runLessonProgress.passed,
                      ...windowScore(runLessonProgress.recent),
                    }
                  : undefined
              }
              active={tab === 'drill'}
              onAnswer={onAnswer}
              onExit={() => {
                const fromLesson = drill.lessonId
                setDrill(null)
                if (fromLesson) setTab('learn')
              }}
            />
          ) : (
            <DrillSetup
              settings={settings}
              allowed={allowed}
              lessons={LESSONS}
              onChange={setSettings}
              onStart={() => startDrill(settings)}
            />
          )}
        </div>
        {tab === 'stats' && (
          <ComingSoon title="Stats" text="Your accuracy by spot and position, plus a heatmap of the hands you miss, arrive in M5." />
        )}
        {tab === 'learn' && learnScreen()}
      </main>

      {banner && (
        <div className="banner" role="status">
          {banner}
        </div>
      )}

      <nav className="tabbar" aria-label="Main">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="tab"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => {
                if (t.id === 'learn' && tab === 'learn') setLearn({ kind: 'home' })
                setTab(t.id)
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {term && <TermSheet id={term} onClose={() => setTerm(null)} />}
    </TermContext.Provider>
  )
}

function BackRow({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="back back-row" onClick={onBack}>
      ‹ Learn
    </button>
  )
}

function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <>
      <header className="header">
        <h1>{title}</h1>
      </header>
      <div className="empty">
        <h2>Coming soon</h2>
        <p>{text}</p>
      </div>
    </>
  )
}
