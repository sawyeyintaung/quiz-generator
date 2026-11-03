import { motion } from 'framer-motion'
import { useId } from 'react'

type Option<T extends string | number> = { value: T; label: string; disabled?: boolean }

type Props<T extends string | number> = {
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  hint?: string
}

/** Radio group styled as a segmented control, with an animated selection pill. */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  hint,
}: Props<T>) {
  const name = useId()
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="bg-bg border-border mt-2 flex rounded-xl border p-1">
        {options.map((o) => {
          const active = o.value === value
          return (
            <label
              key={String(o.value)}
              className={`relative flex-1 rounded-lg px-2 py-2 text-center text-sm font-medium ${
                o.disabled
                  ? 'text-muted/60 cursor-not-allowed'
                  : active
                    ? 'text-brand cursor-pointer'
                    : 'text-muted hover:text-text cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={String(o.value)}
                checked={active}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                className="peer sr-only"
              />
              {active && (
                <motion.span
                  layoutId={`${name}-pill`}
                  className="bg-surface absolute inset-0 rounded-lg shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="peer-focus-visible:outline-brand relative rounded peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                {o.label}
              </span>
            </label>
          )
        })}
      </div>
      {hint && <p className="text-muted mt-1.5 text-xs">{hint}</p>}
    </fieldset>
  )
}
