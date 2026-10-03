# Changelog / 变更日志

Independent release history for DSH Codexlike Projectless. Historical development validation is retained separately and does not define this project's versions.

本日志记录 DSH Codexlike Projectless 的独立版本；历史开发验证记录单独保留。

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
