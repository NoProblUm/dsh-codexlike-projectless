# dsh-noproject-codexlike

[English](README.md) | **简体中文**

为 DeepSeek Harness 提供类似 Codex 的无项目会话体验：先写消息，首次发送时再创建按日期和主题组织的工作目录。

本项目由 [jarvisluk/dsh-projectless-session](https://github.com/jarvisluk/dsh-projectless-session) 的 MIT 源码发展而来，以独立仓库维护，不是 DeepSeek 或 OpenAI 官方项目。保留上游作者署名和 MIT 许可。仓库名为 `dsh-noproject-codexlike`，内部插件名仍为 `dsh-projectless-session`。

当前版本 `0.7.0-local.5`，适配 **Windows 上的 DSH Desktop 0.2.0-rc.2**。首次独立发布保留已测试的版本号，作为预发布版本提供。这版同时包含插件和 DSH 原生接入补丁；只安装插件包不能启用完整流程。发布源码与补丁生成脚本，不分发 DSH 的 `app.asar`、用户 profile 或本机备份。

1. 新建无项目会话时打开浏览器草稿，立即使用原生输入框。此时不创建真实 Session、Workspace 或工作目录。
2. 首次发送时调用 DSH 自带主题生成服务，用当前模型生成主题；服务失败时使用 DSH 原生回退主题。
3. 创建 `配置根目录/YYYY-MM-DD/主题`，重名使用 `_2`、`_3`。随后创建真实 Session，并将预生成主题与原生日志绑定。
4. 携带原生模型、Agent 预设、权限、规划模式以及附件，通过原生发送链路提交消息。
5. 接收成功后注销临时 Workspace，保留会话、目录、cwd 和历史。会话进入未分组区域。

输入框上方的项目按钮左侧，在悬停或聚焦时显示圆形 ×。未发送的编辑页点击 × 切换至无项目并恢复对应草稿；已发送的项目会话点击 × 打开新的空白无项目编辑页，保留原会话的归属和 cwd。无项目状态不显示 ×，菜单提供“无项目”。

普通“新建会话”与快捷键沿用当前默认项目，并打开空白编辑页。打开历史会话也更新默认选择；无项目首次发送并注销临时 Workspace 后仍保留无项目身份。选择记录跨重启保留，已删除项目回退至无项目。

通过项目菜单切换时，每个项目和无项目分别恢复最近使用的未发送编辑页，保留正文、附件、模型、权限、Agent 预设和规划模式。重复选择当前项目不重建编辑页。显式新建不带入旧正文或附件；旧编辑页在运行期间仍保留。发送确认成功后清除对应待恢复草稿，失败保留，结果不确定时禁止重发。

发送结果不确定时不重发、不删除资源，并等待原生持久会话状态确认。明确拒绝或创建失败时回收本次新建的空目录；已有文件不会删除。

## 运行截图

以下图片于 2026-10-03 在 Windows 上实际运行的 DSH Desktop 0.2.0-rc.2 隔离环境中拍摄，插件版本为 0.7.0-local.5。仅加载 DSH 内置组件和本插件，使用原生界面，没有主题、宠物或增强侧栏插件。三个示例项目、六条项目内会话和一条未分组会话均为专门创建的演示数据，不含个人会话历史；它们用于展示项目归属，不代表模型执行结果。原图未修改。

### 无项目草稿与项目会话对比

侧边栏展示三个示例项目及其会话；当前编辑页为“无项目”，可以直接输入正文并选择原生模型、权限和 Agent 预设。“未分组”中的示例会话与项目内会话形成对比。

![原生界面中无项目草稿与三个示例项目的会话分组对比](docs/images/projectless-draft.png)

### 从项目切换到无项目

悬停项目按钮时显示圆形 ×，点击后进入无项目编辑页。图中选择了“示例项目-学习笔记”，左侧保留其他项目及未分组会话。

![项目选择框悬停时显示圆形关闭按钮](docs/images/project-clear.png)

### 设置会话目录

在通用设置中配置“工作区根目录”，浏览、保存并查看当前生效路径。图中演示根目录为 `C:\Documents\DSH`，可按需要选择自己的目录。

![无项目会话的工作区根目录设置](docs/images/root-settings.png)

## 安装与恢复

安装前完全退出 DSH。安装器检查原版或本地备份记录中的已安装版本，以及新补丁 SHA-256，并备份当前 archive、已安装插件以及 profile 配置。更新失败恢复本次更新前的版本。仅改动插件相关依赖和文件，保留原有工作目录设置。

需要 Node.js 22.19 或更新版本、npm，以及已安装的 DSH Desktop 0.2.0-rc.2。当前安装器用于更新已有的 `dsh-projectless-session` 插件：目标 profile 必须已有该插件目录、依赖和配置项。首次使用应先按照 DSH 的插件管理方式安装上游插件，退出 DSH 后再安装本项目的完整版本；请勿把上游插件单独安装成功当作本项目完整功能安装完成。

下载本仓库源码或克隆后，在源码目录执行：

```powershell
npm ci
npm run verify
npm pack --ignore-scripts
node scripts/prepare-native.mjs '原版备份/app.asar'
node scripts/prepare-sidebar-compat.mjs
node scripts/prepare-git-graph-compat.mjs
.\scripts\install-native.ps1
```

`prepare-native.mjs` 的第一个参数是未经修改的 DSH `app.asar` 路径；首次安装可传入实际安装位置的 `resources/app.asar`。默认安装路径为 `E:\DeepSeekHarness`，安装到其他位置时使用 `install-native.ps1 -AppDirectory '实际安装目录'`；profile 可通过 `-ProfileDirectory` 指定。

只有安装了 `dsh-better-sidebar` 或 Git Graph 0.4.4 时才运行对应的 `prepare-*-compat.mjs`。侧栏准备脚本使用当前用户的默认 desktop profile；Git Graph 脚本可接收 profile 路径。暂存补丁必须与安装器目标 profile 一致。原生补丁准备完成后，首次安装前创建空的 `native/backups` 目录（`New-Item -ItemType Directory -Force native/backups`）。安装成功后保留源码目录、插件包和备份，以便恢复。

按需准备已安装第三方插件的兼容补丁，然后执行安装：

```powershell
# 仅安装了 dsh-better-sidebar 时执行
node scripts/prepare-sidebar-compat.mjs
# 仅安装了 Git Graph 0.4.4 时执行
node scripts/prepare-git-graph-compat.mjs
.\scripts\install-native.ps1
```

原生补丁是版本限定接入，DSH 更新后需要重新适配；安装器拒绝覆盖未验证的 archive。

当前机器的增强侧栏另外有一处草稿 cwd 查询兼容判断，也纳入备份。首次安装到未修改原版时可直接运行 `node scripts/prepare-native.mjs`；已安装补丁后重新生成必须指定原版备份。安装器支持从其本地备份记录可验证的旧补丁版本更新，拒绝覆盖未知修改。

恢复原版前完全退出 DSH，然后执行：

```powershell
.\scripts\restore-native.ps1 -BackupDirectory '本次安装输出的备份目录'
```

在“设置”的通用页面中找到“无项目会话”，填写“工作区根目录”或点击“浏览…”选择目录，再点击“保存”。界面显示当前生效路径；验证或保存失败时保持原值。设置保存在 `DSH_HOME/storages/projectless-session-settings.json`，重启后继续生效，不改写其他 profile 设置。

未保存覆盖值时，根目录沿用 profile 的 `dsh-projectless-session.config.root`；未配置则使用 `~/Documents/DSH`。修改只影响之后首次发送的新会话，既有会话和目录不迁移。一次首次发送固定使用开始发送时的根目录，回收也按原分配目录处理。`debug: true` 会开启诊断日志，只记录状态和路径，不记录输入正文或密钥。

## 验证和使用边界

详见 [本地完整版测试](docs/本地完整版测试.md)。草稿期支持选择模型、预设、权限、规划模式和添加附件。需要真实会话或执行目录的工具、任务与命令在首次消息创建真实会话之后使用。草稿只在运行期内存中，刷新、关闭或重启不保留正文和附件。原生补丁更新后必须重启 DSH；插件热替换不作为本地安装验收方式。

The local full-flow build requires the supplied native bridge for DSH Desktop 0.2.0-rc.2. It retains the native composer, prepares a title before allocating a real Session, stores each conversation under `ROOT/YYYY-MM-DD/title`, and removes only the temporary Workspace registration after admission. Installation is reversible and version/hash guarded. See the Chinese validation document for evidence and limitations.

## 发布与开发

源码与版本下载见 [GitHub Releases](https://github.com/NoProblUm/dsh-noproject-codexlike/releases)。本项目的发布流程仅创建 GitHub Release，不发布到上游 npm 包。完整安装请使用源码中的原生补丁生成和安装脚本；Release 中的 `.tgz` 是插件包。

开发与验证流程见 [CONTRIBUTING.md](CONTRIBUTING.md)，版本记录见 [CHANGELOG.md](CHANGELOG.md)。本机历史测试记录中的日志、截图和备份路径用于说明当时的验证范围，除上述精选运行截图外，这些运行产物不包含在公开仓库中。后续检查与优化通过本仓库的 Issues 和版本更新跟进。
