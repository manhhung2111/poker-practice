import type { HandRecord } from '../core/handRecord'
import type { AnswerLog } from '../core/log'

/**
 * The answer log lives in IndexedDB on this device. If IndexedDB is missing or
 * blocked (private windows, some previews), everything still works in memory
 * for the session and `persistent` is false so the UI can say so.
 */
const DB = 'poker-trainer'
const STORE = 'answers'
const HANDS = 'hands'
/** Played hands kept on the device. */
export const MAX_HANDS = 200

let dbPromise: Promise<IDBDatabase | null> | null = null

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      // v1: answers. v2: + played hands.
      const req = indexedDB.open(DB, 2)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { autoIncrement: true })
        if (!db.objectStoreNames.contains(HANDS)) db.createObjectStore(HANDS, { autoIncrement: true })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
  storeName: string = STORE,
): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(undefined)
        try {
          const tx = db.transaction(storeName, mode)
          const req = fn(tx.objectStore(storeName))
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

/** Saves a played hand and drops the oldest beyond MAX_HANDS. */
export function addHand(h: HandRecord): Promise<unknown> {
  return run(
    'readwrite',
    (s) => {
      s.add(h)
      const count = s.count()
      count.onsuccess = () => {
        const extra = count.result - MAX_HANDS
        if (extra <= 0) return
        const cursor = s.openCursor()
        let left = extra
        cursor.onsuccess = () => {
          const c = cursor.result
          if (!c || left <= 0) return
          c.delete()
          left--
          c.continue()
        }
      }
    },
    HANDS,
  )
}

/** Played hands, newest first. */
export async function loadHands(): Promise<HandRecord[]> {
  const all = (await run<HandRecord[]>('readonly', (s) => s.getAll(), HANDS)) ?? []
  return all.sort((a, b) => b.at - a.at)
}

export function clearHands(): Promise<unknown> {
  return run(
    'readwrite',
    (s) => {
      s.clear()
    },
    HANDS,
  )
}
