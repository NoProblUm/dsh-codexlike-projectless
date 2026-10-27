# Changelog / 变更日志


## 1.2.0 - 2026-10-27

### 简体中文

- 支持 Windows DSH Desktop 0.2.1-rc.3，精确构建 be72761ee1a6736ebcdf4f3739363b083ae53c98；Desktop rc.2 请继续使用 1.1.0。
- 跟随 rc.3 的空白会话和 Agent 预设复用规则，保留 keep/replace/append 输入初始化、附件及原生提交状态。无项目草稿首发前不创建真实会话、工作区或目录。
- 首发并行编辑不覆盖另一份草稿；资源清理失败时锁定草稿，保留不确定提交保护和临时 Workspace 注销重试。
- 候选已通过 79 项测试、23 个真实 Desktop 场景组及 12 组新增草稿布局检查；官方管理器安装、更新、卸载、重装及正常重启证据单独记录。正式提升仅变更版本元数据和文档。
- 已知限制：不支持 Git Graph 0.4.6 组合；800 宽 / 150% 缩放时保留宿主原生裁剪；草稿正文和附件不跨刷新或重启持久化。模型使用无密钥 fixture，未测试外部模型或宿主安装程序覆盖升级。
- 验收范围及证据见 [1.2.0 验收报告](https://github.com/NoProblUm/dsh-codexlike-projectless/blob/v1.2.0/docs/1.2.0-%E9%AA%8C%E6%94%B6%E6%8A%A5%E5%91%8A.md)。

### English

- Support Windows DSH Desktop 0.2.1-rc.3, exact build be72761ee1a6736ebcdf4f3739363b083ae53c98. Desktop rc.2 users should remain on 1.1.0.
- Follow rc.3 blank-session and Agent-preset reuse rules, preserving keep/replace/append initialization, attachments and native submission state. Drafts create no host Session, Workspace or task directory before first send.
- Preserve a second draft while another sends; lock drafts after incomplete cleanup and retain uncertain-submission protection and independent Workspace detach retry.
- Candidate verification: 79 tests, 23 real Desktop scenario groups and 12 additional draft layout checks, with manager lifecycle and same-profile plugin-update evidence recorded separately. Stable promotion changes version metadata and documentation only.
- Known limits: Git Graph 0.4.6 combinations are unsupported; native clipping remains at 800 width / 150% zoom; draft text and attachments are runtime-only. Tests use a keyless model fixture, without external-provider or Windows host-installer upgrade validation.

## 1.1.0 - 2026-10-17

### 简体中文

- 兼容 Git Graph 0.4.6 的新建入口，支持两种加载顺序、自动隔离开关和停用恢复；按操作保留初始化参数，无项目请求不进入 Git/worktree 流程。
- 侧栏“未分组”气泡优先恢复最近未发送草稿，保留正文、附件和全部编辑设置；重复鼠标/键盘激活不重复新建。全局新建仍显式打开新编辑页。
- 恢复原生项目/模式/输入布局与原版图标；独立可聚焦关闭按钮不改变控件位置，已发送页不增加项目栏。
- 保持首次发送前 Session、Workspace、任务目录零增量，以及失败保留、结果不确定禁止重发和 Workspace 注销重试。
- 更新中英文 README、安装链接及兼容边界，并保留第三方 Apache-2.0 许可与来源。
- 验证：78 项测试、类型检查与构建；最终候选完成真实 Desktop 组合、首次安装/重启、故障处理及 48 项界面对照。正式版仅更新版本和文档。
- 已知限制：800 宽 / 150% 缩放时宿主原生内容仍有裁剪；旧候选原位升级曾遇管理器 EPERM，全新安装通过不代表原位升级通过。草稿不跨刷新或重启持久化。详见 [验收报告](https://github.com/NoProblUm/dsh-codexlike-projectless/blob/v1.1.0/docs/1.1.0-%E9%AA%8C%E6%94%B6%E6%8A%A5%E5%91%8A.md)。

### English

- Compose with Git Graph 0.4.6 across both load orders, isolation settings and lifecycle changes; preserve per-operation initialization options and bypass Git for projectless requests.
- Restore the latest unsent draft from the native Ungrouped sidebar action, preserving text, attachments and editor settings. Repeated mouse/keyboard activation reuses the draft; global New remains explicit.
- Retain native layout and original icons, with an independent focusable close button and no extra project bar on sent conversations.
- Preserve zero Session/Workspace/directory creation before first send, failed input, uncertain-send protection and independent Workspace detach retry.
- Update both READMEs and retain Apache-2.0 attribution for the compatibility route.
- Validation: 78 tests, type checking and build; final-candidate Desktop combinations, fresh install/restart, failure handling and 48 native UI comparisons. Stable promotion changes version and documentation only.
- Known limits: native clipping at 800 width / 150% zoom; an earlier candidate in-place upgrade hit manager EPERM. Fresh installation does not establish successful in-place upgrades. Drafts remain runtime-only.

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
