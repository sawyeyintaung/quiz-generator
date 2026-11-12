type MarkProps = { size?: number; className?: string; title?: string }

/**
 * The Quiz Generator mark: four answer tiles, one lit up as the right answer.
 * The tile colour follows the theme (`--color-logo`); the right answer is the amber spark.
 */
export function LogoMark({ size = 32, className, title }: MarkProps) {
  // Small sizes use bigger, bolder tiles so the mark stays readable.
  const small = size < 28
  const [a, b, s, r, o] = small ? [13, 34, 17, 4, 0.45] : [15, 34, 15, 4.5, 0.38]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="64" height="64" rx="16" fill="var(--color-logo)" />
      <rect x={a} y={a} width={s} height={s} rx={r} fill="#fff" fillOpacity={o} />
      <rect x={b} y={a} width={s} height={s} rx={r} fill="#fff" fillOpacity={o} />
      <rect x={a} y={b} width={s} height={s} rx={r} fill="#fff" fillOpacity={o} />
      <rect x={b} y={b} width={s} height={s} rx={r} fill="var(--color-spark)" />
      {!small && (
        <path
          d="M37.8 41.6l2.7 2.7 4.9-5.3"
          fill="none"
          stroke="#17172a"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

/** Mark plus the "Quiz Generator" wordmark. */
export function Logo({ size = 36, hideWordmarkOnMobile = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span
        className={`font-display text-lg tracking-tight whitespace-nowrap ${
          hideWordmarkOnMobile ? 'sr-only sm:not-sr-only' : ''
        }`}
      >
        <span className="font-extrabold">Quiz</span> <span className="font-medium">Generator</span>
      </span>
    </span>
  )
}
