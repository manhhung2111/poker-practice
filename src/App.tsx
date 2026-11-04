import { useEffect, useState } from 'react'
import { PokerApp } from './PokerApp'
import { PianoApp } from './ui/piano/PianoApp'
import { safeStorage } from './ui/storage'

export type Subject = 'home' | 'poker' | 'piano'

const SUBJECT_KEY = 'practice-hub:subject'

/** Last subject opened; people who used the poker trainer before the hub land back in poker. */
function loadSubject(): Subject {
  const saved = safeStorage.get(SUBJECT_KEY)
  if (saved === 'home' || saved === 'poker' || saved === 'piano') return saved
  return safeStorage.get('poker-trainer:tab') ? 'poker' : 'home'
}

/** Practice Hub: pick a subject. Each subject keeps its own screens, settings and stats. */
export default function App() {
  const [subject, setSubject] = useState<Subject>(loadSubject)
  // A subject stays mounted (hidden) once opened, so a drill or hand in progress survives switching.
  const [opened, setOpened] = useState<Set<Subject>>(() => new Set([subject]))

  useEffect(() => safeStorage.set(SUBJECT_KEY, subject), [subject])
  useEffect(() => window.scrollTo(0, 0), [subject])

  const open = (s: Subject) => {
    setOpened((prev) => (prev.has(s) ? prev : new Set(prev).add(s)))
    setSubject(s)
  }
  const home = () => setSubject('home')

  return (
    <>
      {subject === 'home' && <Home onOpen={open} />}
      {opened.has('poker') && (
        <div hidden={subject !== 'poker'}>
          <PokerApp active={subject === 'poker'} onHome={home} />
        </div>
      )}
      {opened.has('piano') && (
        <div hidden={subject !== 'piano'}>
          <PianoApp active={subject === 'piano'} onHome={home} />
        </div>
      )}
    </>
  )
}

const SUBJECTS: { id: Exclude<Subject, 'home'>; title: string; note: string; icon: JSX.Element }[] = [
  {
    id: 'poker',
    title: 'Poker',
    note: '9-max cash: preflop drills, lessons and hands against bots',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="3" y="4" width="11" height="16" rx="2" />
        <path d="M14 7.5l4.2 1.1a2 2 0 0 1 1.4 2.4l-2.6 9.7a2 2 0 0 1-2.4 1.4L11 21" />
        <path d="M8.5 9.5c1.5 1.4 2.5 2.3 2.5 3.4a1.6 1.6 0 0 1-2.5 1.3 1.6 1.6 0 0 1-2.5-1.3c0-1.1 1-2 2.5-3.4z" />
      </svg>
    ),
  },
  {
    id: 'piano',
    title: 'Piano',
    note: 'Read notes on the treble (right hand) and bass (left hand) clefs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
        <path d="M7 19V5M12 19V5M17 19V5" />
        <path d="M5.5 5h3v8h-3zM10.5 5h3v8h-3zM15.5 5h3v8h-3z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
]

function Home({ onOpen }: { onOpen: (s: Subject) => void }) {
  return (
    <main className="app hub">
      <header className="header">
        <h1>Practice Hub</h1>
      </header>
      <p className="muted">What are you practising today?</p>
      <ul className="hub-list">
        {SUBJECTS.map((s) => (
          <li key={s.id}>
            <button type="button" className="hub-card" onClick={() => onOpen(s.id)}>
              {s.icon}
              <span>
                <strong>{s.title}</strong>
                <small>{s.note}</small>
              </span>
              <span className="chev" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
