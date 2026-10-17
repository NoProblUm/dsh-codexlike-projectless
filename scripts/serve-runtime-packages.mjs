import { createServer } from 'node:http'
import { createReadStream, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
const root = resolve('output/runtime-packages-rc1')
const port = Number(process.argv[2] ?? 18549)
createServer(async (request, response) => {
  const name = new URL(request.url, 'http://localhost').pathname.slice(1)
  if (name === 'registry.json') {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    response.end(readFileSync(join(root, 'registry.json')))
    return
  }
  if (name === 'dsh-codexlike-projectless' || name === 'dsh-codexlike-projectless/latest') {
    const registry = JSON.parse(readFileSync(join(root, 'registry.json'), 'utf8'))
    const version = registry.plugins[0].version
    const versions = {}
    for (const candidate of ['1.0.0-rc0', '1.0.0-rc1']) {
      const bytes = readFileSync(join(root, `dsh-codexlike-projectless-${candidate}.tgz`))
      versions[candidate] = { ...JSON.parse(readFileSync('package.json', 'utf8')), version: candidate,
        dist: { tarball: `http://127.0.0.1:${port}/dsh-codexlike-projectless-${candidate}.tgz`, shasum: createHash('sha1').update(bytes).digest('hex'), integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') } }
    }
    const metadata = { name: 'dsh-codexlike-projectless', 'dist-tags': { latest: version }, versions, time: { created: '2026-10-01T00:00:00Z', modified: '2026-10-01T00:00:00Z', '1.0.0-rc0': '2026-10-01T00:00:00Z', '1.0.0-rc1': '2026-10-01T00:00:00Z' }, repository: versions[version].repository }
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    response.end(JSON.stringify(name.endsWith('/latest') ? versions[version] : metadata))
    return
  }
  if (!/^(?:dsh-codexlike-projectless-1\.0\.0-rc[01]|dshmarket-1\.66\.28)\.tgz$/.test(name)) {
    // Keep unrelated market dependencies on the real public npm registry.
    // The candidate's name is the only metadata overridden by this fixture.
    try {
      const upstream = await fetch('https://registry.npmjs.org/' + name, { signal: AbortSignal.timeout(20000) })
      response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' })
      Readable.fromWeb(upstream.body).pipe(response)
    } catch { response.writeHead(502).end() }
    return
  }
  try {
    const path = join(root, name)
    response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': statSync(path).size })
    createReadStream(path).pipe(response)
  } catch { response.writeHead(404).end() }
}).listen(port, '127.0.0.1', () => console.log('Test-only prebuilt package server: http://127.0.0.1:' + port + ' pid=' + process.pid))
