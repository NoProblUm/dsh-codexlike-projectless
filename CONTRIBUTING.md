# Contributing

Requirements:

- Node.js 22.19 or newer
- Windows with DeepSeek Harness Desktop 0.2.0-rc.2 for native integration checks

Install and verify:

```bash
npm ci
npm run verify
```

Keep the generated `lib/` artifacts in sync with `src/`. Before opening a pull
request, run `npm run verify` and commit any resulting `lib/` changes.

For UI changes, verify these transitions in an isolated DSH Web profile:

1. The Workspace menu contains “无项目” and the project-clear action appears on hover/focus.
2. The blank Session remains writable before its first prompt.
3. After the first accepted prompt, the Session moves to “未分组”.
4. After a DSH restart, the Session can be reopened and continued.
5. Before the first send, switching projects restores each in-memory draft without
   creating a real Session, Workspace or working directory.

Build the end-user installation bundle after verification:

```bash
npm pack --ignore-scripts
npm run package:installer
```

The ZIP is written to `output/`. Packaging requires `zip` on Linux/macOS or
PowerShell on Windows; end users only need Node.js and the extracted bundle.
The installer bundles its YAML parser and native patch code and generates the
DSH archive locally. Do not include application archives in release assets.
`npm run test:installer` exercises real 0.2.0-rc.2 module patch anchors in synthetic
ASAR fixtures, first installation, updates, profile preservation and rollback.
Windows CI checks the PowerShell launchers and bundle. Before release acceptance,
also test a real Desktop first install, update, restart and restoration, including
local `.tgz` import and custom profiles. Fixture checks do not establish live UI
acceptance.

Follow the installation instructions in README.md. Do not
commit DSH archives, profiles, model logs, installation backups or local test data.
The GitHub tag must match `package.json`; the release workflow does not publish npm.

Keep the filesystem endpoints on DSH's authenticated `/api` Connection channel;
do not expose them on a route that skips its Host/Origin fence and browser
authentication.
