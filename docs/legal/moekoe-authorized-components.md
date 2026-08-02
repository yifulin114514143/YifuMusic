# MoeKoeMusic 授权组件适配清单

## 授权确认

用户已在 2026-07-30 的当前任务中确认：已获得 MoeKoeMusic 作者的完全授权，并将该授权范围授予 YifuMusic 迁移工作。当前授权参考根目录为：

`/Users/mico/AI 事物/MoeKoeMusic-授权参考`

最高优先级是彻底、全面复刻该参考项目的页面结构、视觉层级、组件行为、播放器工作流和服务适配流程。若旧的 Stage 4 范围、播放核心、权限边界或“后续阶段”标记与此目标冲突，以完整复刻为准。

## 迁移技术边界

- 目标实现保持 React、TypeScript、StyleX、TanStack Router、Tauri 和 Rust；不引入 Vue 或 Electron 运行时。
- 授权允许直接参考、翻译、迁移和改写 Vue、SCSS 与 JavaScript 的组件结构和功能流程；迁移后代码使用 YifuMusic 的类型、路由和 Tauri bridge 模式。
- 参考项目的服务接口、登录、二维码、账号状态、VIP、云盘、在线搜索、MV、桌面歌词、插件、PWA、更新与代理等功能均纳入复刻主线。未完成的项目必须如实标为“未开始”或“进行中”。
- YifuMusic 仍保留 Museeks 的 `LICENSE` 与 `NOTICE.md`。该归属说明不限制本次已获授权的 MoeKoeMusic 源码迁移。

## 已核对的授权参考与对应实现

| MoeKoeMusic 授权参考路径                                                                                    | 复刻范围                                                 | 当前 YifuMusic 对应位置                                                                                                                                                                                                                                                                                  | 当前状态 |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `src/App.vue`、`src/layouts/HomeLayout.vue`                                                                 | 应用壳、路由容器、标题/侧栏模式、固定播放器              | `src/routes/__root.tsx`、`src/components/AppShell.tsx`                                                                                                                                                                                                                                                   | 进行中   |
| `src/components/TitleBar.vue`、`src/components/Header.vue`、`src/components/SidebarNavigation.vue`          | 标题栏、前进后退刷新、搜索、账号菜单、侧栏折叠和导航层级 | `src/components/PageHeader.tsx`、`src/components/Navigation.tsx`                                                                                                                                                                                                                                         | 进行中   |
| `src/components/PlayerControl.vue`、`src/components/QueueList.vue`                                          | 固定播放器、速度/模式/音量、播放队列与全屏入口           | `src/components/Header.tsx`、`src/components/PlayingBar.tsx`、`src/components/QueuePanel.tsx`、`src/components/NowPlayingOverlay.tsx`                                                                                                                                                                    | 进行中   |
| `src/components/player/LyricsHandler.js`、`src/views/Lyrics.vue`                                            | 应用内与独立桌面歌词、时间轴、翻译/高亮、窗口控制        | `src/components/NowPlayingOverlay.tsx`、`src/components/DesktopLyricsWindow.tsx`、`src/components/DesktopLyricsSync.tsx`、`src/lib/lyrics/local-lyrics.ts`、`src/lib/bridge-lyrics.ts`、`src/lib/bridge-desktop-lyrics.ts`、`src-tauri/src/plugins/lyrics.rs`、`src-tauri/src/plugins/desktop_lyrics.rs` | 进行中   |
| `src/components/player/ProgressBar.js`、`src/components/player/SongQueue.js`                                | Seek、播放模式、在线/云盘/本地队列语义                   | `src/components/TrackProgress.tsx`、`src/components/Queue.tsx`、`src/lib/player.ts`                                                                                                                                                                                                                      | 进行中   |
| `src/views/Home.vue`、`src/views/Discover.vue`、`src/views/Ranking.vue`                                     | 首页、推荐、发现和排行榜                                 | 目标路由尚未建立                                                                                                                                                                                                                                                                                         | 未开始   |
| `src/views/Login.vue`、`src/stores/store.js`、`src/utils/apiBaseUrl.js`、`src/utils/request.js`             | 设备注册、手机号/邮箱/二维码登录、会话和服务地址配置     | 目标 bridge、状态和路由尚未建立                                                                                                                                                                                                                                                                          | 未开始   |
| `src/views/Library.vue`、`src/views/PlaylistDetail.vue`、`src/views/Search.vue`                             | 在线音乐库、歌单详情、搜索分类与结果跳转                 | `src/routes/library.tsx`、`src/routes/playlists.$playlistID.tsx`、`src/routes/search.tsx`                                                                                                                                                                                                                | 进行中   |
| `src/views/CloudDrive.vue`、`src/views/LocalMusic.vue`、`src/views/Recognize.vue`                           | 云盘、本地音乐入口与听歌识曲                             | 本地曲库已存在；其余目标路由尚未建立                                                                                                                                                                                                                                                                     | 进行中   |
| `src/views/VideoPlayer.vue`                                                                                 | MV/视频播放器与播放器暂停恢复                            | 目标路由尚未建立                                                                                                                                                                                                                                                                                         | 未开始   |
| `src/components/ExtensionManager.vue`、`src/config/settings.js`                                             | 插件、PWA、代理、桌面歌词、服务与播放器设置              | 独立桌面歌词窗口已开始迁移；其余由 `src/routes/settings*.tsx` 承载                                                                                                                                                                                                                                       | 进行中   |
| `src/components/StatusBarLyrics.vue`、`src/components/AppUpdateDialog.vue`、`src/components/Disclaimer.vue` | 状态栏歌词、更新入口、免责声明                           | 目标 Tauri 等价组件尚未建立                                                                                                                                                                                                                                                                              | 未开始   |

## 已登记的阶段 5.5 视觉素材

阶段 5.5 的发现页使用任务中明确指定的本地素材。素材只用于发现页分类区域，并由 `discover_character_visible` 开关控制显示；不得扩展为沉浸播放场景、在线内容、品牌宣传或用户场景资产。

| 当前任务指定素材              | YifuMusic 目标路径                         | 页面用途                       |
| ----------------------------- | ------------------------------------------ | ------------------------------ |
| 阶段 5.5 指定的 1600×878 WebP | `src/assets/moekoe/nangong-yu-cinema.webp` | 发现页分类区域的可隐藏视觉素材 |

## 真实性要求

- 不将浏览器测试、编译通过或 UI 占位显示写成服务、音频、登录、MV 或原生桌面功能的人工验收。
- 不以“后续阶段”或旧安全限制为由删除已获授权的复刻需求；应通过精确的 React/Tauri 等价实现继续迁移。
- 仅在参考源码、现有工程文件、测试或运行证据能确认的情况下实现字段、路由、接口与状态；发现缺失服务契约时记录确切缺口并向用户索要运行或抓包证据。
