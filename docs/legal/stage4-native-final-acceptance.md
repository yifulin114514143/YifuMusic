# 阶段 4 原生人工验收记录

## 历史原生人工验收环境

- 准备日期：2026-07-31 05:06:50 CST
- DMG SHA-256：`03c3ac718230063ead64823e598275f16790f20987e7b92a2f250c7bb6107a82`
- DMG 绝对路径：`/Users/mico/AI 事物/Yifumusic(codex 内项目)/src-tauri/target/release/bundle/dmg/YifuMusic_0.23.4_aarch64.dmg`
- 实际挂载卷路径：`/Volumes/YifuMusic`
- 直接调用的应用二进制路径：`/Volumes/YifuMusic/YifuMusic.app/Contents/MacOS/yifumusic`
- macOS 版本：`26.6`
- 窗口尺寸：未验收
- 隔离 HOME：`/Users/mico/AI 事物/yifumusic-stage4-lyrics-retest-20260731-050329/home`
- 隔离配置目录：`/Users/mico/AI 事物/yifumusic-stage4-lyrics-retest-20260731-050329/home/Library/Application Support/yifumusic`
- 原始配置目录：`/Users/mico/Library/Application Support/yifumusic`
- 原始配置目录启动前 mtime：`1785401434`
- 原始配置目录启动后 mtime：`1785401434`
- 测试媒体类型：未验收
- 原始配置目录写入确认：未写入，启动前后 mtime 相同。

## 构建关联说明与唯一当前候选

- 本文中已有的人工观察和失败记录只对应上列历史 DMG（SHA-256 `03c3ac718230063ead64823e598275f16790f20987e7b92a2f250c7bb6107a82`），不得将其改写为当前构建的验收结论。
- 历史构建：同一路径此前的 DMG 文件时间为 2026-07-31 20:39:31 CST，大小为 9,060,050 bytes，SHA-256 为 `814e0c6dc935b5fdc7fdc73fe5dc400ac0967867b6918b4c9ef515a698a27bb8`；当时 `hdiutil verify` 已通过。它不是当前候选。
- 唯一当前候选（待原生人工验收）：`/Users/mico/AI 事物/Yifumusic(codex 内项目)/src-tauri/target/release/bundle/dmg/YifuMusic_0.23.4_aarch64.dmg`。
  - 构建命令：`vp run tauri build`，退出码 0。
  - 构建/文件修改时间（`stat` 原始观测）：2026-08-01 02:01:07 CST。该时间相对于当前环境日期 2026-07-31 为未来值，按原始观测保留；不得作为人工验收日期或验收结论。
  - 文件大小：9,070,739 bytes。
  - SHA-256：`ea0bb33e87c90b877c60c70c31e2c81d0333f308000a8d2919c376d614a893b0`。
  - `hdiutil verify`：退出码 0。
  - Git：分支 `feat/yifumusic-ui`，HEAD `222751c5 feat: 重构 YifuMusic 信息架构与视觉系统`。
  - 两轮稳定验证：每轮的 `vp test --run`、`vp check`、`cargo test`、`cargo clippy`、`vp run gen:translations`、`vp build` 和 `git diff --check` 均为退出码 0；两轮 `zh-CN Missing = 0`。
- 当前候选尚未启动、挂载或进行原生人工验收。因此自动化测试、DMG 完整性校验和构建成功都不能证明 A--M 任一项已在当前候选通过。

## 自动化验证记录

### 唯一当前候选的两轮稳定验证

| 轮次    | 命令                      | 退出码 | 关键统计与 warning                                                               |
| ------- | ------------------------- | ------ | -------------------------------------------------------------------------------- |
| 第 1 轮 | `vp test --run`           | 0      | 33 个测试文件、159 个测试通过；warning 0。                                       |
| 第 1 轮 | `vp check`                | 0      | 0 error、3 条 warning。                                                          |
| 第 1 轮 | `cargo test`              | 0      | 39/39；`block v0.1.6` future-incompatibility 依赖提示 1 条。                     |
| 第 1 轮 | `cargo clippy`            | 0      | 21 条 `yifumusic` warning；另有 `block v0.1.6` future-incompatibility 依赖提示。 |
| 第 1 轮 | `vp run gen:translations` | 0      | `zh-CN Missing = 0`；warning 0。                                                 |
| 第 1 轮 | `vp build`                | 0      | 1 条 `@stylexjs/unplugin` plugin-timings warning。                               |
| 第 1 轮 | `git diff --check`        | 0      | warning 0。                                                                      |
| 第 2 轮 | `vp test --run`           | 0      | 33 个测试文件、159 个测试通过；warning 0。                                       |
| 第 2 轮 | `vp check`                | 0      | 0 error、3 条 warning。                                                          |
| 第 2 轮 | `cargo test`              | 0      | 39/39；`block v0.1.6` future-incompatibility 依赖提示 1 条。                     |
| 第 2 轮 | `cargo clippy`            | 0      | 21 条 `yifumusic` warning；另有 `block v0.1.6` future-incompatibility 依赖提示。 |
| 第 2 轮 | `vp run gen:translations` | 0      | `zh-CN Missing = 0`；warning 0。                                                 |
| 第 2 轮 | `vp build`                | 0      | 1 条 `@stylexjs/unplugin` plugin-timings warning。                               |
| 第 2 轮 | `git diff --check`        | 0      | warning 0。                                                                      |

- `vp test --run`：退出码 0，32 个测试文件、145 个测试通过。覆盖浏览器与单元测试；其中本地音乐页覆盖加载时的详情头/曲目行骨架屏、粘性详情头、最近文件夹十项上限与非破坏性移除、目录切换扫描、批量选择/入队、排序方向、网格与 700px 操作。
- `vp check`：通过，0 错误、3 条已有警告；该检查不构成原生人工验收。
- `cargo test`：通过，39/39。
- `cargo clippy`：退出成功，保留 21 条既有警告。
- `vp run gen:translations`：退出码 0，成功完成目录提取；统计中 `zh-CN` 仍有 53 条缺译，不能据此宣称全部中文翻译已人工验收。
- 2026-07-31 UI 总复核补充：`vp run gen:translations` 已再次以退出码 0 完成，当前目录统计 `zh-CN Missing = 0`。这只证明翻译目录完整性，不构成原生人工验收，也不改写上条历史记录。
- `vp run tauri build`：退出码 0，生成上列最新 DMG；构建成功不构成 A--M 任一项原生人工验收。
- 原生隔离限制：任务期内曾尝试使用独立 `HOME` 启动只读挂载的 DMG，但 macOS 配置路径仍解析到 `/Users/mico/Library/Application Support/yifumusic`。为避免修改用户日常配置和曲库，已立即关闭该实例并卸载 DMG；这次尝试不构成原生验收，也不能用于判断默认语言是否通过。
- 以上自动化结果、构建成功、DMG 完整性校验或浏览器截图均不能替代本文件 A--M 的 macOS 原生人工验收。

