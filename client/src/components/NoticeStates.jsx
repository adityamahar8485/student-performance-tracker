import Notice from './Notice.jsx'

/** Empty board state - an unpinned sheet waiting for its first notice. */
export function EmptyNotice({ title, hint, tilt = 0 }) {
  return (
    <Notice tilt={tilt} className="border-2 border-dashed border-paper-edge/60 shadow-none bg-paper/85">
      <div className="cap mb-2">{title}</div>
      <p className="text-sm text-ink-soft">{hint}</p>
    </Notice>
  )
}

/** Loading state - ruled paper with placeholder bars. */
export function LoadingNotice({ label = 'FETCHING', tilt = 0 }) {
  return (
    <Notice tilt={tilt} aria-busy="true">
      <div className="cap mb-3 animate-pulse">{label}</div>
      <div className="space-y-2.5">
        <div className="h-9 w-2/3 rounded-sm bg-paper-rule animate-pulse" />
        <div className="h-3.5 w-full rounded-sm bg-paper-rule animate-pulse" />
        <div className="h-3.5 w-4/5 rounded-sm bg-paper-rule animate-pulse" />
      </div>
    </Notice>
  )
}

/** Error state - red-pinned, names the problem and the recovery. */
export function ErrorNotice({ message, onRetry, tilt = 0.4 }) {
  return (
    <Notice pin="red" tilt={tilt}>
      <div className="mb-2 inline-block bg-pin-red px-2.5 py-1 font-display text-[11px] font-semibold tracking-[0.16em] text-paper">
        PIN FAILED
      </div>
      <p className="text-sm leading-relaxed">{message || 'The board could not reach the records office.'}</p>
      <p className="mt-1 text-[13px] text-ink-soft">Check that the API is running, then pin it again.</p>
      {onRetry && (
        <button onClick={onRetry} className="btn mt-3">Try again</button>
      )}
    </Notice>
  )
}
