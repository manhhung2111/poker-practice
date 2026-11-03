import { useEffect, useRef } from 'react'
import { GLOSSARY_BY_ID } from '../../data/learning'

/** Bottom sheet explaining one glossary term. */
export function TermSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const entry = GLOSSARY_BY_ID.get(id)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => closeRef.current?.focus(), [id])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!entry) return null
  return (
    <div className="sheet-backdrop term-backdrop" onClick={onClose}>
      <section
        className="sheet term-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="term-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="eyebrow">Glossary</p>
        <h2 id="term-title">{entry.term}</h2>
        <p>{entry.definition}</p>
        {entry.example && (
          <p className="term-example">
            <span className="eyebrow">Example</span>
            {entry.example}
          </p>
        )}
        <button ref={closeRef} type="button" className="primary" onClick={onClose}>
          Got it
        </button>
      </section>
    </div>
  )
}