## 启动状态

DMG 二进制已使用隔离 HOME 直接调用，并从持久后台会话启动后保持独立运行。唯一实例为 `/Volumes/YifuMusic/YifuMusic.app/Contents/MacOS/yifumusic`；未发现 `/Applications/YifuMusic.app`、`target/debug/yifumusic` 或第二个 DMG 实例。启动日志位于 `/Users/mico/AI 事物/yifumusic-stage4-lyrics-retest-20260731-050329/yifumusic-tmux-launch.log`，已记录 `Main window built` 和 `UI is ready!`。除 D 项已有的隔离 DMG 人工验收记录外，本次未执行其他人工功能重测；以下标为“未验收”的项目均未验收。

## 验收项

### A. 全新配置目录首次默认简体中文

- 测试媒体类型：不适用
- 操作步骤：在唯一当前候选 DMG 的全新隔离 HOME 中首次启动，检查侧边导航、首页、发现、音乐库、设置分类与子页、播放器、队列及常用控件文本。
- 观察结果：默认界面为简体中文，未见默认英文 UI；当前候选在隔离配置目录中运行，未写入真实用户配置。
- 状态：通过
- 截图或日志证据位置：人工验收，未保存截图；当前候选 SHA-256 `ea0bb33e87c90b877c60c70c31e2c81d0333f308000a8d2919c376d614a893b0`

### B. MP3：播放、底栏、沉浸页、seek、自然结束

- 测试媒体类型：MP3
- 操作步骤：在唯一当前候选 DMG 的隔离配置中扫描验收音频目录，播放本地 MP3，验证底栏、沉浸播放页、seek 和自然结束。
- 观察结果：播放、底栏状态、沉浸播放页、进度跳转和自然结束均正常。
- 状态：通过
- 截图或日志证据位置：人工验收，未保存截图；当前候选 SHA-256 `ea0bb33e87c90b877c60c70c31e2c81d0333f308000a8d2919c376d614a893b0`

### C. FLAC：播放、底栏、沉浸页、真实时长、seek、自然结束

- 测试媒体类型：FLAC
- 操作步骤：在唯一当前候选 DMG 的隔离配置中扫描验收音频目录，播放本地 FLAC，验证真实时长、底栏、沉浸播放页、seek 和自然结束。
- 观察结果：播放、真实时长、底栏状态、沉浸播放页、进度跳转和自然结束均正常。
- 状态：通过
- 截图或日志证据位置：人工验收，未保存截图；当前候选 SHA-256 `ea0bb33e87c90b877c60c70c31e2c81d0333f308000a8d2919c376d614a893b0`

### D. 同名 .lrc：当前行高亮、seek 同步、自动滚动

- 测试媒体类型：`演员 - 薛之谦[绅士] (1).flac` 与同目录 `演员 - 薛之谦[绅士] (1).lrc`
- 操作步骤：在唯一当前候选 DMG 的隔离配置中扫描验收音频目录，播放该 FLAC 并打开完整播放页；播放至约 `00:03`，再 seek 至约 `00:06`；手动滚动歌词区后使用“回到当前行”。
- 观察结果：同名 `.lrc` 自动读取；当前行随播放时间高亮；seek 后立即切换到对应歌词；手动滚动后可回到当前行；播放未中断。
- 状态：通过
- 截图或日志证据位置：人工验收，未保存截图；当前候选 SHA-256 `ea0bb33e87c90b877c60c70c31e2c81d0333f308000a8d2919c376d614a893b0`

### E. 手动选择 .lrc/.txt：显示、切歌隔离、取消、错误降级

- 测试媒体类型：`.lrc`、`.txt` 与音频
- 操作步骤：在唯一隔离 DMG 实例中点击“选择歌词文件”。
- 观察结果：两轮实现均未能完成真实选择流程。修复前 `blocking_pick_file()` 导致忙碌圈且未显示选择器；改用 `pick_file` 回调与 oneshot 后，macOS 日志确认已启动 `openAndSavePanelService` 和 `beginServicePanel`，但服务连接在约两秒后取消，前端未收到选择/取消回调，界面仍无法继续。
- 状态：失败，作为已知原生缺陷暂缓修复；不阻塞后续 MoeKoeMusic 全量复刻，但仍阻塞阶段 4 最终验收、提交、推送和合并
- 截图或日志证据位置：macOS unified log，隔离 DMG 进程 PID `48364`
- 当前构建状态：最新 DMG 尚未对该原生面板回调重新验收；不得声称手动歌词已完成。该失败记录继续有效，并继续阻塞阶段 4 最终验收、提交、推送和合并。

### F. 无歌词、损坏歌词、纯文本歌词：不影响播放

- 测试媒体类型：无歌词、损坏歌词、纯文本歌词与音频
- 操作步骤：在当前候选隔离 DMG 中播放 `Cloudkicker - Let Yourself Be Huge.flac`，不走手选歌词。
- 观察结果：沉浸播放页显示“暂无歌词”，播放持续。测试目录没有 `.txt`；损坏/时间 `.lrc` 没有与音频同名，未能验证自动关联；未触发已知手选歌词回调缺陷。
- 状态：部分通过；损坏歌词与纯文本歌词自动关联待验收。
- 截图或日志证据位置：人工验收，未保存截图；当前候选 SHA-256 `ea0bb33e87c90b877c60c70c31e2c81d0333f308000a8d2919c376d614a893b0`

### G. 队列：鼠标与键盘拖动、删除、清空确认、播放游标、持续播放

- 测试媒体类型：至少两首音频
- 操作步骤：在当前候选隔离 DMG 中测试删除、清空确认、鼠标拖动与排序控件的键盘操作。
- 观察结果：删除、清空确认均通过，清空后当前播放继续。排序控件按 Space 仍触发全局播放/暂停；两次鼠标拖动均落回原项，顺序未改变，未观察到成功排序。
- 状态：失败；键盘和鼠标排序回归阻塞阶段 4 最终验收、提交、推送和合并。
- 截图或日志证据位置：人工验收，未保存截图；当前候选 SHA-256 `ea0bb33e87c90b877c60c70c31e2c81d0333f308000a8d2919c376d614a893b0`

### H. 歌单：创建、重命名、加入曲目、排序、清空、删除、导出、重启持久化

