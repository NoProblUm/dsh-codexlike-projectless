import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const [playwright, operation = 'inspect', root = 'output/runtime-candidate-rc5-core', argument = '', launcher = 'scripts/acceptance-rc5.mjs'] = process.argv.slice(2)
if (!playwright) throw new Error('Usage: node scripts/run-rc5-acceptance.mjs <playwright/index.mjs> <inspect|install|source|eval|screenshot> <profile-root> [file or package]')
execFileSync(process.execPath, [launcher, 'inspect', root], { windowsHide: true })
const { chromium } = await import(pathToFileURL(resolve(playwright)).href)
const browser = await chromium.connectOverCDP('http://127.0.0.1:19822')
const out = resolve('output/rc5-desktop-20261031')
mkdirSync(out, { recursive: true })
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-')
try {
  const page = browser.contexts()[0].pages().find(page => page.url() === 'dsh-app://app/')
  assert.ok(page, 'test-owned renderer missing')
  page.setDefaultTimeout(15000)
  await page.waitForFunction(() => globalThis.__DSH_ACCEPTANCE__?.snapshot().sessions.phase === 'ready', null, { timeout: 45000 })
  let result
  if (operation === 'inspect') result = { snapshot: await page.evaluate(() => __DSH_ACCEPTANCE__.snapshot()), body: await page.locator('body').ariaSnapshot() }
  else if (operation === 'install') {
    result = await page.evaluate(spec => __DSH_ACCEPTANCE__.manager.install(spec), argument)
    assert.equal(result.ok, true, JSON.stringify(result))
    assert.notEqual(result.value.application, 'failed', JSON.stringify(result))
    if (result.value.packageResult) assert.equal(result.value.packageResult.exitCode, 0, JSON.stringify(result))
  }
  else if (operation === 'source') result = await new Function('page', 'focus', 'return (' + readFileSync(argument, 'utf8') + ')(page)')(page, () => execFileSync(process.execPath, [launcher, 'focus-window', root], { windowsHide: true }))
  else if (operation === 'eval') result = await page.evaluate(readFileSync(argument, 'utf8'))
  else if (operation === 'screenshot') { await page.screenshot({ path: resolve(argument) }); result = { screenshot: resolve(argument) } }
  else throw new Error('Unknown acceptance operation')
  writeFileSync(`${out}/${stamp}-${operation}.json`, JSON.stringify({ root: resolve(root), operation, argument, passed: true, result }, null, 2))
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  writeFileSync(`${out}/${stamp}-${operation}.json`, JSON.stringify({ root: resolve(root), operation, argument, passed: false, error: String(error) }, null, 2))
  throw error
} finally { await browser.close() }
