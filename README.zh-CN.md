# dsh-codexlike-projectless

[English](README.md) | **简体中文**

为 DeepSeek Harness 提供类似 Codex 的无项目会话体验：先写消息，首次发送时再创建按日期和主题组织的工作目录。

DSH Codexlike Projectless 独立维护，采用自己的版本编号。仓库名和内部插件名均为 `dsh-codexlike-projectless`。源码来源和 MIT 许可说明见 [NOTICE](NOTICE) 与 [LICENSE](LICENSE)。本项目不是 DeepSeek 或 OpenAI 官方项目。

## 当前版本与 0.x 的区别

当前正式版为 **1.2.0**，支持 Windows DSH Desktop **0.2.1-rc.3**（构建 `be72761ee1a6736ebcdf4f3739363b083ae53c98`）。Desktop rc.2 用户继续使用 [1.1.0](https://github.com/NoProblUm/dsh-codexlike-projectless/releases/tag/v1.1.0)。

0.x 需要额外安装原生补丁；1.x 已将运行时适配层放进插件包，无需外部安装器或改写应用归档。旧补丁用户需先按原安装记录恢复原版应用，再安装新版。无项目草稿、首发按日期和主题创建目录的用法不变。

详细变更见 [CHANGELOG](CHANGELOG.md)。下方保留历史示例图，不能用于判断 1.1.0 的具体图标与布局。

独立版本编号从 `0.1.0` 开始。发布包不包含 DSH 的 `app.asar`、用户 profile 或本机备份。

1. 新建无项目会话时打开浏览器草稿，立即使用原生输入框。此时不创建真实 Session、Workspace 或工作目录。
2. 首次发送时调用 DSH 自带主题生成服务，用当前模型生成主题；服务失败时使用 DSH 原生回退主题。
3. 创建 `配置根目录/YYYY-MM-DD/主题`，重名使用 `_2`、`_3`。随后创建真实 Session，并将预生成主题与原生日志绑定。
4. 携带原生模型、Agent 预设、权限、规划模式以及附件，通过原生发送链路提交消息。
5. 接收成功后注销临时 Workspace，保留会话、目录、cwd 和历史。会话进入未分组区域。

未发送编辑页沿用原生项目按钮、Agent 模式栏、输入框及原版图标。悬停项目按钮或键盘聚焦时，文件夹图标原位显示原生关闭图标 ×；关闭动作为独立可聚焦按钮，不改变周围控件位置。点击后切换至无项目并恢复对应草稿。无项目状态不显示 ×，项目菜单提供“无项目”。已发送会话保持原生布局，不额外插入项目栏，原会话的归属、cwd 和消息不变。

无项目状态下，普通新建、快捷键、侧栏“未分组”气泡及切换至无项目，优先恢复最近符合条件的未发送草稿；没有候选时才创建本地草稿。正文、引用、附件和控制项在当前运行期间保留。指定 Agent 预设时，排除已明确列出其他预设的草稿。带初始化参数的请求由宿主按保留、替换或追加策略处理，不自动发送。

项目内普通新建委托 DSH 原生空白会话复用；项目菜单切换优先恢复插件记录的有效未发送编辑页，没有时委托原生工作区打开逻辑。默认项目选择跨重启保存，草稿正文、附件和控制项不跨刷新或重启保存。首发进行中或结果不明的草稿不参与复用。

本版不支持 Git Graph 0.4.6 组合：该插件在 rc.3 单独启用时可创建 worktree，但会丢失新建初始化正文。未知入口包装仍会被拒绝；适配层不修改宿主归档或第三方插件文件。

发送结果不确定时不重发、不删除资源，并等待原生持久会话状态确认。明确拒绝或创建失败时回收本次新建的空目录；已有文件不会删除。

## 运行截图

以下图片于 2026-10-03 在 Windows 上实际运行的 DSH Desktop 0.2.0-rc.2 隔离环境中拍摄，插件版本为改名前开发构建 0.7.0-local.5。仅加载 DSH 内置组件和本插件，使用原生界面，没有主题、宠物或增强侧栏插件。三个示例项目、六条项目内会话和一条未分组会话均为专门创建的演示数据，不含个人会话历史；它们用于展示项目归属，不代表模型执行结果。原图未修改。

### 无项目草稿与项目会话对比

侧边栏展示三个示例项目及其会话；当前编辑页为“无项目”，可以直接输入正文并选择原生模型、权限和 Agent 预设。“未分组”中的示例会话与项目内会话形成对比。

![原生界面中无项目草稿与三个示例项目的会话分组对比](docs/images/projectless-draft.png)

### 从项目切换到无项目

此历史截图展示旧版圆形 ×；1.1.0 使用宿主原生关闭图标，点击后进入无项目编辑页。图中选择了“示例项目-学习笔记”，左侧保留其他项目及未分组会话。

![项目选择框悬停时显示圆形关闭按钮](docs/images/project-clear.png)

### 设置会话目录

在通用设置中配置“工作区根目录”，浏览、保存并查看当前生效路径。图中演示根目录为 `C:\Documents\DSH`，可按需要选择自己的目录。

![无项目会话的工作区根目录设置](docs/images/root-settings.png)

## 安装与卸载

需要 Windows 和受支持的 DSH Desktop 0.2.1-rc.3 构建。1.2.0 已内置运行时适配层，无需安装 Node.js、运行外部安装器或安装原生补丁。

### 1. 从插件市场安装

1. 打开 DSH 插件市场，搜索 `dsh-codexlike-projectless`，确认版本为 1.2.0 后安装。
2. 正常退出并重新打开整个 DSH。
3. 在“设置 → 通用 → 无项目会话”中选择工作区根目录并保存。

### 2. 导入发布包

1. 下载 [dsh-codexlike-projectless-1.2.0.tgz](https://github.com/NoProblUm/dsh-codexlike-projectless/releases/download/v1.2.0/dsh-codexlike-projectless-1.2.0.tgz)。
2. 通过插件市场或官方插件管理器导入该包，然后正常退出并重新打开 DSH。
3. 在“设置 → 通用 → 无项目会话”中配置工作区根目录。

### 3. 从源码构建

开发需要 Git 和 Node.js 22.19 或更新版本：

```powershell
git clone https://github.com/NoProblUm/dsh-codexlike-projectless.git
cd dsh-codexlike-projectless
npm ci
npm run verify
npm pack --ignore-scripts
```

将生成的 `.tgz` 按上面的导入方式安装。开发与验证细节见 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 从 0.x 旧补丁安装迁移

先禁用旧插件，按旧安装记录恢复原版应用，再安装 1.2.0。如果仍使用安装器留下的本地 `link:` 副本，通过管理器移除旧副本后再安装。恢复工具可能还原备份时的其他插件配置，使用前请核对备份及后续改动。

### 更新与卸载

通过插件市场或官方插件管理器操作，更新后正常退出并重新打开 DSH。原版管理器在 HMR 下原位更新可能返回 `already-installed`；这是已知限制，详细记录见[适配说明](docs/适配-DSH-0.2.1-rc.2.md)。

停用或卸载会释放本插件的运行时改动，保留已创建的会话、目录和用户产物。请先保存尚未发送的草稿。

### 设置工作目录

在“设置 → 通用 → 无项目会话”中填写“工作区根目录”，或点击“浏览…”选择目录，再点击“保存”。界面显示当前生效路径；验证或保存失败时保持原值。设置保存在 `DSH_HOME/storages/dsh-codexlike-projectless-settings.json`，重启后继续生效，不改写其他 profile 设置。

未保存覆盖值时，根目录沿用 profile 的 `dsh-codexlike-projectless.config.root`；未配置则使用 `~/Documents/DSH`。修改只影响之后首次发送的新会话，既有会话和目录不迁移。一次首次发送固定使用开始发送时的根目录，回收也按原分配目录处理。`debug: true` 会开启诊断日志，只记录状态和路径，不记录输入正文或密钥。

## 验证和使用边界

使用原版 Desktop 提取副本、隔离 profile、官方插件管理器和无密钥模型 fixture 验收。候选通过 79 项测试、23 个 Desktop 场景组及新增 12 组草稿布局检查；同日既有证据覆盖管理器生命周期与同 profile 从 1.1.0 更新。正式版仅提升版本元数据和文档，详见 [1.2.0 验收报告](docs/1.2.0-验收报告.md)。800 宽 / 150% 缩放时宿主原生内容仍有裁剪，插件开关一致；未测试外部模型服务或宿主 Windows 安装程序覆盖升级。

`0.1.1` 的安装器集成测试覆盖首次安装、更新、配置保留和失败回滚，使用合成 ASAR 与 DSH 0.2.0-rc.2 的实际模块代码；这些测试不能代替真实 Desktop 安装与重启验收。`0.1.0` 构建检查见 [初版验证](docs/独立初版验证.md)。

历史功能验证见 [本地完整版测试](docs/本地完整版测试.md)。其中版本号、日志和截图对应改名前的开发构建，不代表 `0.1.0` 已完成安装与重启验收。草稿期支持选择模型、预设、权限、规划模式和添加附件。需要真实会话或执行目录的工具、任务与命令在首次消息创建真实会话之后使用。草稿只在运行期内存中，刷新、关闭或重启不保留正文和附件。安装或更新插件后需要正常退出并重新打开 DSH。

## 致谢

感谢 [Jarvis Luk](https://github.com/jarvisluk) 开源的原仓库 [jarvisluk/dsh-projectless-session](https://github.com/jarvisluk/dsh-projectless-session)，它是本项目的主要参考和源码基础。本项目包含从该 MIT 许可仓库衍生的代码，并在其无项目会话工作的基础上开发了上述类似 Codex 的会话流程。

Git Graph 0.4.6 兼容路由包含 Apache-2.0 许可的上游代码；来源、修改和许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

原作者的版权声明和 MIT 许可保留在 [LICENSE](LICENSE) 中，源码来源说明见 [NOTICE](NOTICE)。本仓库由 NoProblUm 独立维护。

## 发布与开发

源码与版本下载见 [GitHub Releases](https://github.com/NoProblUm/dsh-codexlike-projectless/releases)。发布流程先创建 GitHub Release，提供 `.tgz` 插件包和 `SHA256SUMS` 校验文件，再通过已配置的可信发布者将同一包发布到 npm；正式版使用 `latest` 标签。npm 发布失败时 GitHub Release 可能已经存在，重跑流程会跳过已发布版本。源码构建流程见 CONTRIBUTING.md。

开发与验证流程见 [CONTRIBUTING.md](CONTRIBUTING.md)，版本记录见 [CHANGELOG.md](CHANGELOG.md)。本机历史测试记录中的日志、截图和备份路径用于说明当时的验证范围，除上述精选运行截图外，这些运行产物不包含在公开仓库中。后续检查与优化通过本仓库的 Issues 和版本更新跟进。
