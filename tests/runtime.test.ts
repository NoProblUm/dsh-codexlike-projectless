import assert from 'node:assert/strict'
import test from 'node:test'
import { originalInstance, wrapRuntimeMethod } from '../src/shared/runtime.ts'

test('runtime wrapper preserves receiver, result, errors and inherited property shape', () => {
  const failure = new Error('original failure')
  class Target {
    value = 7
    invoke(delta: number) { if (delta < 0) throw failure; return this.value + delta }
  }
  const target = new Target()
  const restore = wrapRuntimeMethod(target, 'invoke', (original, receiver, args) => original.apply(receiver, args))
  assert.equal(target.invoke(2), 9)
  assert.throws(() => target.invoke(-1), error => error === failure)
  restore()
  restore()
  assert.equal(Object.hasOwn(target, 'invoke'), false)
  assert.equal(target.invoke(2), 9)
})

test('runtime disposal never overwrites a later plugin and restores exact own descriptor', () => {
  const target = { invoke: () => 'native' }
  const before = Object.getOwnPropertyDescriptor(target, 'invoke')
  const restore = wrapRuntimeMethod(target, 'invoke', () => 'ours')
  const later = () => 'later'
  target.invoke = later
  restore()
  assert.equal(target.invoke, later)
  target.invoke = before!.value
  const second = wrapRuntimeMethod(target, 'invoke', () => 'ours')
  second()
  assert.deepEqual(Object.getOwnPropertyDescriptor(target, 'invoke'), before)
})

test('Cordis proxy identity is unwrapped before method ownership checks', () => {
  const target = { invoke: () => 'native' }
  const proxy = new Proxy(target, { get(object, key) {
    if (key === Symbol.for('cordis.original')) return object
    const value = Reflect.get(object, key)
    return typeof value === 'function' ? value.bind(object) : value
  } })
  assert.notEqual(proxy.invoke, proxy.invoke)
  assert.equal(originalInstance(proxy), target)
  const restore = wrapRuntimeMethod(proxy, 'invoke', () => 'ours')
  assert.equal(proxy.invoke(), 'ours')
  restore()
  assert.equal(proxy.invoke(), 'native')
})
