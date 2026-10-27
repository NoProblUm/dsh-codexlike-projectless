export const ADAPTER_ID = 'desktop-0.2.1-rc.3-be72761e-runtime-1'
export const RUNTIME_PACKAGE_VERSION = '1.2.0'
export const TARGET_BUILD = 'be72761ee1a6736ebcdf4f3739363b083ae53c98'
export type RuntimeState = 'checking' | 'restart-required' | 'ready' | 'unsupported' | 'conflict' | 'failed'
export interface RuntimeStatus {
  state: RuntimeState
  reason: string
  adapter: string
  version: string
  build: string
  missingCapabilities: string[]
}
export const RUNTIME_WRAPPER = Symbol.for('dsh-codexlike-projectless.runtime-wrapper')
let wrapperGeneration = 0

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
  Object.defineProperty(installed, RUNTIME_WRAPPER, { value: { target, key, original, installed, generation: ++wrapperGeneration } })
  target[key] = installed
  if (target[key] !== installed) throw new Error(`Runtime method is not writable: ${key}`)
  return () => {
    if (target[key] !== installed) return
    if (descriptor) Object.defineProperty(target, key, descriptor)
    else delete target[key]
  }
}
