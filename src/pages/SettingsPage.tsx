import { motion } from 'framer-motion'
import { useId, useState } from 'react'
import { createAiClient } from '../features/ai/createClient.ts'
import { toAiError } from '../features/ai/errors.ts'
import { pickDefaultModel, providerIds, providers } from '../features/ai/providers.ts'
import type { ModelOption, ProviderId } from '../features/ai/types.ts'
import {
  forgetAllKeys,
  setApiKey,
  updateSettings,
  useSettings,
} from '../features/settings/settingsStore.ts'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; count: number }
  | { status: 'error'; message: string }

// Model lists fetched with the user's key, kept for this page session.
const fetchedModels: Partial<Record<ProviderId, ModelOption[]>> = {}

export function SettingsPage() {
  useDocumentTitle('Settings')
  const settings = useSettings()
  const provider = providers[settings.provider]
  const savedKey = settings.keys[settings.provider] ?? ''
  const [draftKey, setDraftKey] = useState(savedKey)
  const [draftFor, setDraftFor] = useState(settings.provider)
  const [showKey, setShowKey] = useState(false)
  const [test, setTest] = useState<TestState>({ status: 'idle' })
  const [models, setModels] = useState<ModelOption[] | undefined>(fetchedModels[settings.provider])
  const ids = { key: useId(), model: useId(), remember: useId() }

  // Switching provider: show that provider's saved key and model list.
  if (draftFor !== settings.provider) {
    setDraftFor(settings.provider)
    setDraftKey(savedKey)
    setTest({ status: 'idle' })
    setModels(fetchedModels[settings.provider])
  }

  const modelOptions = withCurrent(models ?? provider.fallbackModels, settings.models[provider.id])

  async function saveAndTest() {
    const key = draftKey.trim()
    setApiKey(provider.id, key)
    if (!key) return
    setTest({ status: 'testing' })
    try {
      const client = await createAiClient(provider.id, key, settings.models[provider.id])
      const list = await client.listModels()
      fetchedModels[provider.id] = list
      setModels(list)
      if (list.length > 0 && !list.some((m) => m.id === settings.models[provider.id])) {
        const model = pickDefaultModel(provider.id, list)
        if (model) updateSettings((s) => ({ models: { ...s.models, [provider.id]: model } }))
      }
      setTest({ status: 'ok', count: list.length })
    } catch (error) {
      setTest({ status: 'error', message: toAiError(error).message })
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <p className="text-muted mt-2">Choose how the AI writes your quizzes.</p>

      <fieldset className="mt-8">
        <legend className="font-semibold">How to create quizzes</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(
            [
              [
                'api',
                'Automatic, with an API key',
                'Fastest: questions stream in. Uses API credit.',
              ],
              [
                'paste',
                'Copy & paste with my subscription',
                'Use Claude Code, Claude or ChatGPT. No API key needed.',
              ],
            ] as const
          ).map(([mode, title, hint]) => {
            const active = settings.mode === mode
            return (
              <label
                key={mode}
                className={`cursor-pointer rounded-xl border-2 p-4 transition-colors ${
                  active
                    ? 'border-brand bg-brand/5'
                    : 'border-border bg-surface hover:border-brand/50'
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={mode}
                  checked={active}
                  onChange={() => updateSettings({ mode })}
                  className="sr-only"
                />
                <span className="block font-semibold">{title}</span>
                <span className="text-muted block text-sm">{hint}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {settings.mode === 'paste' ? (
        <div className="border-border bg-surface mt-8 rounded-2xl border p-5 sm:p-6">
          <h2 className="font-semibold">Copy &amp; paste mode</h2>
          <ol className="text-muted mt-2 list-decimal space-y-1 pl-5 text-sm">
            <li>On the Create page, choose your topic or notes and settings.</li>
            <li>Copy the instructions the app writes for you.</li>
            <li>Paste them into Claude Code, claude.ai or ChatGPT.</li>
            <li>Paste the reply back. The app checks it and starts your quiz.</li>
          </ol>
          <p className="text-muted mt-3 text-sm">
            This uses your own plan&apos;s usage. Nothing is sent anywhere by this app.
          </p>
        </div>
      ) : (
        <>
          <fieldset className="mt-8">
            <legend className="font-semibold">AI provider</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {providerIds.map((id) => {
                const p = providers[id]
                const active = id === settings.provider
                return (
                  <label
                    key={id}
                    className={`cursor-pointer rounded-xl border-2 p-4 transition-colors ${
                      active
                        ? 'border-brand bg-brand/5'
                        : 'border-border bg-surface hover:border-brand/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="provider"
                      value={id}
                      checked={active}
                      onChange={() => updateSettings({ provider: id })}
                      className="sr-only"
                    />
                    <span className="block font-semibold">{p.name}</span>
                    <span className="text-muted block text-sm">
                      {p.company}
                      {settings.keys[id] ? ' · key added' : ''}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div className="border-border bg-surface mt-8 rounded-2xl border p-5 sm:p-6">
            <label htmlFor={ids.key} className="font-semibold">
              {provider.company} API key
            </label>
            <p className="text-muted mt-1 text-sm">
              Don't have one?{' '}
              <a
                href={provider.keyUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-brand font-medium underline"
              >
                Get an API key from {provider.company}
              </a>
              . Usage is billed to your {provider.company} API account, which is separate from any
              Claude, ChatGPT or Gemini subscription and needs its own credit.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                id={ids.key}
                type={showKey ? 'text' : 'password'}
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void saveAndTest()}
                placeholder={provider.keyPlaceholder}
                autoComplete="off"
                spellCheck={false}
                className="border-border bg-bg focus:border-brand min-w-0 flex-1 rounded-xl border-2 px-3 py-2.5 font-mono text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="border-border hover:border-brand rounded-xl border-2 px-3 text-sm font-medium"
                aria-pressed={showKey}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void saveAndTest()}
                disabled={test.status === 'testing'}
                className="bg-accent hover:bg-accent-strong rounded-xl px-4 py-2 font-semibold text-white disabled:opacity-60"
              >
                {test.status === 'testing' ? 'Checking…' : 'Save & test key'}
              </button>
              <p role="status" className="text-sm">
                {test.status === 'ok' && (
                  <span className="text-correct font-medium">
                    ✓ Key is valid.
                    {test.count > 0 &&
                      ` ${test.count} model${test.count === 1 ? '' : 's'} available.`}
                  </span>
                )}
                {test.status === 'error' && <span className="text-wrong">{test.message}</span>}
                {test.status === 'ok' && (
                  <span className="text-muted block text-xs">
                    This checks the key only; it doesn&apos;t use or check your API credit.
                  </span>
                )}
                {test.status === 'idle' && savedKey && draftKey.trim() === savedKey && (
                  <span className="text-muted">Key saved.</span>
                )}
              </p>
            </div>

            <div className="mt-6">
              <label htmlFor={ids.model} className="font-semibold">
                Model
              </label>
              <p className="text-muted mt-1 text-sm">
                A fast, low-cost model is selected by default.{' '}
                {!models && 'Test your key to see every model you can use.'}
              </p>
              <select
                id={ids.model}
                value={settings.models[provider.id]}
                onChange={(e) =>
                  updateSettings((s) => ({
                    models: { ...s.models, [provider.id]: e.target.value },
                  }))
                }
                className="border-border bg-bg focus:border-brand mt-2 w-full rounded-xl border-2 px-3 py-2.5 text-sm outline-none"
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="mt-6 flex items-start gap-3">
              <input
                type="checkbox"
                checked={settings.autoSuggest}
                onChange={(e) => updateSettings({ autoSuggest: e.target.checked })}
                className="accent-brand mt-1 size-4"
              />
              <span className="text-sm">
                <span className="font-medium">Auto-suggest focus areas</span>
                <span className="text-muted block">
                  Suggests parts of your topic or material to focus on. Uses a small amount of your
                  API credit, once per source. When off, you can still ask for suggestions.
                </span>
              </span>
            </label>
          </div>
        </>
      )}

      <div className="border-border bg-surface mt-6 rounded-2xl border p-5 sm:p-6">
        <h2 className="font-semibold">Privacy</h2>
        <ul className="text-muted mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Your key is stored only in this browser and sent only to {provider.company}.</li>
          <li>There is no Quiz Generator server: we never see your key, notes or quizzes.</li>
        </ul>
        <label htmlFor={ids.remember} className="mt-4 flex items-start gap-3">
          <input
            id={ids.remember}
            type="checkbox"
            checked={settings.rememberKeys}
            onChange={(e) => updateSettings({ rememberKeys: e.target.checked })}
            className="accent-brand mt-1 size-4"
          />
          <span className="text-sm">
            <span className="font-medium">Remember keys on this device</span>
            <span className="text-muted block">
              Off: keys are forgotten when you close this tab. Only turn on for a personal device.
            </span>
          </span>
        </label>
        <button
          type="button"
          onClick={() => {
            forgetAllKeys()
            setDraftKey('')
            setTest({ status: 'idle' })
          }}
          disabled={Object.keys(settings.keys).length === 0}
          className="border-wrong/40 text-wrong hover:bg-wrong/10 mt-4 rounded-xl border-2 px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Forget all keys
        </button>
      </div>
    </motion.section>
  )
}

/** Make sure the selected model is always one of the options. */
function withCurrent(options: ModelOption[], current: string): ModelOption[] {
  return options.some((m) => m.id === current)
    ? options
    : [{ id: current, label: current }, ...options]
}
