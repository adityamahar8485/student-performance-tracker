const PIN_COLORS = {
  red: 'bg-pin-red',
  green: 'bg-pin-green',
  blue: 'bg-pin-blue',
  gold: 'bg-pin-gold',
}

/**
 * Pinned paper notice - the board's core primitive.
 * tilt: resting rotation in degrees (subtle, hand-hung). Changing `settleKey`
 * replays the settle swing (the board's one authored moment).
 */
export default function Notice({ pin, tilt = 0, settleKey, className = '', children }) {
  return (
    <div
      key={settleKey}
      className={`notice p-5 pt-6 ${className}`}
      style={{ '--tilt': tilt }}
    >
      {pin && <span className={`pin ${PIN_COLORS[pin] ?? 'bg-pin-blue'}`} aria-hidden="true" />}
      {children}
    </div>
  )
}