- 测试媒体类型：至少两首音频
- 操作步骤：在当前候选隔离 DMG 中创建并重命名“阶段4原生复查歌单”，加入一首本地歌曲，导出后重启隔离实例确认持久化。
- 观察结果：创建、重命名、加入歌曲和重启后持久化均正常；导出文件成功写入隔离验收目录。
- 状态：通过
- 截图或日志证据位置：`/Users/mico/AI 事物/yifumusic-stage4-final-persistent-20260801-022613/stage4-native-review.m3u`

### I. 沉浸播放页：打开、关闭、Escape、返回原页面、播放不中断

- 测试媒体类型：MP3 或 FLAC
- 操作步骤：在当前候选隔离 DMG 中打开沉浸页，按 Escape 返回；再次打开后使用关闭操作退出。
- 观察结果：播放从 `00:46` 连续至 `01:23`；Escape 返回和关闭沉浸页均未中断播放。
- 状态：通过
- 截图或日志证据位置：人工验收，未保存截图；当前候选 SHA-256 `ea0bb33e87c90b877c60c70c31e2c81d0333f308000a8d2919c376d614a893b0`

### J. 桌面歌词独立窗口：打开、关闭、拖动、置顶、锁定、鼠标穿透、播放控制

- 测试媒体类型：带歌词的音频
- 操作步骤：待人工执行：依次操作独立窗口的可见性、位置、置顶、锁定、穿透和播放控制。
- 观察结果：点击“打开桌面歌词”后，GUI 通道返回 `noWindowsAvailable`；主进程仍在，但无法观察子窗口及其拖动、原生缩放、锁定、鼠标穿透和控制。随后已重启隔离实例恢复主窗口。
- 状态：未验证；需要可访问的 macOS 桌面歌词子窗口环境。
- 截图或日志证据位置：无

### 本地音乐页：扫描、播放全部与窄窗口操作

- 测试媒体类型：本地验收音频目录中的实际音频文件
- 操作步骤：在最新 DMG 中打开“本地音乐”，选择 `/Users/mico/AI 事物/YifuMusic-人工验收音频`，完成扫描后点击“播放全部”，并将应用窗口缩小至约 `700px`。
- 观察结果：本地目录选择与扫描正常；扫描后的真实曲目可见；“播放全部”正常进入底部播放器；约 `700px` 宽度下页面工具栏、搜索、列表/网格入口仍可操作且未发生阻塞。
- 状态：通过（功能性）。视觉细节仍需继续按 MoeKoeMusic 参考逐项打磨，不据此宣告页面 UI 全量复刻完成。
- 截图或日志证据位置：人工验收，未保存截图

### 本地音乐页：详情头、历史、批量与列表字段

- 测试媒体类型：不适用（当前仅完成浏览器自动化验证）。
- 已自动验证：详情头随 AppShell 滚动容器收缩和恢复；最近文件夹最多保留十项；移除单条最近记录不会改动 `library_folders`；切换已记录的资料库文件夹会重新扫描；列表与网格中的批量选择、批量入队、排序方向及 700px 操作可用。
- 文件大小边界：当前 bridge 没有安全文件大小数据，列表显示“暂无本地文件信息”，没有伪造值。
- 原生操作步骤：待人工执行：从新 DMG 打开“本地音乐”，选择真实本地目录后依次检查粘性收缩、最近文件夹的移除与切换、列表和网格批量选择、排序、文件大小占位以及 700px 宽度。
- 观察结果：当前 DMG 未针对上述新增交互重新执行人工验收。
- 状态：未验收。浏览器自动化通过不改变该状态。
- 截图或日志证据位置：无。

### K. 实体媒体键：MP3/FLAC 的播放暂停、上一首、下一首；Apple Music 不被唤醒

- 测试媒体类型：MP3 与 FLAC
- 操作步骤：待人工执行：使用实体媒体键操作播放器，并观察 Apple Music 行为。
- 观察结果：当前 GUI 工具只能发送目标应用按键，不能模拟实体媒体键，也不能据此确认 Apple Music 是否被唤醒。
- 状态：未验证；需要真实实体媒体键操作。
- 截图或日志证据位置：无

### L. 窗口响应式：1440px、1024px、700px

- 测试媒体类型：不适用
- 操作步骤：待人工执行：分别在 1440px、1024px、700px 宽度检查布局与可操作性。
- 观察结果：当前 GUI 工具不能将原生窗口精确设置为三个验收宽度，也不能读取精确窗口尺寸。
- 状态：未验证；需要真实 macOS 窗口调整。
- 截图或日志证据位置：无

### M. 中文首启、中文 tooltip、中文 aria-label、长标题和所有控件可达

- 测试媒体类型：不适用
- 操作步骤：待人工执行：检查首启语言、悬浮提示、无障碍名称、长标题和键盘可达性。
- 观察结果：AX 树暴露中文 `Help` 文本；长标题在队列视觉上截断，AX 名称保留完整文本；Tab 焦点从“刷新页面”移动到“首页”。未能通过悬停确认 tooltip 的视觉呈现。
- 状态：部分通过；tooltip 悬停视觉和完整键盘可达性待验收。
- 截图或日志证据位置：人工验收与 AX 观察，未保存截图；当前候选 SHA-256 `ea0bb33e87c90b877c60c70c31e2c81d0333f308000a8d2919c376d614a893b0`

## 2026-08-01：G 修复后唯一新 DMG 最终复查

### 自动化与构建

- `vp test --run`：33 个测试文件、160 个测试通过，退出码 0；取得完整汇总。
- `vp check`：退出码 0；保留 3 条既有 warning。
- `cargo test`：39/39，退出码 0。
- `cargo clippy`：退出码 0；保留 21 条既有 warning。
- `vp run gen:translations`：退出码 0；`zh-CN Missing = 0`。
- `vp build`：退出码 0；保留 1 条 StyleX plugin timing warning。
- `git diff --check`：退出码 0。
- `vp run tauri build`：退出码 0。

### 唯一新 DMG 与隔离启动

