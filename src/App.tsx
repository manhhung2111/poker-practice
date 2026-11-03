import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BackupData } from './core/backup'
import type { ReviewPool, Spot } from './core/dealing'
import type { Grade } from './core/grading'
import type { AnswerLog } from './core/log'
import { POSITIONS } from './core/positions'
import { buildReviews, dueItems, queuedItems } from './core/review'
import {
  type ProgressState,
  allowedSeats,
  lessonProgress,
  parseProgress,
  recordAnswer,
  windowScore,
} from './core/progress'
import { type ChartOverride, type Overrides, applyOverride, parseOverrides } from './core/overrides'
import { DEFAULT_CHART_DEFS, DEFAULT_CHARTS } from './data/charts'
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
import { ChartEditor } from './ui/screens/ChartEditor'
import { ChartList } from './ui/screens/ChartList'
import { StatsScreen } from './ui/stats/StatsScreen'
import { safeStorage } from './ui/storage'
import { addAnswer, loadAnswers, replaceAnswers } from './storage/answers'

type Tab = 'drill' | 'stats' | 'learn'
type LearnView =
  | { kind: 'home' }
  | { kind: 'lesson'; id: string }
  | { kind: 'charts' }
  | { kind: 'chart'; id: string }
  | { kind: 'edit'; id: string }
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
const RANGES_KEY = 'poker-trainer:ranges'

function loadOverrides(): Overrides {
  try {
    return parseOverrides(JSON.parse(safeStorage.get(RANGES_KEY) ?? 'null'), DEFAULT_CHART_DEFS)
  } catch {
    return {}
  }
}

/** Default charts with the user's edits applied, in the default order. */
function buildCharts(overrides: Overrides) {
  return DEFAULT_CHARTS.map((c) => {
    const o = overrides[c.id]
    if (!o) return c
    const def = DEFAULT_CHART_DEFS.find((d) => d.id === c.id)!
    return { ...applyOverride(def, o), edited: true }
  })
}

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
  const [answers, setAnswers] = useState<AnswerLog[]>([])
  const [persistent, setPersistent] = useState(true)
  const [overrides, setOverrides] = useState(loadOverrides)
  const charts = useMemo(() => buildCharts(overrides), [overrides])

  const allowed = useMemo(() => allowedSeats(progress, LESSONS, unlockAll), [progress, unlockAll])
  const review = useMemo<ReviewPool>(() => {
    const q = buildReviews(answers)
    return { due: dueItems(q), queued: queuedItems(q) }
  }, [answers])

  useEffect(() => {
    let cancelled = false
    loadAnswers().then(({ answers: saved, persistent }) => {
      if (cancelled) return
      // Keep anything answered while loading.
      setAnswers((now) => [...saved, ...now])
      setPersistent(persistent)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => safeStorage.set(TAB_KEY, tab), [tab])
  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => safeStorage.set(PROGRESS_KEY, JSON.stringify(progress)), [progress])
  useEffect(() => safeStorage.set(RANGES_KEY, JSON.stringify(overrides)), [overrides])
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

  const onAnswer = useCallback((spot: Spot, grade: Grade, ms: number) => {
    const entry: AnswerLog = {
      at: Date.now(),
      chartId: spot.chart.id,
      type: spot.type,
      hero: spot.hero,
      ...(spot.villain ? { villain: spot.villain } : {}),
      hand: spot.hand,
      chosen: grade.chosen,
      best: grade.best,
      correct: grade.correct,
      severity: grade.severity,
      ms,
      source: 'drill',
    }
    setAnswers((prev) => [...prev, entry])
    void addAnswer(entry)
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

  const onImport = (data: BackupData) => {
    setAnswers(data.answers)
    setProgress(data.progress)
    setOverrides(data.ranges)
    void replaceAnswers(data.answers)
  }

  const onReset = () => {
    setAnswers([])
    setProgress({})
    setOverrides({})
    setDrill(null)
    void replaceAnswers([])
  }

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
            <ChartList charts={charts} onOpen={(id) => setLearn({ kind: 'chart', id })} />
          </>
        )
      case 'chart': {
        const chart = charts.find((c) => c.id === learn.id)!
        return (
          <ChartDetail
            key={chart.id}
            chart={chart}
            onBack={() => setLearn({ kind: 'charts' })}
            onEdit={() => setLearn({ kind: 'edit', id: chart.id })}
          />
        )
      }
      case 'edit': {
        const chart = charts.find((c) => c.id === learn.id)!
        const def = DEFAULT_CHART_DEFS.find((d) => d.id === learn.id)!
        return (
          <ChartEditor
            key={chart.id}
            def={def}
            chart={chart}
            onCancel={() => setLearn({ kind: 'chart', id: chart.id })}
            onSave={(o: ChartOverride | null) => {
              setOverrides((prev) => {
                const next = { ...prev }
                if (o) next[chart.id] = o
                else delete next[chart.id]
                return next
              })
              setBanner(o ? 'Chart saved. Drills now use your version.' : 'Chart reset to the default.')
              setLearn({ kind: 'chart', id: chart.id })
            }}
          />
        )
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
              charts={charts}
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
              review={review}
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
              queueSize={review.queued.length}
              onChange={setSettings}
              onStart={() => startDrill(settings)}
            />
          )}
        </div>
        {tab === 'stats' && (
          <StatsScreen
            answers={answers}
            charts={charts}
            ranges={overrides}
            chartDefs={DEFAULT_CHART_DEFS}
            lessons={LESSONS}
            progress={progress}
            persistent={persistent}
            queueSize={review.queued.length}
            onDrillWeak={() => startDrill({ spot: 'mixed', positions: [...POSITIONS], session: 'session', dealing: 'weak' })}
            onImport={onImport}
            onReset={onReset}
          />
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
