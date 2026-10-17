# 原版 Desktop 隔离验收

这些文件是开发验收工具，不进入市场包。测试模型只在 DSH_HOME 包含 runtime-candidate 的隔离 profile 工作，通过原生 llm/stream 返回确定性结果。不要复制到日常 profile。

1. 先阅读 scripts/probe-runtime-desktop.mjs，准备其指定的原版完整应用副本（含 asar.unpacked），检查固定归档哈希。start 创建新测试目录并备份 dsh 协议关联；restart 复用此目录，stop 正常退出，restore-protocol 校验并恢复协议关联。
2. scripts/serve-runtime-packages.mjs 提供已冻结 tgz 的测试市场源；测试目录的 registry.json 声明候选来源。版本更新后不要重打同一地址下已经被 pnpm 缓存的同版本包。按市场原生安装/更新路由或官方 manager API 运行，不使用 link: 副本。
3. 用 Playwright CLI 连接测试 renderer 的 CDP 19402。运行脚本需要已安装的 Playwright，其 index.mjs 路径显式传给 runner，不固定依赖本机缓存路径：

       node scripts/run-runtime-desktop-smoke.mjs <playwright/index.mjs> plan

可选场景为 plan、switch、loss、unknown、attachments、disable。先确保已进入本地草稿；plan 打开规划，switch 在标题准备期间切换，loss 丢弃成功响应，unknown 模拟无法确认，disable 调用官方停用。故障注入在页面刷新后消失；两种故障场景应分别在干净页面执行。attachments 需要准备有效 PNG 到脚本指定路径，attachment.txt 随源码提供；文件选择使用原生 input。不要使用损坏的简短 PNG 数据冒充有效样本。

脚本在发送前通过测试主进程聚焦窗口。Desktop 的 dsh-app 自定义协议不支持 Playwright route.fetch，不能套用 Web Host 的网络拦截场景。原生 Ctrl+N 应使用 probe-runtime-desktop.mjs native-new，经 Electron before-input-event 注入；CDP keyboard.press 不能证明这条路径。Windows 没有 macOS 的文件/新建菜单，该项不适用。

诊断客户端只暴露原生状态和官方管理器操作，模型事件写入测试 home。测试结束后先正常退出，再 restore-protocol。完整事实和边界见 docs/运行时适配与验收.md。output/ 保留本地证据，不提交原版应用、账户状态、日志或 profile。