- DMG：`/Users/mico/AI 事物/Yifumusic(codex 内项目)/src-tauri/target/release/bundle/dmg/YifuMusic_0.23.4_aarch64.dmg`
- 文件大小：`9,072,066 bytes`。
- `stat` 原始时间：`2026-08-01 15:44:13 CST`；该文件时间不作为人工验收日期。
- SHA-256：`15cc1d4450ce6e1012a8a787686d3a559c1922618cad0b52343e8225fe3dff06`。
- `hdiutil verify`：退出码 0，checksum `VALID`。
- 隔离 HOME：`/Users/mico/AI 事物/yifumusic-stage4-final-all-20260801-154516/home`。
- 隔离配置目录：`/Users/mico/AI 事物/yifumusic-stage4-final-all-20260801-154516/home/Library/Application Support/yifumusic`。
- 实际挂载卷：`/Volumes/YifuMusic`；直接二进制：`/Volumes/YifuMusic/YifuMusic.app/Contents/MacOS/yifumusic`。
- 启动日志：`/Users/mico/AI 事物/yifumusic-stage4-final-all-20260801-154516/yifumusic-launch.log`；包含 `Main window built` 和 `UI is ready!`。
- 持久会话：`yifumusic-stage4-final-all-1785570316`；复查时 DMG 二进制 PID 为 `92230`。
- 启动前后真实用户配置 mtime 均为 `1785471579`；隔离配置目录已创建，未写入真实用户配置。

### 本轮原生观察

- F：播放 `Cloudkicker - Let Yourself Be Huge.flac` 并打开沉浸页，真实显示“暂无歌词”；进度从 `03:14` 继续到 `03:27`，未归零。损坏 `.lrc` 与纯文本 `.txt` 的自动关联本轮未建立临时副本验证，因此 F 仍为部分通过。
- G 键盘：扫描 `/Users/mico/AI 事物/YifuMusic-人工验收音频` 后得到 5 首曲目。当前播放 `2-0300 Duhan Winterreise Gute` 时，第二首后续曲目“演员 - 薛之谦[绅士] (1).flac”的“重新排序”控件执行 `space`、`Down`、`space`；后续顺序从“Let yourself be huge、演员、志明与春娇、红尘客栈”变为“Let yourself be huge、志明与春娇、演员、红尘客栈”。播放按钮保持“暂停”，播放进度持续推进，当前曲目未跳转。
- G 鼠标：使用当前队列截图定位“重新排序”控件并多次拖动；工具返回“Draggable item 3 was dropped over droppable area 3”，列表顺序落回原项，未能证实鼠标排序真实改变。按最终指令，不能将 G 记为完整通过。
- G 删除与清空：删除后队列从 5 首变为 4 首，当前播放未中断；点击“清空播放队列”先出现“清空播放队列？这将移除所有后续音轨，当前音轨会保留。”确认对话框，确认后后续区域显示“播放队列为空”，当前曲目仍显示“暂停”并继续推进。
- I：沉浸页打开、Escape 返回均在本轮实际操作；播放从 `03:14` 推进到 `03:27`，未中断。历史 H/I 通过结论保留，未发现本轮回归。
- J：点击“打开桌面歌词”后 Computer Use 返回 `noWindowsAvailable`；无法读取独立子窗口，拖动、缩放、置顶、锁定、鼠标穿透和子窗口控制均未验证。
- K：未将普通目标应用按键当作实体媒体键证据；系统媒体键和 Apple Music 行为未验证。
- L：未能通过 GUI 工具可靠设置并读取原生窗口的 1440px、1024px、700px 精确宽度，保持未验证。
- M：AX 树观察到中文 `Help`/控件名称；队列长标题视觉上截断而 AX 名称保留完整文本。未能以悬停看到真实 tooltip，也未完成完整 Tab 可达性复查，保持部分通过。
- E：手动 `.lrc/.txt` 选择 callback 已知缺陷原样保留，本轮没有修改或重判。

### 本轮结论

G 的键盘排序、删除、清空确认和播放持续已在唯一新 DMG 中观察到；鼠标排序未能证实，F 仍缺损坏歌词/纯文本自动关联证据，J/K/L/M 仍需用户或可访问的 macOS 原生环境复查，E 继续阻塞阶段 4 最终收尾。

## 2026-08-01：最终剩余阻塞项复测

### 代码与自动化

- E：`src-tauri/src/plugins/lyrics.rs` 的异步文件选择器现将 `main` WebviewWindow 作为 macOS sheet parent，并以 120 秒超时和 callback sender 断开降级为 `failed`；未使用 `blocking_pick_file`，前端仍不接收绝对路径。Rust 定向测试为 15/15。
- G：`src/components/QueueList.test-e2e.tsx` 新增 Chromium CDP 的真实鼠标按下、移动、释放序列，覆盖 dnd-kit `PointerSensor`；队列的键盘、鼠标、重复 track ID 三项自动化均通过。
- 本轮门禁：`vp test --run`、`vp check`、`cargo test`（42/42）、`cargo clippy`、`vp run gen:translations`（`zh-CN Missing = 0`）、`vp build`、`git diff --check` 均退出码 0。`vp check` 保留 3 条既有 warning，Clippy 保留既有 warning。

### 当前 DMG 与隔离启动

- DMG：`/Users/mico/AI 事物/Yifumusic(codex 内项目)/src-tauri/target/release/bundle/dmg/YifuMusic_0.23.4_aarch64.dmg`。
- 文件大小：`9,072,942 bytes`；修改时间：`2026-08-01 17:15:06 CST`；SHA-256：`f4bffcc4b5bbf1f197203a2847468e410ead5c087cea8ad62e245c8ac2dec6fb`；`hdiutil verify` 退出码 0、checksum `VALID`。
- 隔离 HOME：`/Users/mico/AI 事物/yifumusic-stage4-close-20260801-171557/home`；挂载卷：`/Users/mico/AI 事物/yifumusic-stage4-close-20260801-171557/mount`；tmux：`yifumusic-stage4-close-20260801-171557-r3`；从挂载卷内 `YifuMusic.app/Contents/MacOS/yifumusic` 启动的 PID：`4675`。
- 隔离配置 `home/Library/Application Support/yifumusic/config.toml` mtime：`1785575836`；未写入真实用户配置。

### 原生结果与边界

- E：本轮已实际看到原生文件夹选择器，但没有安全且稳定地完成播放曲目准备和 `.lrc/.txt` 文件选择成功、取消、错误三条路径；E 保持未验证，不能据代码或单元测试写为通过。
- F：已在隔离目录建立损坏 `.lrc` 与纯文本 `.txt` 及音频副本，但原生文件夹选择器未能稳定选中精确 `media` 子目录；未扫描，F 的损坏/纯文本关联保持未验证。
- G：本轮新 DMG 只启动并确认了隔离首启界面，未建立播放队列，故没有新的鼠标与键盘原生顺序证据；历史 G 键盘结论不外推，G 完整原生复验保持未完成。
- J/K/L/M：未获得桌面歌词子窗口、实体媒体键/Apple Music、三档原生精确尺寸、tooltip 视觉和完整 Tab 的可靠新观察，均保持此前未验证或部分通过状态。

### 结论

本轮新包和自动化均有效，但原生 E、F、G 与 J/K/L/M 的必要证据尚未齐全；阶段 4 仍未收尾。

