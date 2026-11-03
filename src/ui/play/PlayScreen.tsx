import { useCallback, useEffect, useRef, useState } from 'react'
import { decide } from '../../core/bots/brain'
import { STYLES } from '../../core/bots/personality'
import type { Chart } from '../../core/charts'
import { type Decision, type HandState, act, legalActions, potSize } from '../../core/engine/game'
import { type HandRecord, type HeroDecision, heroLabel, makeRecord, situationBefore } from '../../core/handRecord'
import { handClassOf } from '../../core/hands'
import type { AnswerLog } from '../../core/log'
import { type TableSession, finishHand, gradeHeroDecision, isTrivialFold, newSession, nextHand } from '../../core/table'
import { DEFAULT_CHARTS } from '../../data/charts'
import { addHand, loadHands } from '../../storage/answers'
import { PlayingCard } from '../components/PlayingCard'
import { safeStorage } from '../storage'
import { HandReview } from './HandReview'
import { MiniCard } from './MiniCard'
import { type PlaySettings, BOT_DELAY, loadPlaySettings, savePlaySettings } from './playSettings'
import { bb, quickSizes } from './sizes'
import { TableView } from './TableView'

interface Props {
  /** Charts used to grade your decisions (your edited versions). Bots always use the defaults. */
  charts: readonly Chart[]
  /** False while another tab is shown: bots pause. */
  active: boolean
  onLogAnswer: (entry: AnswerLog) => void
}

const SESSION_KEY = 'poker-trainer:table'

function loadSession(): TableSession {
  try {
    const raw = JSON.parse(safeStorage.get(SESSION_KEY) ?? 'null') as TableSession | null
    if (raw && Array.isArray(raw.seats) && raw.seats.length === 9) return raw
  } catch {
    /* fall through */
  }
  return newSession()
}

type View = 'table' | 'history' | 'settings'

