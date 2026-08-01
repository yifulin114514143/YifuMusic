# 本地、桌面与状态栏歌词权限审计

## 审计优先级

彻底、全面复刻 MoeKoeMusic 是最高优先级。本审计记录当前 Tauri/React 实现的权限与数据边界，不能被解释为拒绝或永久排除已授权的复刻功能；任何后续实现仍须以真实代码、服务契约和最小权限为依据。

## 本地歌词命令边界

- `lyrics:get_sibling_lyrics` 只接收已入库曲目的 `trackId`。
- Rust 从数据库取得曲目路径后，先检查现有媒体 asset 授权，再验证由规范化曲目路径派生的曲目 ID 与传入 `trackId` 一致；随后只读取同目录的同名 `.lrc` 或安全的精确曲名 `.lrc` 路径。
- `lyrics:select_and_read` 不接收前端路径；原生文件选择与读取均在 Rust 内完成，前端只得到 `available`、`unavailable`、`failed` 或 `cancelled` 状态，以及可用时的歌词文本。
- 用户手动选择仅接受 `.lrc` 与 `.txt` 文件；后端再次验证扩展名、常规文件状态、最大 1 MiB 大小和编码。

## 静态与运行时 Scope

- `src-tauri/tauri.conf.json` 的静态 `assetProtocol.scope.allow` 保持为空数组。
- 歌词插件不调用运行时目录授权，也不扩大媒体 asset 授权。
- 本地歌词读取支持 UTF-8、UTF-8 BOM、UTF-16 LE BOM 和 UTF-16 BE BOM；读取、编码和解析失败只回传固定状态，不向日志、通知或 Git 写入歌词文本或文件路径。

## 独立桌面歌词窗口与 capability 分离

- Rust 窗口 label 固定为 `desktop-lyrics`，创建 URL 为 `WebviewUrl::App("desktop-lyrics.html".into())`；该 HTML 的独立入口是 `src/desktop-lyrics-main.tsx`。
- 主窗口在 `src-tauri/capabilities/main.json` 只拥有 `desktop-lyrics:allow-open` 与 `desktop-lyrics:allow-sync-state`。
- 仅 label 为 `desktop-lyrics` 的窗口使用 `src-tauri/capabilities/desktop-lyrics.json`，精确权限为：
  - `core:event:allow-listen`
  - `core:event:allow-unlisten`
  - `desktop-lyrics:allow-close`
  - `desktop-lyrics:allow-start-dragging`
  - `desktop-lyrics:allow-get-state`
  - `desktop-lyrics:allow-control`
  - `desktop-lyrics:allow-set-mouse-passthrough`
- `desktop-lyrics:allow-close` 与 `desktop-lyrics:allow-start-dragging` 都由 Rust 接收 Tauri 注入的 `WebviewWindow`，并在调用前精确验证其 label 为 `desktop-lyrics`；前端不能传入窗口 label，也不能借此操作主窗口。
- 专属歌词窗口没有 `desktop-lyrics:allow-open`、`desktop-lyrics:allow-sync-state`、`core:event:allow-emit`、任何 `core:window:*` 权限、`core:window:allow-set-ignore-cursor-events` 或文件读取权限。

## 系统托盘与 macOS 状态栏歌词

- `src-tauri/Cargo.toml` 仅为现有 Tauri 2.11.2 显式启用 `tray-icon` feature；未加入新网络、文件系统、shell 或窗口 capability。
- `src-tauri/src/plugins/tray.rs` 创建使用应用自身默认图标的原生托盘菜单。主窗口 capability 只新增 `tray:allow-sync-state`，对应 `src/lib/bridge-tray.ts` 的唯一 `invoke`；它接收的 payload 只包含 `trackId`、标题、歌手、暂停状态和当前已解析歌词，不包含本地路径、封面路径、Cookie、Token 或任何在线服务数据。
- 托盘的上一首、播放暂停、下一首只向 label `main` 的既有 `PlaybackPrevious`、`PlaybackPlayPause`、`PlaybackNext` 事件分派；`IPCPlayerEvents.tsx` 再调用唯一 `src/lib/player.ts`。显示/隐藏主窗口及退出完全在 Rust 中执行，前端没有额外窗口或退出权限。
- `status_bar_lyrics` 是现有 Config 的新增布尔字段，默认 `false`；`src/routes/settings.ui.tsx` 仅在 macOS 显示中文开关。开关关闭、无播放曲目或当前歌词为空时，Rust 会清除 TrayIcon title。Windows 不支持 tray title，非 macOS 不会执行状态栏歌词更新。
- 本实现使用状态栏文本，不等同于参考 Electron 服务的 Canvas 模板图像；该视觉细节仍是全面复刻的待完成项。

## 状态、控制和播放数据流

