import { useEffect, useState } from 'react'
import { DEFAULT_CHARTS } from './data/charts'
import { DrillScreen } from './ui/drill/DrillScreen'
import { DrillSetup } from './ui/drill/DrillSetup'
import { loadSettings, saveSettings } from './ui/drill/settings'
import { ChartDetail } from './ui/screens/ChartDetail'
import { ChartList } from './ui/screens/ChartList'
import { safeStorage } from './ui/storage'

type Tab = 'drill' | 'stats' | 'learn'

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
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
      </svg>
    ),
  },
]

const TAB_KEY = 'poker-trainer:tab'

export default function App() {
  const [tab, setTab] = useState<Tab>(() => {
    const saved = safeStorage.get(TAB_KEY)
    return saved === 'drill' || saved === 'stats' || saved === 'learn' ? saved : 'drill'
  })
  const [settings, setSettings] = useState(loadSettings)
  const [drilling, setDrilling] = useState(false)
  const [chartId, setChartId] = useState<string | null>(null)
  const chart = DEFAULT_CHARTS.find((c) => c.id === chartId)

  useEffect(() => safeStorage.set(TAB_KEY, tab), [tab])
  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => window.scrollTo(0, 0), [tab, chartId, drilling])

  return (
    <>
      <main className="app">
        {/* Kept mounted while hidden, so switching tabs doesn't lose a drill in progress. */}
        <div hidden={tab !== 'drill'}>
          {drilling ? (
            <DrillScreen
              charts={DEFAULT_CHARTS}
              settings={settings}
              active={tab === 'drill'}
              onExit={() => setDrilling(false)}
            />
          ) : (
            <DrillSetup settings={settings} onChange={setSettings} onStart={() => setDrilling(true)} />
          )}
        </div>
        {tab === 'stats' && (
          <ComingSoon title="Stats" text="Your accuracy by spot and position, plus a heatmap of the hands you miss, arrive in M5." />
        )}
        {tab === 'learn' &&
          (chart ? (
            <ChartDetail key={chart.id} chart={chart} onBack={() => setChartId(null)} />
          ) : (
            <ChartList charts={DEFAULT_CHARTS} onOpen={setChartId} />
          ))}
      </main>
      <nav className="tabbar" aria-label="Main">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="tab"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => {
                if (t.id === 'learn' && tab === 'learn') setChartId(null)
                setTab(t.id)
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </>
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