export function PlayScreen({ charts, active, onLogAnswer }: Props) {
  const [session, setSession] = useState<TableSession>(loadSession)
  const [hand, setHand] = useState<HandState | null>(null)
  const [record, setRecord] = useState<HandRecord | null>(null)
  const [view, setView] = useState<View>('table')
  const [settings, setSettings] = useState<PlaySettings>(loadPlaySettings)
  const [history, setHistory] = useState<HandRecord[]>([])
  const [openRecord, setOpenRecord] = useState<HandRecord | null>(null)
  const [seatInfo, setSeatInfo] = useState<number | null>(null)
  const [raising, setRaising] = useState(false)
  const [raiseTo, setRaiseTo] = useState(0)
  const [note, setNote] = useState<string | null>(null)

  // Refs mirror state for timers and multi-step updates.
  const handRef = useRef<HandState | null>(null)
  const sessionRef = useRef(session)
  const startStacks = useRef<number[]>([])
  const decisions = useRef<HeroDecision[]>([])
  const turnStart = useRef(Date.now())
  sessionRef.current = session
  const hero = session.heroSeat

  useEffect(() => safeStorage.set(SESSION_KEY, JSON.stringify(session)), [session])
  useEffect(() => savePlaySettings(settings), [settings])
  useEffect(() => {
    loadHands().then(setHistory)
  }, [])

  const endHand = useCallback((final: HandState) => {
    const s = sessionRef.current
    const rec = makeRecord(final, s.heroSeat, s.seats.map((x) => x.personality), startStacks.current, decisions.current)
    setSession(finishHand(s, final))
    setRecord(rec)
    setHistory((h) => [rec, ...h].slice(0, 200))
    void addHand(rec)
  }, [])

  /** Makes `next` the current hand, and wraps up if it's over. */
  const commit = useCallback(
    (next: HandState) => {
      handRef.current = next
      setHand(next)
      if (next.result) endHand(next)
    },
    [endHand],
  )

  const deal = useCallback(() => {
    const { session: s, hand: h } = nextHand(sessionRef.current)
    sessionRef.current = s
    setSession(s)
    startStacks.current = h.players.map((p) => p.stack + p.committed)
    decisions.current = []
    handRef.current = h
    setHand(h)
    setRecord(null)
    setRaising(false)
    setNote(null)
    turnStart.current = Date.now()
  }, [])

  // Deal the first hand when the Play tab is opened.
  useEffect(() => {
    if (active && !handRef.current) deal()
  }, [active, deal])

  /** Your action: grade it if a chart covers it, log it, then apply. */
  const heroAct = useCallback(
    (d: Decision, auto = false) => {
      const state = handRef.current
      if (!state || state.toAct !== hero) return
      const graded = gradeHeroDecision(state, hero, d, charts)
      const situation = situationBefore(state)
      const next = act(state, d)
      const mine = next.actions.filter((a) => a.seat === hero)
      const p = state.players[hero]
      const dec: HeroDecision = { street: state.street, label: heroLabel(mine[mine.length - 1]), situation, board: [...state.board] }
      if (graded) {
        dec.graded = {
          chartId: graded.spot.chart.id,
          chartSpot: graded.spot.chart.spot,
          chartTitle: graded.spot.chart.title,
          correct: graded.grade.correct,
          severity: graded.grade.severity,
          chosen: graded.grade.chosen,
          best: graded.grade.best,
          correctActions: graded.grade.correctActions,
        }
        if (!auto) {
          onLogAnswer({
            at: Date.now(),
            chartId: graded.spot.chart.id,
            type: graded.spot.type,
            hero: graded.spot.hero,
            ...(graded.spot.villain ? { villain: graded.spot.villain } : {}),
            hand: handClassOf(p.hole[0], p.hole[1]),
            chosen: graded.grade.chosen,
            best: graded.grade.best,
            correct: graded.grade.correct,
            severity: graded.grade.severity,
            ms: Date.now() - turnStart.current,
            source: 'play',
          })
        }
      }
      // Record the decision before committing: this action may end the hand.
      decisions.current = [...decisions.current, dec]
      setRaising(false)
      commit(next)
    },
    [commit, charts, hero, onLogAnswer],
  )

  // Drive the bots (and auto-folds) one step at a time.
  useEffect(() => {
    if (!active || !hand || hand.toAct === null || view !== 'table') return
    const s = sessionRef.current
    if (hand.toAct === hero) {
      turnStart.current = Date.now()
      if (settings.skipTrivial && isTrivialFold(hand, hero, charts)) {
        const p = hand.players[hero]
        setNote(`Auto-folded ${handClassOf(p.hole[0], p.hole[1])}: a clear fold from ${p.position}.`)
        const t = setTimeout(() => heroAct({ type: 'fold' }, true), 400)
        return () => clearTimeout(t)
      }
      return
    }
    const heroOut = hand.players[hero].folded
    const delay = heroOut ? 0 : BOT_DELAY[settings.speed]
    const step = () => {
      let state = handRef.current!
      // Instant mode (or you've folded): play bots until it's your turn or the hand ends.
      do {
        const seat = state.toAct!
        const d = decide(state, { charts: DEFAULT_CHARTS, personality: s.seats[seat].personality!, rng: Math.random })
        state = act(state, d)
      } while ((delay === 0) && state.toAct !== null && state.toAct !== hero)
      commit(state)
    }
    const t = setTimeout(step, delay)
    return () => clearTimeout(t)
  }, [hand, active, view, hero, settings, charts, commit, heroAct])

  const legal = hand && hand.toAct === hero && !hand.result ? legalActions(hand) : null
  const sizes = legal && legal.canRaise && hand ? quickSizes(hand, legal) : []
  const me = hand?.players[hero]

  if (view === 'history') {
    if (openRecord) return <HandReview record={openRecord} onNext={() => setOpenRecord(null)} nextLabel="Back to history" />
    return <History records={history} onOpen={setOpenRecord} onBack={() => setView('table')} />
  }
  if (view === 'settings') {
    return (
      <PlaySettingsView
        settings={settings}
        onChange={setSettings}
        onBack={() => setView('table')}
        onNewTable={() => {
          const s = newSession()
          sessionRef.current = s
          setSession(s)
          handRef.current = null
          setHand(null)
          setView('table')
        }}
      />
    )
  }

  return (
    <div className="play">
      <header className="header">
        <h1>Table</h1>
        <span className={`progress ${session.net >= 0 ? 'up' : 'down'}`} title="Your result this table">
          {session.net >= 0 ? '+' : '−'}
          {bb(Math.abs(session.net))}
          <span className="score"> · {session.handsPlayed} hands</span>
        </span>
        <button type="button" className="icon-button" onClick={() => setView('history')} aria-label="Hand history">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" />
          </svg>
        </button>
        <button type="button" className="icon-button" onClick={() => setView('settings')} aria-label="Table settings">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6h16M4 12h16M4 18h16" />
            <circle cx="9" cy="6" r="2" fill="var(--bg)" />
            <circle cx="15" cy="12" r="2" fill="var(--bg)" />
            <circle cx="7" cy="18" r="2" fill="var(--bg)" />
          </svg>
        </button>
      </header>

      {hand && <TableView hand={hand} session={session} onSeatInfo={setSeatInfo} />}

      {me && (
        <div className="hero-area">
          <div className="hole small">
            <PlayingCard card={me.hole[0]} />
            <PlayingCard card={me.hole[1]} />
          </div>
          <p className="status-line" aria-live="polite">
            {note ??
              (hand!.result
                ? ' '
                : legal
                  ? legal.toCall
                    ? `${bb(legal.toCall)} to call.`
                    : 'Your turn.'
                  : me.folded
                    ? 'You folded. Finishing the hand…'
                    : `${hand!.players[hand!.toAct!].name} is thinking…`)}
          </p>
          {legal && settings.hints && legal.toCall > 0 && (
            <p className="hint">
              Pot odds: call {bb(legal.callAmount)} to win {bb(potSize(hand!))}. You need{' '}
              {Math.round((legal.callAmount / (potSize(hand!) + legal.callAmount)) * 100)}% equity.
            </p>
          )}
        </div>
      )}

      {legal && !raising && (
        <div className="actions">
          {!legal.canCheck && (
            <button type="button" className="action fold" onClick={() => heroAct({ type: 'fold' })}>
              Fold
            </button>
          )}
          {legal.canCheck ? (
            <button type="button" className="action check" onClick={() => heroAct({ type: 'check' })}>
              Check
            </button>
          ) : (
            <button type="button" className="action call" onClick={() => heroAct({ type: 'call' })}>
              Call {bb(legal.callAmount)}
            </button>
          )}
          {legal.canRaise && (
            <button
              type="button"
              className="action raise"
              onClick={() => {
                setRaiseTo(sizes[0]?.to ?? legal.minRaiseTo)
                setRaising(true)
              }}
            >
              {hand!.currentBet === 0 ? 'Bet ▸' : 'Raise ▸'}
            </button>
          )}
        </div>
      )}

      {legal && raising && (
        <div className="bet-panel" role="group" aria-label="Choose a size">
          <div className="size-chips">
            {sizes.map((o) => (
              <button key={o.label} type="button" className="chip" aria-pressed={raiseTo === o.to} onClick={() => setRaiseTo(o.to)}>
                <span>{o.label}</span>
                <small>{bb(o.to)}</small>
              </button>
            ))}
          </div>
          <label className="slider">
            <span className="visually-hidden">Bet size</span>
            <input
              id="bet-size"
              type="range"
              min={legal.minRaiseTo}
              max={legal.maxRaiseTo}
              step={5}
              value={raiseTo}
              onChange={(e) => setRaiseTo(Number(e.target.value))}
            />
          </label>
          <div className="bet-confirm">
            <button type="button" className="secondary" onClick={() => setRaising(false)}>
              Back
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => heroAct({ type: 'raise', to: raiseTo === legal.maxRaiseTo ? raiseTo : Math.max(legal.minRaiseTo, raiseTo) })}
            >
              {hand!.currentBet === 0 ? 'Bet' : 'Raise to'} {bb(raiseTo)}
            </button>
          </div>
        </div>
      )}

      {record && (
        <div className="sheet-backdrop">
          <section className="sheet" role="dialog" aria-modal="true" aria-label="Hand review">
            <HandReview record={record} onNext={deal} />
          </section>
        </div>
      )}

      {seatInfo !== null && session.seats[seatInfo].personality && (
        <div className="sheet-backdrop term-backdrop" onClick={() => setSeatInfo(null)}>
          <section className="sheet term-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow">Player</p>
            <h2>
              {STYLES[session.seats[seatInfo].personality!].icon} {session.seats[seatInfo].name}:{' '}
              {STYLES[session.seats[seatInfo].personality!].label}
            </h2>
            <p>{STYLES[session.seats[seatInfo].personality!].blurb}</p>
            <button type="button" className="primary" onClick={() => setSeatInfo(null)}>
              Got it
            </button>
          </section>
        </div>
      )}
    </div>
  )
}