## 2026-08-01：f4bffcc4 DMG 最终原生证据收口

### DMG 与隔离环境

- DMG：`/Users/mico/AI 事物/Yifumusic(codex 内项目)/src-tauri/target/release/bundle/dmg/YifuMusic_0.23.4_aarch64.dmg`；大小 `9,072,942 bytes`；SHA-256 `f4bffcc4b5bbf1f197203a2847468e410ead5c087cea8ad62e245c8ac2dec6fb`；`hdiutil verify` 退出码 0、checksum `VALID`。
- 隔离根目录：`/Users/mico/AI 事物/yifumusic-stage4-final-evidence-20260801-173821`；HOME：`/Users/mico/AI 事物/yifumusic-stage4-final-evidence-20260801-173821/home`；隔离配置目录：`home/Library/Application Support/yifumusic`。
- 挂载卷：`/Volumes/YifuMusic`；直接运行二进制：`/Volumes/YifuMusic/YifuMusic.app/Contents/MacOS/yifumusic`；PID `5954`；tmux session `yifumusic-stage4-evidence-1785577101`；日志：`/Users/mico/AI 事物/yifumusic-stage4-final-evidence-20260801-173821/yifumusic-launch.log`。
- 启动日志包含 `Main window built` 与 `UI is ready!`。两次间隔六秒的检查均确认该二进制进程数量为 1、tmux session 存在、隔离配置目录存在。真实用户配置 mtime 启动前后均为 `1785471579`；隔离配置 mtime 为 `1785577101`。

### E. 手动歌词选择三路径

- 选择器可见：点击“选择歌词文件”后，macOS 原生 `Open` sheet 出现。
- 有效路径：选择 `/Users/mico/AI 事物/YifuMusic-人工验收音频/刚刚好.lrc` 后，播放页显示三句时间歌词“原生验收第一句/第二句/第三句”，播放按钮保持“暂停”。
- 取消路径：再次打开选择器并点击“取消”后立即回到播放页；已有歌词仍保留，播放按钮保持“暂停”，队列未被清空。
- 失败路径：选择隔离临时媒体 `/Users/mico/AI 事物/yifumusic-stage4-final-evidence-20260801-173821/media/sample-a.lrc` 后立即回到播放页，显示中文“无法读取歌词”；播放按钮保持“暂停”，进度从 `01:13` 继续至 `01:52`。
- 状态：通过。三条路径均为本轮当前 DMG 的原生观察。

### F. 损坏 LRC 与纯文本 TXT 自动关联

- 临时目录：`/Users/mico/AI 事物/yifumusic-stage4-final-evidence-20260801-173821/media`，包含同名 `sample-a.mp3`/`sample-a.lrc` 与 `sample-b.mp3`/`sample-b.txt`；原始验收目录未修改。
- 扫描：通过原生文件夹选择器扫描原始验收目录和该临时目录，音乐库显示 `7 首音轨 / 25:18`。
- 损坏 LRC：播放 `sample-a.mp3` 的沉浸页显示“无法读取歌词”，播放按钮为“暂停”，进度从 `01:40` 继续至 `01:50`。
- 纯文本 TXT：播放 `sample-b.mp3` 的沉浸页显示“暂无歌词”，播放按钮为“暂停”，进度从 `00:00` 继续至 `00:08`。未显示文本歌词，也未显示明确的中文无时间轴说明。
- 状态：部分通过；损坏 LRC 的降级和播放持续通过，纯文本 TXT 的验收要求未满足。

### G. 队列删除、清空与排序

- 重建队列：从音乐库“播放全部本地歌曲”建立 7 首队列，当前曲目为 `2-0300 Duhan Winterreise Gute`，有 6 首后续音轨。
- 键盘排序：在“重新排序 Let yourself be huge”上执行 Space、Down、Space；AX 只报告“Draggable item 1 was dropped over droppable area 1”，后续顺序仍为 `Let yourself be huge、演员 - 薛之谦[绅士] (1).flac、志明与春娇.MP3. - Sec0nd[From me].mp3、红尘客栈、sample-b.mp3、sample-a.mp3`，未观察到真实顺序变化。播放按钮保持“暂停”，进度继续。
- 鼠标排序：从同一控件拖动到第二项位置；AX 报告“Picked up draggable item 1”，释放后顺序仍未改变，不能作为鼠标排序成功证据。
- 删除：移除 `Let yourself be huge` 后，队列从 7 首变为 6 首，当前曲目仍为播放中，按钮保持“暂停”。
- 清空确认：点击“清空播放队列”出现“清空播放队列？这将移除所有后续音轨，当前音轨会保留。”；确认清空后队列显示 `1 首音轨` 与“播放队列为空”，当前曲目仍为播放中，进度从 `01:14` 继续至 `01:51`。
- 状态：失败；删除、清空确认与播放持续通过，但键盘和鼠标排序均未获得真实顺序变化，且本轮没有重复 `track.id` 曲目实例的原生拖动证据。

### J. 桌面歌词独立窗口

- 点击“打开桌面歌词”后，Computer Use 返回 `Computer Use server error -10005: noWindowsAvailable`。
- 状态：未验证；没有推断独立窗口的拖动、缩放、置顶、锁定、鼠标穿透、播放控制、关闭或重开结果。

### K. 实体媒体键与 Apple Music

- 当前工具只能向目标应用发送普通按键，不能可靠注入实体媒体键事件，也不能读取 Apple Music 是否被唤醒。
- 状态：未验证；普通目标应用按键没有作为媒体键证据。

### L. 1440px、1024px、700px 原生窗口

- 当前工具无法可靠将原生主窗口精确设为并读回 `1440px`、`1024px`、`700px` 内容宽度。
- 状态：未验证；未以 Browser Mode 或非精确观察替代原生尺寸验收。

### M. 中文、tooltip、长标题与 Tab

- 原生 AX 树显示简体中文界面文本及中文控件名/`Help`，例如“打开桌面歌词”“播放队列，7 首音轨”“从播放队列移除”。
- 队列中长标题 `志明与春娇.MP3. - Sec0nd[From me].mp3` 视觉上截断，AX 树保留完整名称。
- 未通过悬停观察到真实中文 tooltip 视觉提示；未完成主要导航、搜索、播放、队列、关闭与确认控件的完整 Tab 路径，也未能在桌面歌词触发后继续读取窗口。
- 状态：部分通过。

### 本轮结论

E 已完成三路径原生证据；F 的纯文本 TXT、G 的键盘/鼠标真实排序与重复 `track.id` 拖动、J/K/L/M 的剩余原生观察仍未齐全。阶段 4 仍未收尾。

