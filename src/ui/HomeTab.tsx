/** Tab-bar button that goes back to the Practice Hub home screen. */
export function HomeTab({ onHome }: { onHome: () => void }) {
  return (
    <button type="button" className="tab" onClick={onHome}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M3 11l9-7 9 7" />
        <path d="M5 10v10h5v-6h4v6h5V10" />
      </svg>
      Home
    </button>
  )
}
