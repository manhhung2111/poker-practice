import { useState } from 'react'
import { GLOSSARY } from '../../data/learning'

export function GlossaryScreen({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const items = GLOSSARY.filter(
    (e) => !q || e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q),
  )
  return (
    <>
      <header className="header">
        <button type="button" className="back" onClick={onBack} aria-label="Back to Learn">
          ‹
        </button>
        <h1>Glossary</h1>
      </header>
      <label className="search">
        <span className="visually-hidden">Search terms</span>
        <input
          id="glossary-search"
          type="search"
          placeholder="Search, e.g. 3-bet"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {items.length === 0 && <p className="muted">No terms match "{query}".</p>}
      <dl className="glossary">
        {items.map((e) => (
          <div key={e.id} className="glossary-item">
            <dt>{e.term}</dt>
            <dd>
              {e.definition}
              {e.example && <span className="term-example">{e.example}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </>
  )
}
