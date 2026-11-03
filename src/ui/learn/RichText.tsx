import { Fragment, type ReactNode } from 'react'
import { makeLinker } from '../../core/glossary'
import { parseInline } from '../../core/markdown'
import { GLOSSARY, GLOSSARY_BY_ID } from '../../data/learning'
import { useOpenTerm } from './glossaryContext'

const link = makeLinker(GLOSSARY)

/** A tappable glossary term. */
export function Term({ id, children }: { id: string; children: ReactNode }) {
  const open = useOpenTerm()
  if (!GLOSSARY_BY_ID.has(id)) return <>{children}</>
  return (
    <button type="button" className="term" onClick={() => open(id)}>
      {children}
    </button>
  )
}

/**
 * Renders text with **bold** and [[term]] links. With autoLink, glossary phrases
 * in plain text become tappable too (each term once per text).
 */
export function RichText({ text, autoLink = true }: { text: string; autoLink?: boolean }) {
  const seen = new Set<string>()
  const tokens = parseInline(text)
  for (const t of tokens) if (t.type === 'term') seen.add(t.id)
  return (
    <>
      {tokens.map((t, i) => {
        if (t.type === 'bold') return <strong key={i}>{t.text}</strong>
        if (t.type === 'term')
          return (
            <Term key={i} id={t.id}>
              {t.text}
            </Term>
          )
        if (!autoLink) return <Fragment key={i}>{t.text}</Fragment>
        return (
          <Fragment key={i}>
            {link(t.text, seen).map((s, j) =>
              s.termId ? (
                <Term key={j} id={s.termId}>
                  {s.text}
                </Term>
              ) : (
                <Fragment key={j}>{s.text}</Fragment>
              ),
            )}
          </Fragment>
        )
      })}
    </>
  )
}