function History({ records, onOpen, onBack }: { records: HandRecord[]; onOpen: (r: HandRecord) => void; onBack: () => void }) {
  const time = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  return (
    <>
      <header className="header">
        <button type="button" className="back" onClick={onBack} aria-label="Back to the table">
          ‹
        </button>
        <h1>Hand history</h1>
      </header>
      {records.length === 0 ? (
        <div className="empty">
          <h2>No hands yet</h2>
          <p>Every hand you play is saved here with your decisions and their grades. The last 200 are kept.</p>
        </div>
      ) : (
        <ul className="chart-list hand-list">
          {records.map((r) => {
            const hero = r.players[r.heroSeat]
            const misses = r.decisions.filter((d) => d.graded && !d.graded.correct).length
            return (
              <li key={r.at}>
                <button type="button" className="hand-row" onClick={() => onOpen(r)}>
                  <span className="pos">{hero.position}</span>
                  <span className="hand-cards">
                    <MiniCard card={hero.hole[0]} />
                    <MiniCard card={hero.hole[1]} />
                  </span>
                  <span className="muted">
                    {time.format(r.at)}
                    {misses ? ` · ${misses} mistake${misses > 1 ? 's' : ''}` : ''}
                  </span>
                  <span className={`net ${r.heroNet > 0 ? 'up' : r.heroNet < 0 ? 'down' : ''}`}>
                    {r.heroNet > 0 ? '+' : r.heroNet < 0 ? '−' : ''}
                    {bb(Math.abs(r.heroNet))}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function PlaySettingsView({
  settings,
  onChange,
  onBack,
  onNewTable,
}: {
  settings: PlaySettings
  onChange: (s: PlaySettings) => void
  onBack: () => void
  onNewTable: () => void
}) {
  return (
    <>
      <header className="header">
        <button type="button" className="back" onClick={onBack} aria-label="Back to the table">
          ‹
        </button>
        <h1>Table settings</h1>
      </header>
      <div className="setup">
        <fieldset className="field">
          <legend>Bot speed</legend>
          <div className="segmented">
            {(['normal', 'fast', 'instant'] as const).map((sp) => (
              <button key={sp} type="button" aria-pressed={settings.speed === sp} onClick={() => onChange({ ...settings, speed: sp })}>
                {sp[0].toUpperCase() + sp.slice(1)}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="toggle">
          <input
            id="skip-trivial"
            type="checkbox"
            checked={settings.skipTrivial}
            onChange={(e) => onChange({ ...settings, skipTrivial: e.target.checked })}
          />
          <span>
            <strong>Skip trivial folds</strong>
            <small>Auto-fold hands the chart clearly folds, like 72o from UTG. Borderline hands are still yours.</small>
          </span>
        </label>
        <label className="toggle">
          <input id="hints" type="checkbox" checked={settings.hints} onChange={(e) => onChange({ ...settings, hints: e.target.checked })} />
          <span>
            <strong>Show pot odds</strong>
            <small>When facing a bet, show how much equity you need to call.</small>
          </span>
        </label>
        <button type="button" className="secondary" onClick={onNewTable}>
          New table (new players, reset result)
        </button>
        <p className="hint">
          Practice chips only. You start with 100bb and rebuy automatically if you bust. Bots reload when they drop below
          40bb. Tap a player to see their style.
        </p>
      </div>
    </>
  )
}
