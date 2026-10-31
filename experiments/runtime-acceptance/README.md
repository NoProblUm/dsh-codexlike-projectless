# rc.5 原版 Desktop 隔离验收

这些 fixture 和场景仅用于开发，不进入 tgz。模型只在 DSH_HOME 含 runtime-candidate 的测试 home 注册，不读取日常凭据。首次启动需明确配置 agent-default-model 为 fixture/fixture；启动器已包含该配置。

先取得并验签官方 rc.5 安装包，提取完整应用到 ../rc5-evidence-20261031/app。启动器绑定本报告的原版 app.asar SHA-256，主进程端口 19821、renderer 19822，单次只运行一个验收实例。以下命令从仓库根运行，$playwrightModule 为已安装 Playwright 的 index.mjs 绝对路径：

```powershell
node scripts/acceptance-rc5.mjs start output/runtime-candidate-rc5-example
node scripts/run-rc5-acceptance.mjs $playwrightModule inspect output/runtime-candidate-rc5-example
node scripts/run-rc5-acceptance.mjs $playwrightModule install output/runtime-candidate-rc5-example file:E:/path/to/frozen-package.tgz
node scripts/acceptance-rc5.mjs stop output/runtime-candidate-rc5-example
node scripts/acceptance-rc5.mjs restart output/runtime-candidate-rc5-example
node scripts/run-rc5-acceptance.mjs $playwrightModule source output/runtime-candidate-rc5-example experiments/runtime-acceptance/rc5-open.js
```

rc5-core.js 绑定冻结候选身份；正式包冒烟使用 rc5-stable-smoke.js。其余 rc5 场景覆盖显示、升级、控件、标题、释放等行为；experiments/rc5-scenarios 保留迁移后的附件及故障场景。它们有前置状态，不是可以任意串联的列表；例如上传重试必须紧接上传失败，unknown 和清理锁定放在各自 profile 最后。实际本轮编排、原始失败和最终结果位于 output/rc5-harness、output/rc5-desktop-20261031，测试来源在基线目录记录。

复制 profile 前必须正常停止源 Desktop。clone-acceptance-profile.mjs 创建新目录并迁移配置及 pnpm 虚拟存储路径，保留历史 cwd。升级验证使用专门保存的持久根目录，不用重写历史来冒充兼容。不要复制日常 profile 进行故障注入。

fixture:reasoning:normal|signature|split|unclosed|empty 消息产生原始 reasoning 块；fixture:title-fail 注入标题 provider 失败。思考测试先在原生设置中选择“工作步骤展示 → 完全展开”，再运行插件开关对照。没有 fixture 侧签名剥离。原生 Ctrl+N 使用启动器的 native-new，经 Electron before-input-event 注入。

runner 核对 PID、DSH_HOME、EXE 路径和实际版本/构建/dirty。单次结果使用独立时间戳文件，管理器 application=failed 视为失败。rc.3 种子测试需显式传其专用启动器作为 runner 最后一个参数，不使用 rc.5 身份断言冒充旧宿主。

结束后正常 stop，再执行 restore-protocol 并核对归档哈希。跨 rc.3/rc.5 测试按备份的协议归属顺序恢复，最终恢复第一份 profile 记录的原关联。完整 profile、原版应用和账户状态仅留本地，不进入发行包。
