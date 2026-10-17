export const ADAPTER_ID = 'desktop-rc2-04f392c9-runtime-1'
export const RUNTIME_PACKAGE_VERSION = '1.0.0-rc1'
export type RuntimeState = 'checking' | 'restart-required' | 'ready' | 'unsupported' | 'conflict' | 'failed'
export interface RuntimeStatus {
  state: RuntimeState
  reason: string
  adapter: string
  version: string
}

/** Cordis proxies manufacture method faces; ownership belongs to the original. */
export function originalInstance<T>(value: T): T {
  return (value as T & { [key: symbol]: T })?.[Symbol.for('cordis.original')] ?? value
}

/** Restore the original property shape only while this installation still owns it. */
export function wrapRuntimeMethod(target: any, key: string, replacement: (original: (...args: any[]) => any, receiver: any, args: any[]) => any): () => void {
  target = originalInstance(target)
  const descriptor = Object.getOwnPropertyDescriptor(target, key)
  const original = target[key]
  if (typeof original !== 'function') throw new Error(`Missing runtime method: ${key}`)
  const installed = function (this: any, ...args: any[]) { return replacement(original, this, args) }
  target[key] = installed
  if (target[key] !== installed) throw new Error(`Runtime method is not writable: ${key}`)
  return () => {
    if (target[key] !== installed) return
    if (descriptor) Object.defineProperty(target, key, descriptor)
    else delete target[key]
  }
}
