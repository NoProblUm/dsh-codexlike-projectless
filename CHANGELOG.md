# Changelog / 变更日志


## 1.0.1 - 2026-10-17

### 简体中文

- 补发本地最终 1.0.0 中遗漏的新建会话修正：项目内全局新建继承当前项目；无项目下新建仍创建本地草稿。
- 保留项目内带参数新建的原生初始化回调，避免初始文本丢失。
- 保留 README 原文与示例图，仅简要说明当前版本与 0.x 的区别。

### English

- Include the fixes omitted from the published 1.0.0: global New Chat inherits the current project, while projectless chats open a new local draft.
- Preserve native initialization callbacks for project chats created with initial input.
- Keep the original README content and screenshots, with a short comparison between the current version and 0.x.

## 1.0.0 - 2026-10-17

### 简体中文

- 正式发布单一市场包，支持 Windows DSH Desktop 0.2.1-rc.2（构建 332895e0f7c9d4dbfb29729f5eb367fa263ff986）；不需要归档补丁或外部安装器。
- 保留原生输入框、模型与推理档位、Agent、规划及附件；首次发送才按日期与主题创建工作目录。
- 使用原生文件注册表和延迟上传，发送前核对所选模型与推理档位；失败保留输入，结果不明时禁止重复首发。
- 已接收但 Workspace 注销失败时保留会话和产物，支持独立重试注销。
- 用户于 2026-10-17 确认已重新实测通过并授权正式发布；此前自动化隔离市场更新失败记录仍保留在适配说明中，不记为自动验收通过。
- 发布流程等待 Linux 与 Windows 检查通过，提供插件 tgz 与 SHA-256 校验文件。

### English

- Stable single-package release for Windows DSH Desktop 0.2.1-rc.2, build 332895e0f7c9d4dbfb29729f5eb367fa263ff986. No archive patch or external installer is required.
- Preserve native input, model/reasoning selection, Agent, planning and attachments; create the dated topic directory only on first send.
- Defer native file upload until Session creation, validate the selected model route, preserve failed input and prevent duplicate uncertain submissions.
- Retain accepted Sessions and output when Workspace detachment fails, with an independent retry.
- The maintainer confirmed a successful manual retest and authorized this stable release on 2026-10-17. Earlier isolated market-update failures remain documented separately.
- Require Linux and Windows verification before publishing the plugin tarball and SHA-256 checksums.

## 1.0.0-rc2 — local test candidate (2026-10-17)

- Target only Windows DSH 0.2.1-rc.2, build 332895e0f7c9d4dbfb29729f5eb367fa263ff986; pin DSH development dependencies and engines.dsh.
- Preserve new-session prompt, clearPreviousDraft and agentPreset through the public input initialization API. Explicit workspaces delegate to native navigation.
- Replace placeholder file receipts with local pending state and display-only adaptation. Upload through the native service after real Session creation; retain inputs on failure and upload again for a different Session.
- Verify the exact frozen model route and reasoning effort against the current host catalog; unavailable routes block sending.
- Keep accepted sessions when temporary Workspace detachment fails, with an independent detach retry. Track wrapper identity and activation generation; avoid duplicate activation.
- Preserve the frozen rc1 package and source snapshot. No GitHub push, npm publication or daily-profile replacement.
- Layered evidence and limitations: [DSH rc.2 acceptance](docs/适配-DSH-0.2.1-rc.2.md).

Independent release history for DSH Codexlike Projectless. Historical development validation is retained separately and does not define this project's versions.

本日志记录 DSH Codexlike Projectless 的独立版本；历史开发验证记录单独保留。

## 1.0.0-rc1 - 2026-10-17

### English

