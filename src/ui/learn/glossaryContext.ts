import { createContext, useContext } from 'react'

/** Opens the explanation sheet for a glossary term. */
export const TermContext = createContext<(id: string) => void>(() => {})

export const useOpenTerm = () => useContext(TermContext)
