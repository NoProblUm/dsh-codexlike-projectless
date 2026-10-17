# dsh-codexlike-projectless

**English** | [简体中文](README.zh-CN.md)

Edit a no-project draft in DeepSeek Harness, then create a working directory by date and topic on first send. Keep the native composer, model and reasoning controls, permissions, Agent presets, planning, attachments and submission state machine.

**1.0.0-rc1** is a single-package release candidate containing the business code and a version-specific runtime adapter. It does not rewrite the application archive or third-party plugin files and needs no external installer. See the [runtime and acceptance record](docs/运行时适配与验收.md) for evidence and limitations.

This independently maintained project is not an official DeepSeek or OpenAI product. It includes MIT-licensed code by Jarvis Luk; attribution remains in [NOTICE](NOTICE) and [LICENSE](LICENSE).

## Supported host

Windows Desktop **0.2.0-rc.2**, build **04f392c9ddd144fa426da2045178797da6db6c11**. The Host verifies fingerprints of five original modules; the Client checks required methods and wrapper ownership. Other builds with the same version number are not automatically supported.

The adapter depends on this build's internal implementation. Unsupported builds, a remaining archive patch or another plugin taking ownership of a critical method disable the no-project flow with an explanation under Settings → General → No-project conversations. It does not compete for methods or install archive patches.

Combinations with new-session interception features such as Git Graph require separate validation. Users without those plugins need not install them. Arbitrary plugin versions and loading orders are not promised compatible.

## Install, update and remove

1. Install the prebuilt dsh-codexlike-projectless-1.0.0-rc1.tgz through a DSH plugin market or the official plugin manager.
2. Quit and reopen the entire application normally. “Normal restart required” is not a ready status.
3. Save a workspace root under Settings → General → No-project conversations. The default is ~/Documents/DSH.

Users need no Node.js, downloaded scripts, manual extraction, Install.cmd or package-manager configuration changes. The market and official manager own installation and updates.

Disabling or removing releases this plugin's runtime changes while preserving created Sessions, directories and user output. Unsent drafts are not guaranteed to survive disabling; save anything needed first. Submitted or uncertain operations are not resent or reclaimed when the UI unloads.

### Migrating a patched 0.1.x installation

Disable the old plugin, explicitly restore the original application using its matching recovery record, verify the restored build and archive, then install through the market. Remove an installer-owned link: copy through the manager before installing its market replacement. Do not layer this adapter over the archive patch.

Old recovery tools may restore the profile configuration from their backup; check later configuration changes first. This release does not silently restore archives or choose backups. Sessions and directories remain. Historical installers stay in the repository as a baseline, not this release's installation path.

## Behavior

- An explicitly selected no-project draft creates no Host Session, Workspace or task directory before first send. Files remain in the native attachment registry until the real Session exists; images retain native encoding and submission.
- First send freezes input and settings, prepares a native provider/fallback title, then atomically creates ROOT/YYYY-MM-DD/topic. Collisions use _2 and _3; existing directories are never adopted.
- After admission, the temporary Workspace is unregistered while the Session, cwd, directory and history remain. A failed unregister retains accepted output and reports the failure.
- Switching projects restores the latest blank editor within the same page. Explicit New opens another blank editor without its previous text or attachments.
- Closing, refreshing, restarting or disabling does not guarantee draft recovery. The project selection remains persistent.
- Valid native history takes precedence at startup. An unset choice preserves native default-project initialization; a saved no-project choice with an absent or blank restore target opens a fresh local draft.
- Creation failure and explicit rejection retain retryable input and reclaim only safely removable resources owned by the attempt. Unsupported Agent settings fail before submission instead of being ignored.
- Uncertain admission retains input and resources, blocks another first send and reconciles the exact native request against durable messages. Reload does not sweep earlier uncertain resources. Nothing is resent automatically.

The project name and arrow open its menu. A selected project's folder area reveals an × on hover or keyboard focus to switch to no project without changing historical membership or cwd.

## Development

Developers need Node.js 22.19+:

    npm ci
    npm run verify
    npm pack --ignore-scripts

Automated checks do not replace native Desktop, attachment, native keyboard, market or restart acceptance. Diagnostic probes and deterministic model fixtures under experiments/ are excluded from the market package. Fixture results do not claim calls to an external model service.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
