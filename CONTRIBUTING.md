# Claude / GPT 协作流程

正式版本以 `main` 为准。每个任务使用一个临时分支，GPT 使用 `gpt/<task>`，Claude 使用 `claude/<task>`。

## 每次修改

1. 读取最新远程 main、AGENTS.md 和相关文件；查看现有 PR，识别重叠修改。
2. 从最新 main 创建任务分支。同一文件或数据接口有其他任务正在修改时，先协调范围。
3. 修改并进行与变更相关的验证。不要覆盖其他任务的工作。
4. 提交 PR，说明修改原因、结果、验证及限制。
5. 合并前再次检查最新 main 和其他 PR；如有变化，在任务分支解决冲突并重新验证。
6. 在用户授权范围内、检查通过后通过 PR 合并；禁止直接推送或强推 main。
7. 网站文件发生变化时确认 GitHub Pages 部署结果。完成后可删除已合并任务分支。

## 验证范围

- 页面：桌面与手机布局，以及受影响的筛选、搜索、地图功能。
- 数据：JSON 可解析、字段与现有页面兼容、餐厅标识稳定，并保留来源说明。
- PWA：检查 Service Worker 缓存和旧版本升级，不得清除用户收藏解决缓存问题。
- 仅文档修改：审阅差异与链接即可。未执行的检查应如实说明。

## main 分支保护（需在 GitHub 设置中启用）

仓库内的说明文件属于协作约定，不能代替 GitHub 强制保护。当前连接工具未提供规则写入功能。

打开 Settings → Rules → Rulesets → New branch ruleset：
- 名称：protect-main；Enforcement status：Active。
- Target branches：按名称包含 main；不设置绕过名单。
- 启用 Restrict deletions、Require a pull request before merging、Block force pushes。
- Required approvals 初始设为 0：Claude 与 GPT 可能使用同一个 GitHub 身份，作者不能批准自己的 PR。
- 如启用 Require conversation resolution before merging，合并前处理所有讨论。
- 暂不要求不存在的 status checks。配置并成功运行 CI 后，再选择实际检查名称作为必需项。

保存后核对规则已启用。上述配置尚未由本次文档提交自动启用。

## 修改页面脚本或样式时

`index.html` 里引用 `upgrade.css`、`upgrade.js`、`guide-core.js`、`search-aliases.js` 时带 `?v=版本号`。改动这些文件时，以下几处要一起加 1，否则老用户的浏览器可能用新页面配旧脚本：

- `index.html`：`ASSET_VER` 和各个 `?v=`
- `upgrade.js`：`UPGRADE_VER`
- `sw.js`：`ASSET_VER` 和 `CACHE`（`mg-v版本号`）

`tests/browser.cjs` 会检查这几处是否一致。页面启动时如果发现页面和脚本版本不一致，会跳过缓存重新下载一次，再自动刷新。

## 发布与回退

继续使用现有 GitHub Pages 发布配置。发现问题时，通过新的任务分支和回退 PR 修复，不重写 main 历史。
