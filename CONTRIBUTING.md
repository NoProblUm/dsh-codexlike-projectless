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

Follow the native preparation and installation instructions in README.md. Do not
commit DSH archives, profiles, model logs, installation backups or local test data.
The GitHub tag must match `package.json`; the release workflow does not publish npm.

Keep the filesystem endpoints on DSH's authenticated `/api` Connection channel;
do not expose them on a route that skips its Host/Origin fence and browser
authentication.