- Ship one prebuilt market package with a version-specific in-memory adapter for the verified Windows Desktop 0.2.0-rc.2 build. No archive patch or external installer is part of the new installation path.
- Keep client-local drafts, the native composer and attachment registry, selected settings, first-send title preparation and Workspace detachment.
- Install startup navigation interception before connection-dependent work; retain native default-project initialization for an unset choice and prioritize valid history on restore.
- Reconcile uncertain submission by its native request identity, preserve resources and input on transport failures, and avoid sweeping earlier uncertain operations after reload.
- Check native command results before sending; use `/plan` without treating `on` as a flag. Preserve wrapper ownership during teardown.
- Drafts are page-local; closing, refreshing, restarting or disabling does not promise recovery. Old archive installations require an explicit verified restoration before migration.
- Release assets are the plugin `.tgz` and checksum. Detailed acceptance evidence and remaining limitations are maintained in docs/运行时适配与验收.md.

### 简体中文

- 使用单一预构建市场包，为已验证的 Windows Desktop 0.2.0-rc.2 构建提供内存适配；新安装路径不包含归档补丁或外部安装器。
- 保留本地草稿、原生输入和附件注册表、所选设置、首发主题准备及 Workspace 注销。
- 联网业务之前接入启动导航；未保存选择时保留默认项目初始化，启动优先恢复有效历史。
- 按原生请求标识确认结果不明的提交，保留输入和资源，刷新后不清扫此前不确定的操作。
- 发送前检查原生命令结果，使用无参数 `/plan`，释放时检查包装归属。
- 草稿仅在当前页面保留；关闭、刷新、重启或停用后不承诺恢复。旧归档安装必须明确恢复原版后迁移。
- 发布产物为插件 `.tgz` 和校验文件。详细验收证据及限制见 docs/运行时适配与验收.md。

## 0.1.1 - 2026-10-04

### English

- Provide a Windows installer ZIP with a bundled Node.js installer; no npm installation or source build is needed by users.
- Use the same entry point for first installation and updates, detect application paths, and prepare compatibility patches for the selected profile.
- Store plugin files, original archives and restore tools under the profile so the download directory can be deleted.
- Preserve plugin settings, edit YAML structurally, and restore pre-installation state after failed writes.
- Document local `.tgz` import through a plugin market and the required native bridge step in both READMEs.
- Add installer integration tests and a Windows CI job. Live Desktop installation and restart acceptance still need verification.

### 简体中文

- 提供 Windows 安装 ZIP，内置 Node.js 安装工具，用户无需安装 npm 依赖或构建源码。
- 首次安装与更新使用同一入口，检测安装位置，并为目标 profile 自动准备兼容补丁。
- 插件文件、原版 archive 和恢复工具保存在 profile 下，下载目录可以删除。
- 保留插件设置，按 YAML 结构修改配置，写入失败后恢复安装前状态。
- 中英文 README 补充插件市场本地 `.tgz` 导入及必需的原生补丁步骤。
- 增加安装器集成测试与 Windows CI。实际 Desktop 安装、重启验收仍需验证。

## 0.1.0 - 2026-10-03

### English

- Initial independent release with repository, package and plugin identity `dsh-codexlike-projectless`.
- Provide a Codex-inspired projectless conversation workflow using DSH's native composer and send path.
- Create working directories by date and topic on first send; retain conversations under Ungrouped.
- Restore each project's in-memory draft when switching, and retain the default project selection across restarts.
- Configure a workspace root using independent settings and browser state namespaces.
- Include version-guarded native patches, reversible installation scripts and bilingual documentation.
- Retain upstream MIT source attribution in NOTICE and LICENSE.

### 简体中文

- 独立初版，仓库、包名与插件身份统一为 `dsh-codexlike-projectless`。
- 使用 DSH 原生输入框和发送链路，提供受 Codex 启发的无项目会话工作流。
- 首次发送时按日期和主题创建工作目录，会话保留在“未分组”。
- 切换项目时恢复各自运行期草稿，默认项目选择跨重启保留。
- 工作区根目录设置与浏览器状态采用独立命名空间。
- 提供版本校验的原生补丁、可恢复安装脚本及中英文文档。
- 在 NOTICE 和 LICENSE 中保留上游 MIT 源码归属。
