import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [modulePath, scenario] = process.argv.slice(2)
const allowed = new Set(['plan', 'switch', 'loss', 'unknown', 'attachments', 'disable'])
if (!modulePath || !allowed.has(scenario)) throw new Error('Usage: node scripts/run-runtime-desktop-smoke.mjs <playwright/index.mjs> <plan|switch|loss|unknown|attachments|disable>')
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href)
const browser = await chromium.connectOverCDP('http://127.0.0.1:19402')
try {
  const page = browser.contexts()[0].pages().find(page => page.url() === 'dsh-app://app/')
  if (!page) throw new Error('Test-owned Desktop page is not running')
  await page.waitForFunction(() => globalThis.__DSH_ACCEPTANCE__?.snapshot().sessions.phase === 'ready')
  const focus = () => execFileSync(process.execPath, ['scripts/probe-runtime-desktop.mjs', 'focus-window'], { windowsHide: true })
  const source = readFileSync(`experiments/runtime-acceptance/desktop-${scenario}.js`, 'utf8')
  const run = new Function('page', 'focus', 'return (' + source + ')(page)')
  console.log(JSON.stringify(await run(page, focus)))
} finally { await browser.close() }
