import { useEffect, useState } from 'react'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { PROJECTLESS_LOCALE_NS } from './locales.ts'
import { requestProjectlessRoot } from './session.ts'
import { PROJECTLESS_RPC_CHANNEL, projectlessEndpoint } from '../shared/rpc.ts'

export function ProjectlessSettings({ rpc, browse, t }: PropsLocale<typeof PROJECTLESS_LOCALE_NS> & {
  rpc: ClientConnectionRpc, browse(): Promise<string | null>
}) {
  const [path, setPath] = useState('')
  const [active, setActive] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    let mounted = true
    void requestProjectlessRoot(rpc).then(root => { if (mounted) { setPath(root); setActive(root) } })
      .catch(reason => { if (mounted) setError(String(reason)) })
      .finally(() => { if (mounted) setBusy(false) })
    return () => { mounted = false }
  }, [rpc])
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError(''); setSaved(false)
    try { await operation() } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  return <section className="dsh-projectless-settings" aria-label={t('settings.title')}>
    <strong>{t('settings.title')}</strong>
    <label htmlFor="projectless-root">{t('settings.root')}</label>
    <div className="dsh-projectless-settings-controls">
      <input id="projectless-root" value={path} disabled={busy} onChange={event => { setPath(event.target.value); setSaved(false) }} />
      <Button disabled={busy} onClick={() => { void run(async () => { const chosen = await browse(); if (chosen !== null) setPath(chosen) }) }}>{t('settings.browse')}</Button>
      <Button disabled={busy || path.trim() === ''} onClick={() => { void run(async () => {
        const result = await rpc.call(PROJECTLESS_RPC_CHANNEL, projectlessEndpoint('save-root'), { path: path.trim() })
        if (!result.ok) throw new Error(result.error.message)
        const root = (result.value as { root: string }).root
        setActive(root); setPath(root); setSaved(true)
      }) }}>{t('settings.save')}</Button>
    </div>
    <small>{t('settings.active')}：{active}</small>
    {saved && <small role="status">{t('settings.saved')}</small>}
    {error && <small role="alert" className="dsh-codexlike-projectless-error">{error}</small>}
  </section>
}
