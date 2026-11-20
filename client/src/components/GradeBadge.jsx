const GRADE_BG = {
  A: 'bg-pin-green-text',   // #2f6340 on paper letters - 7.4:1
  B: 'bg-pin-green',        // #3e7a4e - 5.1:1
  C: 'bg-pin-gold-text',    // #7d5a10 - 6.1:1
  D: 'bg-[#866317]',        // 5.3:1
  F: 'bg-pin-red-text',     // #9c3823 - 5.9:1
}

/** Letter grade chip - colour carries mood, the letter carries the fact (never colour-only). */
export default function GradeBadge({ grade, size = 'sm' }) {
  if (!grade) return <span className="text-ink-soft">-</span>
  const sizes = size === 'lg' ? 'h-9 w-9 text-lg' : 'h-6 w-6 text-[13px]'
  return (
    <span
      className={`inline-grid place-items-center rounded-sm font-bold text-paper ${sizes} ${GRADE_BG[grade] ?? 'bg-ink-soft'}`}
      aria-label={`Grade ${grade}`}
    >
      {grade}
    </span>
  )
}

/** Pass/fail as words first; colour reinforces. */
export function PassFail({ isPass }) {
  if (isPass === null || isPass === undefined) return <span className="text-ink-soft">-</span>
  return isPass
    ? <span className="font-semibold text-pin-green-text">PASS</span>
    : <span className="font-semibold text-pin-red-text">FAIL</span>
}
