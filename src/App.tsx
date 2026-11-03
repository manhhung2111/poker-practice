import { HANDS_BY_STRENGTH } from './core/strength'

/** Placeholder until M1/M2 add the real screens. */
export default function App() {
  return (
    <main style={{ padding: 16, maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24 }}>Poker Trainer</h1>
      <p style={{ color: 'var(--muted)' }}>
        Foundation is in place (M0). Drills arrive in M2.
      </p>
      <p>Top 10 starting hands by strength: {HANDS_BY_STRENGTH.slice(0, 10).join(', ')}</p>
    </main>
  )
}