## 2026-08-01：TXT 自动关联与 G 排序最终复验

### 门禁与 DMG

- 范围内变更：`src-tauri/src/plugins/lyrics.rs` 同名歌词查找按 `.lrc`、`.txt` 顺序读取；`src/components/QueueList.tsx` 按启动事件区分键盘与指针碰撞检测；`src/components/QueueListItem.tsx` 保留独立队列索引和拖拽手柄触控约束。
- `vp check`、`cargo test`（47/47）、`cargo clippy`、`vp run gen:translations`（`zh-CN Missing = 0`）、`vp build`、`git diff --check` 均退出码 0。`QueueList.test-e2e.tsx` 为 3/3 通过；此前已按测试文件和 `now-playing` 名称分组完成全部前端测试。整包 `vp test --run` 本轮再次在输出汇总前被宿主回收，不能将该单条命令写为通过。
- DMG：`/Users/mico/AI 事物/Yifumusic(codex 内项目)/src-tauri/target/release/bundle/dmg/YifuMusic_0.23.4_aarch64.dmg`；大小 `9,072,765 bytes`；修改时间 `2026-08-01 19:04:13 CST`；SHA-256 `d55651b627e9881b82cc868e0800d6a969f91910cee0331d928be359e719106f`；`hdiutil verify` 退出码 0、checksum `VALID`。
- 隔离 HOME：`/Users/mico/AI 事物/yifumusic-stage4-final-fix-retest.koSjFX/home`；实际二进制：`/Volumes/YifuMusic/YifuMusic.app/Contents/MacOS/yifumusic`；PID `13513`；tmux `yifumusic-stage4-fix-retest-1785582295`；启动日志包含 `Main window built` 与 `UI is ready!`。

### F 与 G 原生观察

- F 纯文本 TXT：扫描隔离媒体后播放 `sample-b.mp3`，沉浸页显示“这是没有时间轴的纯文本歌词。”与“第二行歌词仍应可读。”；歌词设置中“纯文本歌词无法定位当前行，单行模式不可用”为禁用态。通过。
- F 损坏 LRC：播放同名 `sample-a.mp3` 时沉浸页显示“无法读取歌词”，播放按钮保持“暂停”，进度由 00:00 推进至 00:10。通过。
- G 键盘：在 5 首队列中，第一首后续曲目“Let yourself be huge”执行 Space、Down、Space 后，后续顺序由“Let yourself be huge、演员、志明与春娇、红尘客栈”变为“演员、Let yourself be huge、志明与春娇、红尘客栈”；AX 状态为“Draggable item 1 was dropped over droppable area 2”，播放进度由 00:15 推进至 00:24。通过。
- G 鼠标：在同一新 DMG 中，以拖拽手柄拖向目标行两次；AX 均为“Draggable item 1 was dropped over droppable area 1”，顺序没有改变。按本轮仅允许的一次根因修复限制，停止进一步修改。鼠标排序未通过；删除、清空确认与播放持续沿用此前原生观察，重复 `track.id` 实例未能在真实队列中建立，未验证。

### 结论

同名 TXT 自动关联、损坏 LRC 降级和 G 键盘排序已获得当前 DMG 的原生证据。G 鼠标排序仍未通过，故阶段 4 不能收尾；J/K/L/M 未作循环修改或重判。

## 2026-08-01：G 鼠标排序最终修复与新 DMG 原生复验

### 根因、修复与门禁

- **根因**：`src/components/QueueList.tsx` 原有指针碰撞策略允许 `pointerWithin` 返回 active 自身，因此原生 AX 连续显示“Draggable item 1 was dropped over droppable area 1”。
- **修复**：指针拖动从 `droppableContainers` 中排除 `active.id`，优先使用其余目标的 `pointerWithin`，无结果时使用其余目标的 `closestCenter`；键盘拖动仍使用完整集合的 `closestCenter`。`onDragOver` 保存最后一个非 active 的 `queueIndex`，释放时仅在 `over` 为空或为 active 时回退该索引。排序写入仍唯一调用 `player.setQueue(arrayMove(queue, activeIndex, overIndex))`。
- **自动化**：四个范围内测试命令均退出码 0；`vp check` 退出码 0（3 条既有 warning）；完整 `vp test --run` 汇总为 33 个文件、161 个测试通过，退出码 0；`cargo test` 为 47/47，退出码 0；`cargo clippy` 退出码 0（21 条既有 warning）；`vp run gen:translations`、`vp build` 与 `git diff --check` 均退出码 0。

### DMG 与原生结果

- **DMG 与隔离环境**：DMG 为 `/Users/mico/AI 事物/Yifumusic(codex 内项目)/src-tauri/target/release/bundle/dmg/YifuMusic_0.23.4_aarch64.dmg`，大小 `9,072,941 bytes`，修改时间 `2026-08-01 19:49:36 CST`，SHA-256 `a02efe25f847d8d31e308eba4f3921e6ce257f22dec151173ce7810b2aadd667`，`hdiutil verify` 为 `VALID`。隔离 HOME 为 `/Users/mico/AI 事物/yifumusic-g-mouse-final.PjKbWx/home`，挂载卷 `/Volumes/YifuMusic`，从 `/Volumes/YifuMusic/YifuMusic.app/Contents/MacOS/yifumusic` 直接启动 PID `18872`，tmux 为 `yifumusic-g-mouse-final-1785585001`。隔离配置 `home/Library/Application Support/yifumusic/config.toml` 的 mtime 为 `1785585165`（`2026-08-01 19:52:45 CST`）。
- **键盘排序**：扫描 5 首实际本地曲目并开始播放第一首后，后续顺序“Let yourself be huge、演员 - 薛之谦[绅士] (1).flac、志明与春娇.MP3. - Sec0nd[From me].mp3、红尘客栈”变为“演员 - 薛之谦[绅士] (1).flac、Let yourself be huge、志明与春娇.MP3. - Sec0nd[From me].mp3、红尘客栈”；AX 为 `Draggable item 1 was dropped over droppable area 2`。
- **鼠标排序第一次**：从 `(811, 284)` 拖到 `(811, 380)` 后，后续顺序“演员、Let yourself be huge、志明与春娇、红尘客栈”变为“Let yourself be huge、演员、志明与春娇、红尘客栈”；AX 为 `Draggable item 1 was dropped over droppable area 2`。
- **鼠标排序第二次**：从 `(811, 380)` 拖到 `(811, 284)` 后，后续顺序“Let yourself be huge、演员、志明与春娇、红尘客栈”变为“Let yourself be huge、演员、红尘客栈、志明与春娇”；AX 为 `Draggable item 3 was dropped over droppable area 4`。两次均为 active 与目标区域不同，且释放后真实顺序改变。
- **删除、清空与播放持续**：删除 `Let yourself be huge` 后队列从 5 首降为 4 首。点击“清空播放队列”先显示“这将移除所有后续音轨，当前音轨会保留”，确认后队列为 1 首、后续区显示“播放队列为空”。全过程播放控件保持“暂停”，进度从 36 秒推进到 111 秒，当前曲目未跳转。
- **结论**：G 的键盘排序、两次鼠标排序、删除、清空确认和播放持续均在该新 DMG 中通过。E/F/H/I 未在本轮修改或重判。J/K/L/M 仅保留为用户原生人工复查项，本轮没有修改或循环处理。

