/** Subject code as a small label chip — keeps name and code visually
    separated in tables and lists (the board's tag language). */
export default function SubjectCode({ code, className = '' }) {
  return (
    <span
      className={`ml-2 inline-block -translate-y-[1px] whitespace-nowrap rounded-sm border border-paper-edge bg-paper-rule px-1.5 py-0.5 font-display text-[10px] font-semibold tracking-[0.12em] text-wood ${className}`}
    >
      {code}
    </span>
  )
}
