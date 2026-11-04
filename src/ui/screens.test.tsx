/**
 * Smoke tests: every screen renders to HTML without crashing, with realistic data.
 * (No browser here; this catches render-time errors and missing wiring.)
 */
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { PokerApp } from '../PokerApp'
import { PianoApp } from './piano/PianoApp'
import { PianoStatsScreen } from './piano/PianoStats'
import { PianoDrill } from './piano/PianoDrill'
import { DEFAULT_PIANO_SETTINGS } from './piano/settings'
import { RowDrill } from './piano/RowDrill'
import { ChordDrill } from './piano/ChordDrill'
import { EMPTY_ROWS } from '../core/piano/stats'
import { allowedSeats } from '../core/progress'
import { entry } from '../core/testLog'
import { DEFAULT_CHART_DEFS, DEFAULT_CHARTS } from '../data/charts'
import { LESSONS } from '../data/learning'
import { DrillScreen } from './drill/DrillScreen'
import { DrillSetup } from './drill/DrillSetup'
import { GlossaryScreen } from './learn/GlossaryScreen'
import { LearnHome } from './learn/LearnHome'
import { LessonScreen } from './learn/LessonScreen'
import { ChartDetail } from './screens/ChartDetail'
import { ChartEditor } from './screens/ChartEditor'
import { StatsScreen } from './stats/StatsScreen'

const noop = () => {}
const allowed = allowedSeats({}, LESSONS)

describe('screens render', () => {
  it('the whole app', () => {
    expect(renderToString(<PokerApp />)).toContain('Preflop course')
  })

  it('the hub home and piano screens', () => {
    expect(renderToString(<App />)).toContain('Practice Hub')
    expect(renderToString(<PianoApp />)).toContain('Read notes')
    for (const hand of ['right', 'left', 'both'] as const)
      for (const level of ['staff', 'ledger', 'wide'] as const)
        expect(renderToString(<PianoDrill settings={{ ...DEFAULT_PIANO_SETTINGS, hand, level, accidentals: true }} stats={{}} active onAnswer={noop} onExit={noop} />)).toContain('Which note')
    for (const hand of ['right', 'left', 'both'] as const)
      for (const level of ['staff', 'ledger', 'wide'] as const)
        for (const accidentals of [false, true]) {
          const s = { ...DEFAULT_PIANO_SETTINGS, hand, level, accidentals }
          expect(renderToString(<RowDrill settings={{ ...s, mode: 'row' }} active onNote={noop} onRow={noop} onExit={noop} />)).toContain('Row 1 / 10')
          expect(renderToString(<ChordDrill settings={{ ...s, mode: 'chord' }} chordStats={{}} active onChord={noop} onExit={noop} />)).toContain('Check')
        }
    expect(renderToString(<PianoStatsScreen stats={{}} rows={EMPTY_ROWS} chords={{}} onReset={noop} />)).toContain('No notes yet')
    expect(renderToString(<PianoStatsScreen stats={{ 'treble:F♯4': { n: 4, correct: 1, ms: 9000 } }} rows={EMPTY_ROWS} chords={{}} onReset={noop} />)).toContain('Practise these')
    const withMore = renderToString(
      <PianoStatsScreen
        stats={{}}
        rows={{ rows: 4, clean: 1, notes: 24, correct: 20, ms: 40000 }}
        chords={{ 'treble:F major': { n: 4, correct: 1, ms: 9000 }, 'bass:A minor': { n: 2, correct: 2, ms: 3000 } }}
        onReset={noop}
      />,
    )
    expect(withMore).toContain('4 rows')
    expect(withMore).toContain('F major')
    expect(withMore).not.toContain('No notes yet')
  })

  it('learn screens', () => {
    for (const l of LESSONS) {
      expect(renderToString(<LessonScreen lesson={l} progress={{}} onBack={noop} onDrill={noop} />)).toContain('class="term"')
    }
    const home = renderToString(
      <LearnHome lessons={LESSONS} progress={{}} unlockAll={false} onLesson={noop} onCharts={noop} onGlossary={noop} />,
    )
    expect(home).toContain('Pass lesson 1 to unlock')
    expect(renderToString(<GlossaryScreen onBack={noop} />)).toContain('3-bet')
  })

  it('drill setup shows locks, drill screen shows a lesson drill', () => {
    const setup = renderToString(
      <DrillSetup
        settings={{ spot: 'blinds', positions: ['BB'], session: 'session', dealing: 'smart' }}
        allowed={allowed}
        lessons={LESSONS}
        queueSize={0}
        onChange={noop}
        onStart={noop}
      />,
    )
    expect(setup).toContain('Unlocks with lesson 4')
    const drill = renderToString(
      <DrillScreen
        charts={DEFAULT_CHARTS}
        settings={{ spot: 'rfi', positions: ['CO', 'BTN'], session: 'endless', dealing: 'smart' }}
        allowed={allowed}
        lesson={{ number: 1, title: 'x', correct: 0, played: 0, passed: false }}
        active
        review={{ due: [], queued: [] }}
        onAnswer={noop}
        onExit={noop}
      />,
    )
    expect(drill).toContain('Lesson 1 drill')
    expect(drill).toContain('Warm-up hand')
  })

  it('stats with data and empty', () => {
    const now = Date.now()
    const answers = Array.from({ length: 40 }, (_, i) =>
      entry({ at: now - (i % 5) * 86_400_000, hero: i % 2 ? 'UTG' : 'CO', chartId: i % 2 ? 'rfi/utg' : 'rfi/co', correct: i % 4 !== 0 }),
    )
    const props = { charts: DEFAULT_CHARTS, lessons: LESSONS, progress: {}, ranges: {}, chartDefs: DEFAULT_CHART_DEFS, onDrillWeak: noop, onImport: noop, onReset: noop }
    const html = renderToString(<StatsScreen {...props} answers={answers} persistent queueSize={3} />)
    for (const s of ['Accuracy per day', 'Most-missed hands', 'Leak heatmap', 'Drill your weak spots (3)', 'Copy backup']) {
      expect(html, s).toContain(s)
    }
    expect(renderToString(<StatsScreen {...props} answers={[]} persistent={false} queueSize={0} />)).toContain('No hands yet')
  })

  it('chart detail and editor', () => {
    const chart = DEFAULT_CHARTS.find((c) => c.id === 'facing-open/bb-vs-late')!
    const def = DEFAULT_CHART_DEFS.find((d) => d.id === chart.id)!
    expect(renderToString(<ChartDetail chart={chart} onBack={noop} onEdit={noop} />)).toContain('Edit ranges')
    const editor = renderToString(<ChartEditor def={def} chart={chart} onSave={noop} onCancel={noop} />)
    expect(editor).toContain('As range text')
    expect(editor).toContain('grid editing')
  })
})
