# DSH Codexlike Projectless

**English** | [简体中文](README.zh-CN.md)

Write first, choose a project later. This plugin adds Codex-like no-project conversations to DeepSeek Harness: compose a local draft, then create a working directory organized by date and topic on the first send.

[Download v1.3.0](https://github.com/NoProblUm/dsh-codexlike-projectless/releases/tag/v1.3.0) · [npm](https://www.npmjs.com/package/dsh-codexlike-projectless) · [Changelog](CHANGELOG.md) · [Acceptance report](docs/1.3.0-验收报告.md)

## Compatibility

**1.3.0 targets Windows x64 DSH Desktop 0.2.1-rc.5**, exact clean build `d4db512a969fccf0c5cc7ec8fe38e9c1d27af916`. The adapter checks the host build and original module fingerprints at runtime.

| DSH Desktop | Plugin version | Notes |
| --- | --- | --- |
| 0.2.1-rc.5 | [1.3.0](https://github.com/NoProblUm/dsh-codexlike-projectless/releases/tag/v1.3.0) | Exact Windows x64 build above |
| 0.2.1-rc.3 | [1.2.0](https://github.com/NoProblUm/dsh-codexlike-projectless/releases/tag/v1.2.0) | Use that release's verified build |
| 0.2.1-rc.2 | [1.1.0](https://github.com/NoProblUm/dsh-codexlike-projectless/releases/tag/v1.1.0) | Use that release's verified build |
| rc.4, other builds or platforms | Not validated | Do not bypass the compatibility check |

The 1.x adapter is included in the plugin package. There is no separate installer, Node.js requirement for users, or app.asar modification. If you installed a patched 0.x version, restore the original application using its installation record before migrating.

## Install or update

1. Download [dsh-codexlike-projectless-1.3.0.tgz](https://github.com/NoProblUm/dsh-codexlike-projectless/releases/download/v1.3.0/dsh-codexlike-projectless-1.3.0.tgz) and [SHA256SUMS](https://github.com/NoProblUm/dsh-codexlike-projectless/releases/download/v1.3.0/SHA256SUMS).
2. Verify the archive's SHA-256, then import it through DSH's plugin market or official plugin manager. If the market already lists the matching version, you can install or update there instead; if it still shows an older version, import the archive.
3. Quit and reopen the entire DSH application normally. A hot enable may show a restart-required status.
4. Under **Settings → General → No-project conversations**, choose a workspace root and save it. Check that the runtime status is ready.

To check the download in PowerShell:

```powershell
Get-FileHash .\dsh-codexlike-projectless-1.3.0.tgz -Algorithm SHA256
```

Match the hash with SHA256SUMS. When updating from rc.3, keep a backup before switching hosts, update to the matching plugin through the official manager, and restart. Unsent drafts do not survive that restart.

Disable or uninstall through the official manager. This releases the plugin's runtime wrappers while preserving created conversations, directories and user files. Save unsent draft content before disabling or removing it. An old `link:` installation should be removed through the manager before importing the package.

## Using no-project conversations

- Hover or keyboard-focus the project button and activate its close icon, or choose **No project** in the project picker.
- Write text, add files or images, and choose a model, Agent preset, permissions or planning mode using the native controls.
- In no-project mode, New Conversation, its shortcut and the Ungrouped sidebar action restore the most recently used eligible unsent draft. A local draft is created when none qualifies. In a project, normal new-conversation behavior delegates blank reuse to DSH.
- Initialization requests follow the native keep, replace or append policy. Requests carrying an Agent preset do not reuse a draft that explicitly lists a different preset. Initialization does not send the message.

Before first send, the draft creates no host Session, Workspace or task directory. On the first send:

1. DSH's built-in title service generates a topic using the selected model, with the native fallback if title generation fails.
2. The plugin creates `ROOT/YYYY-MM-DD/topic`, adding `_2`, `_3`, etc. for collisions, and creates one real Session.
3. The native send path receives the text, attachments and selected controls.
4. After acceptance, the temporary Workspace registration is removed. The Session, directory, cwd and history remain; the conversation appears under Ungrouped.

The native composer, project control and Agent mode row stay in place. Sent conversations keep their native layout without an extra project bar. If acceptance cannot be confirmed, the plugin blocks resending and preserves uncertain resources while awaiting native persistent Session state. A cleanup failure locks the draft; cleanup retries do not send the message again.

## Workspace root

Save a root under **Settings → General → No-project conversations**. The UI displays the effective path; failed validation or saving leaves the old value in place. The override is stored in `DSH_HOME/storages/dsh-codexlike-projectless-settings.json` and survives restarts.

Without an override, the root comes from the profile's `dsh-codexlike-projectless.config.root`, falling back to `~/Documents/DSH`. A change affects future first sends; existing directories are not moved. Each in-progress first send retains its starting root for allocation and rollback.

## Screenshots

These unmodified screenshots were captured on 2026-10-03 from a real, running DSH Desktop 0.2.0-rc.2 instance on Windows with the pre-rename development build 0.7.0-local.5. The isolated profile loads only DSH's built-in components and this plugin, using the native UI without theme, pet or enhanced sidebar plugins. Three example projects, six project conversations and one ungrouped conversation were created specifically for this demonstration; no personal conversation history is included. The example conversations illustrate project membership, not model execution results. Interface labels, example project names, conversation titles and draft text are shown in English.

### No-project draft alongside project conversations

The sidebar shows three example projects and their conversations, while the current editor is in no-project mode with native model, permissions and Agent preset controls. An example under Ungrouped illustrates the difference from project-bound conversations.

![Native no-project draft alongside three example projects and their grouped conversations](docs/images/en/projectless-draft.png)

### Switch from a project to no-project mode

This historical screenshot shows the older circular ×; 1.1.0 uses the host's native close icon to open the no-project editor. The selected project is "Example: Study notes", with other projects and ungrouped conversations visible in the sidebar.

![Circular clear action visible inside the workspace picker on hover](docs/images/en/project-clear.png)

### Choose the conversation directory

General Settings lets you browse, save and inspect the effective workspace root. The example root is `C:\Documents\DSH`; you can choose your own location.

![No-project conversation workspace root setting](docs/images/en/root-settings.png)

## Validation and limits

Version 1.3.0 passed type checking, **88 tests** and builds. Isolated tests used an unmodified official rc.5 Desktop, separate profiles, the official plugin manager and a keyless model fixture. Coverage includes first send, attachments, title fallback, submission failures and reconciliation, cleanup, install/update/disable/remove/reinstall, the rc.3 + stable 1.2.0 upgrade, **12 draft layouts**, **48 native UI comparisons** and **10 reasoning-display comparisons**. The stable package also passed installation, normal restart, ready-state, one-submit first-send and installed-byte checks. See the [acceptance report](docs/1.3.0-验收报告.md) for the exact boundaries.

- Draft text, references, attachments and editor controls live in client memory and do not survive refresh, closing or restart. The selected project and saved root persist.
- Git Graph 0.4.6 combinations remain unsupported. Earlier standalone rc.3 testing lost initialization text; this release does not claim rc.5 combination support. Unknown navigation wrappers are rejected.
- At 800 width and 150% zoom, native hero content can clip with or without the plugin. UI comparisons cover the recorded geometry and interactions, not every possible display issue.
- The fixture does not validate external model authentication, connectivity, billing or quality. Windows host-installer overwrite upgrades, translation renderers and arbitrary third-party combinations were not tested.
- Tools, tasks and commands requiring a real Session or execution directory become available after the first message creates the Session.

## Development

Git and Node.js 22.19 or newer are required:

```powershell
git clone https://github.com/NoProblUm/dsh-codexlike-projectless.git
cd dsh-codexlike-projectless
git checkout v1.3.0
npm ci
npm run verify
npm pack --ignore-scripts
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and historical validation. The release workflow verifies Windows and Linux builds, creates a GitHub Release with the plugin archive and SHA256SUMS, then publishes the same archive to npm through the configured trusted publisher. Stable versions use npm's `latest` tag. Test profiles, host application archives and raw runtime logs are excluded from the public repository and package.

## Attribution and license

This independently maintained project is based on [Jarvis Luk's dsh-projectless-session](https://github.com/jarvisluk/dsh-projectless-session). Thanks to [Jarvis Luk](https://github.com/jarvisluk) for the original projectless conversation work and MIT-licensed source foundation.

The original copyright and MIT license are retained in [LICENSE](LICENSE), with source attribution in [NOTICE](NOTICE). The pinned Git Graph compatibility route includes Apache-2.0 code; its attribution, modifications and license are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Retaining that code does not imply supported Git Graph combinations on rc.5.

Maintained independently by NoProblUm. This is not an official DeepSeek or OpenAI project. The repository and package name are both `dsh-codexlike-projectless`.
