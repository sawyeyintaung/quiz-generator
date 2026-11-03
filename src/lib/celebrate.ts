import confetti from 'canvas-confetti'

const colors = ['#6d4aff', '#8f75ff', '#22c55e', '#facc15', '#f472b6', '#38bdf8']

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/** Small burst from an element, e.g. the answer button that was just picked correctly. */
export function burstFrom(element: Element | null) {
  if (prefersReducedMotion()) return
  const rect = element?.getBoundingClientRect()
  const origin = rect
    ? {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      }
    : { x: 0.5, y: 0.5 }
  void confetti({
    particleCount: 36,
    spread: 70,
    startVelocity: 28,
    scalar: 0.8,
    ticks: 120,
    origin,
    colors,
    disableForReducedMotion: true,
  })
}

/** Big celebration for the results screen. Intensity 0–1 scales the amount of confetti. */
export function celebrate(intensity: number) {
  if (prefersReducedMotion() || intensity <= 0) return
  const count = Math.round(80 + 160 * intensity)
  const fire = (x: number, angle: number) =>
    void confetti({
      particleCount: count,
      angle,
      spread: 65,
      startVelocity: 55,
      origin: { x, y: 0.75 },
      colors,
      disableForReducedMotion: true,
    })
  fire(0.1, 60)
  fire(0.9, 120)
}