- `DesktopLyricsSync.tsx` 从主窗口的 `usePlayingTrack`、`usePlayingTrackCurrentTime`、`usePlayerState`、`LyricsBridge.getSiblingLyrics` 与 `listenForUserSelectedLyrics` 构造 `DesktopLyricsPayload`，再调用 `desktop-lyrics:allow-sync-state`。同一已解析 payload 会经 `createTrayPayload` 同步给 `tray:allow-sync-state`，因此状态栏歌词不会重复读取本地文件。歌词读取仍经 `src/lib/bridge-lyrics.ts` 与 `src-tauri/src/plugins/lyrics.rs`，前端不会传入绝对路径。
- `NowPlayingOverlay.tsx` 仅在手选歌词读取成功、且当前曲目仍与发起选择时的 `trackId` 相同的情况下，才通过 `publishUserSelectedLyrics` 发布已解析的 `LocalLyrics`。`DesktopLyricsSync` 也只接受与当前播放曲目相同 `trackId` 的手选歌词事件，并把歌词状态与 `trackId` 一起保存；切歌期间不能把旧歌词组成新曲目的 payload。
- Rust 保存最近 payload；歌词窗口存在时，Rust 向 label `desktop-lyrics` 发送 `desktop-lyrics:state`。歌词窗口先调用 `desktop-lyrics:allow-get-state` 获取初始状态，再监听该状态事件。
- 歌词窗口只能经 `desktop-lyrics:allow-control` 回传 `previous`、`play-pause` 或 `next`；Rust 只向 label `main` 发送 `desktop-lyrics:action`，主窗口再分别调用唯一 `src/lib/player.ts` 的 `previous()`、`playPause()` 或 `next()`。桌面歌词窗口没有音频元素，也不取得媒体文件路径或音频播放权限。

## 透明窗口、macOSPrivateApi 与受控鼠标穿透

- 创建窗口时使用无装饰、透明、始终置顶、全工作区可见、跳过任务栏、无阴影、可缩放的配置；初始尺寸为 `900 × 180`，最小尺寸为 `800 × 128`。前端已删除边缘拖拽缩放命令与命中区：当前仅保留受 Rust label 校验的窗口拖动；macOS 上无装饰歌词窗口的原生缩放可用性仍须人工核验。
- `src-tauri/tauri.conf.json` 目前配置 `"macOSPrivateApi": true`，`src-tauri/Cargo.toml` 的 Tauri feature 包含 `"macos-private-api"`。这两项配置只说明当前原生能力已启用，不代表其无风险或已经过人工验收。
- `src-tauri/src/main.rs` 已注册 `tauri_plugin_window_state::Builder`，状态标志为 `StateFlags::all() & !StateFlags::VISIBLE`。现有插件按窗口 label 保存并恢复位置和尺寸，因此 `desktop-lyrics` 的位置/尺寸不是未持久化状态；`VISIBLE` 被排除，插件也不会自动创建或自动打开桌面歌词。当前 `DesktopLyricsBridge.open()` 由 `DesktopLyricsButton` 的用户点击触发。
- 前端只把控制栏的 DOM bounds 与 `window.devicePixelRatio` 传给 `desktop-lyrics:allow-set-mouse-passthrough`。Rust 在内部调用 `window.set_ignore_cursor_events(...)`；前端没有通用的 `core:window:allow-set-ignore-cursor-events` 权限。
- 仅当 `preferences.isLocked` 为真且存在控制栏 bounds 时，Rust 才依据系统 cursor、歌词窗口 outer position 和 DPI 换算决定是否忽略 cursor events：鼠标位于控制栏 bounds 外时才穿透。未锁定、没有 bounds、打开窗口或组件卸载时会请求恢复接收 cursor events。
- `DesktopLyricsInteractionState` 缓存上次 cursor-events 状态以避免重复原生调用；后台循环每 120 ms 重新同步。若读取 cursor 或窗口位置失败，本轮同步会提前返回；若 `set_ignore_cursor_events` 调用失败，缓存会重置，故这些失败路径必须纳入原生验收。

## 自动化证据、原生验收与残余风险

- 本轮已运行 `vp test --run`（26 个测试文件、113 个测试通过）、`vp check`（0 个错误、4 条既有 warning）、`cargo test`（35/35 通过）和 `cargo clippy`（成功退出，21 条既有 warning）。其中新增 `src/lib/lyrics/tray.test.ts` 与 `src-tauri/src/plugins/tray.rs` 单测，覆盖当前歌词、无曲目清空、托盘菜单文字和状态栏开关的纯逻辑；`src/lib/__tests__/security-capabilities.test.ts` 继续约束精确 capability、桌面歌词窗口与托盘播放事件边界。
- 正式 macOS `.app` 仍须验证透明窗口合成、置顶与全工作区、Dock/Spaces/全屏交互、拖拽、无装饰窗口的原生缩放可用性、窗口级 cursor events 忽略、重启后按 `desktop-lyrics` label 恢复位置和尺寸，以及本地歌词选择、读取、显示和播放不中断；还须验证托盘左键显隐、右键菜单、播放动作、退出、状态栏歌词开关与无歌词/切歌清空。浏览器测试不能替代这些项目；macOS 的验收也不能替代 Linux 或 Windows 的单独验收。
- 当前实现没有网络/API 服务契约。逐字歌词、翻译歌词和在线歌词尚未实现，不能表述为已完成。