## 2026-08-01：J 桌面歌词窗口打开死锁修复与原生复验

### 根因与范围

- 原生复现中，点击“打开桌面歌词”后日志稳定停在 `Creating desktop lyrics window`，主进程未退出，Computer Use 无法再取得窗口。
- `tauri-runtime-wry 2.11.2` 的 `create_window` 实现明确要求从独立线程调用；`WebviewWindowBuilder` 的本地文档也将命令内建窗示例声明为 `async fn`。此前 `open` 是同步 Tauri command，创建 WebviewWindow 时会等待主事件循环，形成死锁。
- 仅修改 `src-tauri/src/plugins/desktop_lyrics.rs`：将 `open` 改为异步 Tauri command。保留此前的无焦点建窗、显式显示和前端 8 秒超时保护；未修改 E/F/G/H/I/K/L/M 业务逻辑。

### 门禁与 DMG

- `cargo test`：47/47 通过；`cargo clippy` 退出码 0，保留 21 条既有 warning；`vp check` 退出码 0，保留 3 条既有 warning。
- `DesktopLyricsButton.test-e2e.tsx`：3/3 通过；`DesktopLyricsWindow.test-e2e.tsx`：4/4 通过。早于本次 Rust 异步改动的完整 `vp test --run` 已取得 34 文件、164 测试通过和退出码 0；改动后的两次全量重跑在浏览器启动阶段无汇总而停止，不能记为新增全量通过。
- `vp run tauri build` 退出码 0。DMG：`/Users/mico/AI 事物/Yifumusic(codex 内项目)/src-tauri/target/release/bundle/dmg/YifuMusic_0.23.4_aarch64.dmg`；大小 `9,073,889 bytes`；修改时间 `2026-08-01 21:10:07 CST`；SHA-256 `cac013d04c6412a3bd0a3ee3692ca0242c744200c068606d0110eae026335aa5`；`hdiutil verify` 为 `VALID`。

### 隔离原生结果

- 环境：macOS `26.6 (25G72)`、`arm64`；隔离根目录 `/Users/mico/AI 事物/yifumusic-stage4-j-window-20260801-211100`；HOME 为其 `home` 子目录；从挂载目录 `/Users/mico/AI 事物/yifumusic-stage4-j-window-20260801-211100/mounted-dmg/YifuMusic.app/Contents/MacOS/yifumusic` 直接启动 PID `26598`，tmux 为 `yifumusic-stage4-j-window-20260801-211100`。隔离配置文件 mtime 为 `2026-08-01 21:14:02 CST`。
- 无歌词：在首启空资料库的“界面”设置中点击“打开桌面歌词”，独立窗口 `YifuMusic 桌面歌词` 出现，AX 树可读取窗口、控制栏和 `YifuMusic — 聆听此刻` 空状态。日志依次记录 `Desktop lyrics open requested`、`Creating desktop lyrics window`、`Desktop lyrics window created`、`Desktop lyrics window shown`。
- 关闭与重开：点击子窗口“关闭桌面歌词”后回到主窗口；再次从设置打开仍创建并显示独立窗口，没有忙碌按钮或卡住现象。
- 带 LRC：通过原生文件夹选择器扫描 `/Users/mico/AI 事物/YifuMusic-人工验收音频` 的 5 首实际音频；播放 `演员 - 薛之谦[绅士] (1).flac` 后打开桌面歌词，子窗口显示同名曲目信息和时间歌词“原生验收第三句”。打开时主播放器仍为“暂停”按钮，表示播放保持进行。
- 子窗口控制：在子窗口点击“暂停”后控件变为“播放”，再次点击恢复为“暂停”；锁定后 AX 仅保留“解锁桌面歌词控件”；按 Escape 关闭子窗口后主窗口播放进度为 `01:14 / 04:21` 且仍显示“暂停”，确认关闭没有中断播放。
- 本轮只针对打开卡住进行复验。拖动、原生缩放、置顶和锁定后控制栏以外区域的鼠标穿透没有在本轮重判；不以 UI 状态替代这些独立的原生观察。

### 本轮结论

J 的独立窗口打开、关闭、重开、带歌词同步、暂停/恢复、锁定和 Escape 关闭已在新 DMG 的隔离原生环境中观察到，原先的建窗死锁不再复现。E/F/G/H/I/K/L/M 的既有记录不因本轮变更。

## 2026-08-01：J 桌面歌词拖动、缩放、置顶、锁定与穿透补齐

### 实现与门禁

- 授权参考：`/Users/mico/AI 事物/MoeKoeMusic-授权参考/electron/main.js`、`electron/appServices.js`、`src/views/Lyrics.vue` 与 `src/components/player/Helpers.js`。参考使用八方向边缘命中、对应 cursor、保存 resize 状态，并在锁定或控制区域外切换鼠标事件穿透。
- YifuMusic 修改范围：`src/components/DesktopLyricsWindow.tsx`、`src/lib/bridge-desktop-lyrics.ts`、`src-tauri/src/plugins/desktop_lyrics.rs`、专用 capability、图标和对应测试。前端维护八方向计算、独立的置顶/锁定/穿透偏好；Rust 只接受 `desktop-lyrics` label 的几何变更，拒绝非有限值和负尺寸，并按当前显示器工作区域裁剪。
- 原生发现与修复：初次原生复验中，锁定后仍可由 macOS 无边框系统边缘改变尺寸。这是因为仅拦截 React 事件而 `WebviewWindow` 仍为 `resizable(true)`。现已增加受限 `set_resizable` bridge，锁定时原生 `set_resizable(false)`，解锁时恢复。
- 自动化：`DesktopLyricsWindow.test-e2e.tsx` 7/7、`DesktopLyricsButton.test-e2e.tsx` 3/3、`security-capabilities.test.ts` 5/5、`cargo test` 50/50、`cargo clippy` 退出码 0（21 条既有 warning）、`vp check` 退出码 0（3 条既有 warning）、`vp run gen:translations` 和 `git diff --check` 退出码 0。完整 `vp test --run` JSON 报告为 53 个套件、167 个测试通过、0 失败、`success: true`。

