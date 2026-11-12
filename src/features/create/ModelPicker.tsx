import { useModelOptions } from '../ai/modelCatalog.ts'
import { providers } from '../ai/providers.ts'
import type { ProviderId } from '../ai/types.ts'
import { updateSettings } from '../settings/settingsStore.ts'

type Props = { provider: ProviderId; apiKey: string; model: string }

/**
 * Model menu in the Create page's summary bar. Lists the models this key can use
 * (fetched once in the background; listing is free) and remembers the choice per provider.
 */
export function ModelPicker({ provider, apiKey, model }: Props) {
  const { options } = useModelOptions(provider, apiKey, model)
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{providers[provider].name}</span>
      <select
        aria-label="Model"
        value={model}
        onChange={(e) =>
          updateSettings((s) => ({ models: { ...s.models, [provider]: e.target.value } }))
        }
        className="bg-bg text-text max-w-[14rem] cursor-pointer truncate rounded-lg border-0 py-1 pr-7 pl-2 text-sm font-semibold"
      >
        {options.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </span>
  )
}
