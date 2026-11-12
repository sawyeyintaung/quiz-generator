import { animate, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

type Props = { to: number; duration?: number; suffix?: string }

/** Animates a number from 0 up to `to`. Shows the final value at once with reduced motion. */
export function CountUp({ to, duration = 1.2, suffix = '' }: Props) {
  const reduce = useReducedMotion()
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (reduce) return
    const controls = animate(0, to, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setValue(Math.round(v)),
    })
    return () => controls.stop()
  }, [to, duration, reduce])

  return (
    <span className="tabular-nums">
      {reduce ? to : value}
      {suffix}
    </span>
  )
}
