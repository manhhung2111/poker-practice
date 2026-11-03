import type { AnswerLog } from '../core/log'

/**
 * The answer log lives in IndexedDB on this device. If IndexedDB is missing or
 * blocked (private windows, some previews), everything still works in memory
 * for the session and `persistent` is false so the UI can say so.
 */
const DB = 'poker-trainer'
const STORE = 'answers'

let dbPromise: Promise<IDBDatabase | null> | null = null

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(undefined)
        try {
          const tx = db.transaction(STORE, mode)
          const req = fn(tx.objectStore(STORE))
          tx.oncomplete = () => resolve(req ? req.result : undefined)
          tx.onerror = () => resolve(undefined)
          tx.onabort = () => resolve(undefined)
        } catch {
          resolve(undefined)
        }
      }),
  )
}

/** Loads the whole log, oldest first. */
export async function loadAnswers(): Promise<{ answers: AnswerLog[]; persistent: boolean }> {
  const db = await open()
  if (!db) return { answers: [], persistent: false }
  const all = (await run<AnswerLog[]>('readonly', (s) => s.getAll())) ?? []
  return { answers: all.sort((a, b) => a.at - b.at), persistent: true }
}

export function addAnswer(a: AnswerLog): Promise<unknown> {
  return run('readwrite', (s) => {
    s.add(a)
  })
}

/** Replaces the whole log (used by backup import and reset). */
export function replaceAnswers(list: readonly AnswerLog[]): Promise<unknown> {
  return run('readwrite', (s) => {
    s.clear()
    for (const a of list) s.add(a)
  })
}
