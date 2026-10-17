# Contributing

Requirements:

- Node.js 22.19 or newer
- Windows with DeepSeek Harness Desktop 0.2.1-rc.2 for native integration checks

Install and verify:

```bash
npm ci
npm run verify
```

Keep the generated `lib/` artifacts in sync with `src/`. Before opening a pull
request, run `npm run verify` and commit any resulting `lib/` changes.

For UI changes, verify these transitions in an isolated DSH Web profile:

1. The Workspace menu contains “无项目” and the project-clear action appears on hover/focus.
2. The client-local draft remains writable before its first prompt, without a Host Session.
3. After the first accepted prompt, the Session moves to “未分组”.
4. After a DSH restart, the Session can be reopened and continued.
5. Before the first send, switching projects restores each in-memory draft without
   creating a real Session, Workspace or working directory.

Build the prebuilt market package after verification:

```bash
npm pack --ignore-scripts
```

The release contains the prebuilt `.tgz` and its checksum, with no installer ZIP.
End users do not need Node.js. Historical native patches and installer tests remain
as a reference; do not use them to install the runtime-adapter release.
Before release, verify first install, update, ordinary restart, disable and removal
through the real market/official manager in an isolated original Desktop. Record
the distinction between test catalog transport, deterministic model fixtures,
native input simulation, and an external provider call. Verify unchanged hashes
for the original application and third-party files. Fixture checks alone do not
establish live acceptance. See docs/运行时适配与验收.md.

Follow the installation instructions in README.md. Do not
commit DSH archives, profiles, model logs, installation backups or local test data.
The GitHub tag must match `package.json`. After verification, `release.yml` publishes
the same prebuilt package to GitHub Releases and npm using trusted publishing
(OIDC, no npm token). Stable versions use `latest`; prereleases use `next`.
Already published npm versions are skipped on retries. Use the workflow's manual
Run workflow action to recover a failed release without creating another version.

Keep the filesystem endpoints on DSH's authenticated `/api` Connection channel;
do not expose them on a route that skips its Host/Origin fence and browser
authentication.