### DMG 与隔离原生观察

- DMG：`src-tauri/target/release/bundle/dmg/YifuMusic_0.23.4_aarch64.dmg`；SHA-256 `080cb8960e69177074a93e150c704921aa2be9d6acb16689dac20e75d800d9ca`；`hdiutil verify` 为 `VALID`。
- 最终隔离环境：HOME `/Users/mico/AI 事物/yifumusic-stage4-j-lock-retest.Q0utjz/home`；挂载点 `/Users/mico/AI 事物/yifumusic-stage4-j-lock-retest.Q0utjz/mounted-dmg`；直接执行挂载卷内二进制；PID `33025`；tmux `yifumusic-stage4-j-lock-20260801223758`。
- 无歌词：独立窗口出现并显示 `YifuMusic - 聆听此刻`，控制栏显示“关闭始终置顶”“开启鼠标穿透”和布局锁定入口。
- 缩放：此前隔离 DMG 中实际截图尺寸依次为 `900×180 -> 1053×180`（右边）、`1053×180 -> 1053×253`（下边）、`1053×253 -> 1155×315`（右下）、`1155×315 -> 1055×245`（左上）。
- 锁定：最终 DMG 中锁定状态下从右边缘拖拽后截图仍为 `900×180`；点击“解锁桌面歌词布局”后同一方向拖拽变为 `1053×180`。原生锁定不再被系统边缘绕过。
- 带同名 LRC、暂停/恢复、关闭/重开和 Escape 播放持续沿用上一轮 `cac013d04...` 隔离原生记录；本轮不改变其结论。
- 工具边界：Computer Use 的窗口截图是窗口裁剪，未提供可读的全局位置或 z-order 数值；本轮不能据此记录拖动前后绝对位置、置顶覆盖观察或穿透命中为已通过。鼠标穿透开关和置顶开关的控件及受限 native bridge 已存在，但上述三项仍需可读的全局窗口位置、覆盖和下层命中证据。

### 本轮结论

J 的四向原生缩放、锁定后禁止缩放与解锁恢复已经在新 DMG 中通过。由于拖动绝对位置、置顶覆盖和鼠标穿透下层命中没有可靠原生证据，阶段 4 不能仅凭本轮 J 记录收尾。

## 当前 DMG 39e85dd6 原生验收证据同步

### 映像与隔离启动

- 当前映像：`/Users/mico/AI 事物/Yifumusic(codex 内项目)/src-tauri/target/release/bundle/dmg/YifuMusic_0.23.4_aarch64.dmg`。本次实际 `stat` 文件大小为 `9,075,882 bytes`。
- SHA-256：`39e85dd6a0df5302ce9a293f472a94f9fe5e5b1f8959468bfa59b2b367d51e7a`。本次实际 `hdiutil verify` 返回 `VALID`。
- 本次隔离启动使用 HOME `/Users/mico/AI 事物/yifumusic-stage4-j-user-acceptance-20260801-230538/home`，挂载路径 `/Users/mico/AI 事物/yifumusic-drag-native-system-20260802-0105`，直接启动挂载映像内的 `YifuMusic.app/Contents/MacOS/yifumusic`；启动时 PID 为 `43442`，tmux session 为 `yifumusic-drag-native-system`。
- 历史 SHA（包括 `080cb896...`、`cac013d...`）的原生观察仍保留在上文，均不代表本节当前 `39e85dd6` 映像。

### 当前映像的 J 原生证据

- 用户人工确认：独立桌面歌词窗口可以打开；无歌词状态可打开并显示空状态；播放带同名 LRC 的歌曲时可同步显示歌词；关闭后可以重新打开；暂停/恢复有效；Escape 可以关闭；关闭后播放持续。以上均记录为“用户人工通过”。
- 缩放与锁定：用户人工确认右、下、右下、左上四个方向均完成过原生缩放验证；锁定状态下窗口尺寸保持不变，解锁后窗口可以缩放。当前映像没有取得可复核的缩放前后数值，故缩放/锁定的数值证据为“未取得可靠数值”，但上述用户人工结果保留。
- 拖动：用户人工确认歌词内容区能够发起拖动；但当前对话的最新反馈是快拖和极慢拖仍会闪烁、窗口不跟随鼠标箭头移动。因此不能记录为通过，状态为“失败：可发起拖动，但跟手性与闪烁不符合验收要求”；未取得可靠的拖动前后绝对位置数值。
- 始终置顶：未取得当前映像覆盖其他窗口的可靠 z-order 观察，状态为“原生待验收”。
- 鼠标穿透：未取得开启后下层窗口实际命中的可靠观察，状态为“原生待验收”。
- 控制栏：暂停/恢复、Escape 关闭、关闭/重开与歌词同步已有用户人工观察；上一首、下一首及其他控制栏动作未取得单独的可靠观察，不扩展为通过。

### 自动化与文档检查边界

- 任务输入提供的完整自动化记录为 `34` 个测试文件、`167` 个测试通过、退出码 `0`；本次只做证据同步，未重新运行该完整命令，故不将其作为本次新执行的原始输出。
- 本次实际执行：桌面歌词与安全 capability 定向测试 `12/12` 通过；`vp check` 退出码 `0`（3 条既有 warning）；`cargo fmt --check` 退出码 `0`；`cargo test` 为 `50/50` 通过。
- 本次未重新执行 `cargo clippy`、`vp run gen:translations` 或 `vp build`，不将历史成功结果错误归属当前 SHA。`git diff --check` 本次为退出码 `0`；暂存区为空。
- 结论：当前映像的完整性与隔离启动已核对。J 的打开、歌词同步、关闭/重开、暂停/恢复、Escape、四向缩放和锁定/解锁保留用户人工结果；拖动的跟手性与闪烁为失败，置顶和穿透下层命中仍缺证据。

## 当前 DMG 39e85dd6：最终用户人工验收确认

- 用户已对当前最终候选 `39e85dd6a0df5302ce9a293f472a94f9fe5e5b1f8959468bfa59b2b367d51e7a` 完成最终人工复查，并确认 J 全部通过。
- J 桌面歌词：独立窗口打开、无歌词空状态、同名 LRC 同步、拖动跟手、四向缩放、始终置顶、锁定/解锁、鼠标穿透及关闭/重开均通过。
- J 控制：上一首、播放/暂停、下一首、Escape 关闭均通过；关闭桌面歌词后主播放持续。
- 本条是当前候选的最新用户人工结论；上文历史失败或证据不足记录保留为历史记录，不代表当前候选最终状态。
