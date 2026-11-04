import { useEffect, useRef, useState } from 'react'

export type MidiStatus = 'unsupported' | 'off' | 'connecting' | 'no-device' | 'ready' | 'denied'

/** Minimal Web MIDI types (not in the DOM lib for every TS target). */
interface MidiInput {
  name?: string | null
  onmidimessage: ((e: { data: Uint8Array }) => void) | null
}
interface MidiAccess {
  inputs: Map<string, MidiInput>
  onstatechange: (() => void) | null
}

export const midiSupported = () =>
  typeof navigator !== 'undefined' && typeof (navigator as { requestMIDIAccess?: unknown }).requestMIDIAccess === 'function'

/** Listens for key presses on every connected MIDI keyboard while `enabled`. */
export function useMidi(enabled: boolean, onNote: (midi: number) => void): MidiStatus {
  const [status, setStatus] = useState<MidiStatus>(() => (midiSupported() ? 'off' : 'unsupported'))
  const handler = useRef(onNote)
  handler.current = onNote

  useEffect(() => {
    if (!enabled || !midiSupported()) return
    let access: MidiAccess | null = null
    let cancelled = false
    setStatus('connecting')
    const attach = () => {
      if (!access) return
      let count = 0
      access.inputs.forEach((input) => {
        count++
        input.onmidimessage = (e) => {
          const [cmd, note, vel] = e.data
          if ((cmd & 0xf0) === 0x90 && vel > 0) handler.current(note)
        }
      })
      setStatus(count ? 'ready' : 'no-device')
    }
    ;(navigator as unknown as { requestMIDIAccess: () => Promise<MidiAccess> })
      .requestMIDIAccess()
      .then((a) => {
        if (cancelled) return
        access = a
        a.onstatechange = attach
        attach()
      })
      .catch(() => !cancelled && setStatus('denied'))
    return () => {
      cancelled = true
      if (access) {
        access.onstatechange = null
        access.inputs.forEach((i) => (i.onmidimessage = null))
      }
      setStatus('off')
    }
  }, [enabled])

  return status
}

export const MIDI_STATUS_TEXT: Record<MidiStatus, string> = {
  unsupported: 'This browser has no MIDI support.',
  off: '',
  connecting: 'Connecting to MIDI…',
  'no-device': 'No MIDI keyboard found. Plug one in; it connects on its own.',
  ready: 'MIDI keyboard connected. Play the exact key, octave included.',
  denied: 'MIDI access was blocked. Allow it in the browser settings.',
}
