# 阶段 2：Tauri Capability 与网络边界审计

## 范围与结论

本审计针对阶段 2 开始时 `src-tauri/capabilities/main.json` 中的每一项
permission，以及 `src-tauri/tauri.conf.json` 的 asset protocol 和 CSP。证据来自
当前前端桥接层、组件、路由、Rust 插件、Tauri 2.11.2 的已安装源码和现有测试；不
包含个人曲库、数据库内容、会话材料或真实服务请求参数。

阶段 2 不启用任何第三方音乐服务域名、登录、账号、Cookie、Token、在线音频、MV 或
服务端请求。`api.github.com` 是当前版本检查已有的精确连接来源，不属于服务适配器
预留权限。

## Capability 审计表

| Permission                              | 实际调用位置                                                                                                 | 用户可见功能                             | 当前是否必需 | 保留/删除          | 理由                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------ | ------------------ | ---------------------------------------------------------------------------- |
| `core:app:default`                      | `src/routes/settings.tsx` 的 `getVersion()`；`src/api/SettingsAPI.ts` 的版本比较                             | 设置页版本与更新检查                     | 是           | 删除，拆为两个命令 | 默认集还包含名称、标识和监听器等未使用命令。                                 |
| `core:event:default`                    | `IPCPlayerEvents.tsx`、`LibraryEvents.tsx`、`IPCNavigationEvents.tsx`、`AppEvents.tsx` 和拖入事件的 `listen` | 播放控制、曲库进度、导航、主题和拖入事件 | 是           | 删除，拆为两个命令 | 前端只监听和取消监听，不向后端 emit。                                        |
| `core:menu:default`                     | `TrackList.tsx`、`SideNavLink.tsx` 的 `MenuItem.new`、`Menu.new`、`popup`                                    | 右键菜单和歌单菜单                       | 是           | 删除，拆为两个命令 | 默认集允许菜单增删改等未使用操作。                                           |
| `core:path:default`                     | 未发现前端调用；`app_menu.rs` 的资源目录读取由 Rust 直接完成                                                 | 无                                       | 否           | 删除               | Rust 后端调用不需要向 WebView 授权。                                         |
| `core:resources:default`                | 未发现前端调用；`app_menu.rs` 的资源目录读取由 Rust 直接完成                                                 | 无                                       | 否           | 删除               | Rust 后端调用不需要向 WebView 授权。                                         |
| `core:window:default`                   | `PlayerEvents.tsx`、`SettingsAPI.ts`、拖拽区域注入脚本                                                       | 通知判断、主题和窗口拖动                 | 是           | 删除，拆为六个命令 | 默认集包含大量未使用的窗口查询能力。                                         |
| `core:window:allow-show`                | `app-menu\|show_window` 内部由 `app_menu.rs` 调用 Rust `window.show()`                                       | 启动显示主窗口                           | 否           | 删除               | 后端直接调用不经过 WebView capability。                                      |
| `core:window:allow-start-dragging`      | `Header.tsx`、`PlayingBarInfo.tsx` 的 `data-tauri-drag-region`；Tauri 注入脚本                               | 无边框窗口拖动                           | 是           | 保留               | 注入脚本调用该精确命令。                                                     |
| `core:window:allow-set-theme`           | `src/api/SettingsAPI.ts` 的 `setTheme()`                                                                     | 设置浅色、深色或系统主题                 | 是           | 保留               | 当前主题设置直接调用。                                                       |
| `core:webview:deny-print`               | 未发现打印调用                                                                                               | 无                                       | 否           | 删除               | 未授予 `allow-print` 时 Tauri 默认拒绝打印；移除冗余拒绝规则以保持最小清单。 |
| `core:webview:allow-set-webview-zoom`   | `main.rs` 的 `zoom_hotkeys_enabled(true)`；Tauri 注入的缩放热键脚本                                          | 缩放热键和鼠标缩放                       | 是           | 保留               | macOS 和 Linux 的注入脚本调用该精确 WebView 命令。                           |
| `shell:allow-open`                      | 未发现 shell 插件或 `plugin:shell` 调用                                                                      | 无                                       | 否           | 删除               | 外链由 opener 处理，当前本地播放器不需要 shell。                             |
| `clipboard-manager:allow-write-text`    | `TrackList.tsx` 的 `writeText()`                                                                             | 复制曲名、艺人或专辑文本                 | 是           | 保留               | 当前右键菜单直接调用。                                                       |
| `dialog:allow-open`                     | `settings.library.tsx` 的目录 `open()`                                                                       | 选择本地音乐目录                         | 是           | 保留               | 本地曲库添加流程直接调用。                                                   |
| `dialog:allow-ask`                      | `settings.library.tsx`、`TrackList.tsx` 的 `ask()`                                                           | 刷新、重置和移除确认                     | 是           | 保留               | 当前确认对话框直接调用。                                                     |
| `fs:allow-lstat`                        | `DropzoneImport.tsx` 的 `lstat()`                                                                            | 拖入时仅接受目录                         | 是           | 保留               | 当前拖入筛选直接调用。                                                       |
| `opener:allow-open-url`                 | `useOpener.ts`；设置与错误页的固定项目链接                                                                   | 打开项目、发布页、贡献者和问题页         | 是           | 保留并精确 scope   | 仅允许四个当前固定项目页面，不允许任意 URL。                                 |
| `opener:allow-default-urls`             | 无；其默认 scope 含 `mailto`、`tel`、`http` 和 `https` 通配                                                  | 无                                       | 否           | 删除               | 当前仅有固定项目 URL，不能保留默认通配。                                     |
| `opener:allow-reveal-item-in-dir`       | `TrackList.tsx`、`useOpener.ts`                                                                              | 显示曲目或应用存储目录                   | 是           | 保留               | 当前显式用户操作直接调用。                                                   |
| `os:allow-os-type`                      | 无前端 `osType()` 调用；`config.rs` 由 Rust 注入平台字符串                                                   | 平台样式与快捷键                         | 否           | 删除               | 注入发生在 Rust，不需要将 OS 查询暴露给 WebView。                            |
| `process:allow-restart`                 | `settings.ui.tsx` 的 `relaunch()`                                                                            | Wayland 兼容设置后重启                   | 是           | 保留               | 当前设置页直接调用。                                                         |
| `log:allow-log`                         | `main.tsx`、`utils.ts`、`bridge-database.ts` 等                                                              | 前端错误、警告和诊断日志                 | 是           | 保留               | 当前代码直接调用日志插件。                                                   |
| `notification:default`                  | `PlayerEvents.tsx` 的 `sendNotification()`；通知插件初始化脚本                                               | 曲目切换通知                             | 是           | 删除，拆为两个命令 | 仅需检查通知授权和发送通知。                                                 |
| `app-menu:allow-show`                   | `bridge-settings.ts` 的 `showMenu()`                                                                         | 显示菜单栏                               | 是           | 保留               | 当前设置桥接命令直接调用。                                                   |
| `app-menu:allow-hide`                   | `bridge-settings.ts` 的 `hideMenu()`                                                                         | 隐藏菜单栏                               | 是           | 保留               | 当前设置桥接命令直接调用。                                                   |
| `app-menu:allow-show-window`            | `bridge-settings.ts` 的 `showWindow()`                                                                       | 启动后显示主窗口                         | 是           | 保留               | 当前设置桥接命令直接调用。                                                   |
| `config:allow-get-storage-dir`          | `bridge-config.ts` 的 `getStorageDir()`                                                                      | 打开应用存储目录                         | 是           | 保留               | 路由通过 bridge 使用该命令。                                                 |
| `config:allow-set-config`               | `bridge-config.ts` 的 `set()`、`multiSet()`                                                                  | 保存设置和曲库目录                       | 是           | 保留               | 当前设置与曲库流程直接调用。                                                 |
| `config:allow-get-config`               | `bridge-config.ts` 的 `getAll()`                                                                             | 读取设置                                 | 是           | 保留               | 当前查询和初始化直接调用。                                                   |
| `cover:allow-get-cover`                 | `bridge-cover.ts`、`cover.ts`                                                                                | 读取并显示封面                           | 是           | 保留               | 封面组件和播放通知使用该命令。                                               |
| `database:allow-scan-library`           | `bridge-database.ts` 的 `importTracks()`                                                                     | 扫描本地曲库和 M3U                       | 是           | 保留               | 当前本地导入流程直接调用。                                                   |
| `database:allow-get-all-tracks`         | `bridge-database.ts` 的 `getAllTracks()`                                                                     | 曲库列表                                 | 是           | 保留               | 当前曲库查询直接调用。                                                       |
| `database:allow-get-tracks`             | `bridge-database.ts` 的 `getTracks()`                                                                        | 队列和歌单曲目查询                       | 是           | 保留               | 当前队列与歌单流程直接调用。                                                 |
| `database:allow-update-track`           | `bridge-database.ts` 的 `updateTrack()`                                                                      | 编辑曲目元数据                           | 是           | 保留               | 当前编辑流程直接调用。                                                       |
| `database:allow-remove-tracks`          | `bridge-database.ts` 的 `removeTracks()`                                                                     | 从曲库移除曲目                           | 是           | 保留               | 当前移除流程直接调用。                                                       |
| `database:allow-get-artists`            | `bridge-database.ts` 的 `getAllArtists()`                                                                    | 艺术家列表                               | 是           | 保留               | 当前艺术家页直接调用。                                                       |
| `database:allow-get-artist-tracks`      | `bridge-database.ts` 的 `getArtistTracks()`                                                                  | 艺术家曲目列表                           | 是           | 保留               | 当前艺术家页直接调用。                                                       |
| `database:allow-get-compilation-albums` | `bridge-database.ts` 的 `getCompilationAlbums()`                                                             | 合集列表                                 | 是           | 保留               | 当前合集页直接调用。                                                         |
| `database:allow-has-compilations`       | `bridge-database.ts` 的 `hasCompilations()`                                                                  | 合集入口状态                             | 是           | 保留               | 当前导航判断直接调用。                                                       |
| `database:allow-get-all-playlists`      | `bridge-database.ts` 的 `getAllPlaylists()`                                                                  | 歌单列表                                 | 是           | 保留               | 当前歌单页直接调用。                                                         |
| `database:allow-get-playlist`           | `bridge-database.ts` 的 `getPlaylist()`                                                                      | 单个歌单详情                             | 是           | 保留               | 当前歌单页直接调用。                                                         |
| `database:allow-create-playlist`        | `bridge-database.ts` 的 `createPlaylist()`                                                                   | 新建歌单                                 | 是           | 保留               | 当前歌单流程直接调用。                                                       |
| `database:allow-rename-playlist`        | `bridge-database.ts` 的 `renamePlaylist()`                                                                   | 重命名歌单                               | 是           | 保留               | 当前歌单流程直接调用。                                                       |
| `database:allow-set-playlist-tracks`    | `bridge-database.ts` 的 `setPlaylistTracks()`                                                                | 编辑歌单曲目                             | 是           | 保留               | 当前歌单流程直接调用。                                                       |
| `database:allow-export-playlist`        | `bridge-database.ts` 的 `exportPlaylist()`                                                                   | 导出 M3U                                 | 是           | 保留               | 当前歌单菜单直接调用。                                                       |
| `database:allow-delete-playlist`        | `bridge-database.ts` 的 `deletePlaylist()`                                                                   | 删除歌单                                 | 是           | 保留               | 当前歌单流程直接调用。                                                       |
| `database:allow-reset`                  | `bridge-database.ts` 的 `reset()`                                                                            | 重置本地曲库                             | 是           | 保留               | 当前危险操作直接调用。                                                       |
| `default-view:allow-set`                | `bridge-settings.ts` 的 `setDefaultView()`                                                                   | 保存启动默认页                           | 是           | 保留               | 当前设置流程直接调用。                                                       |
| `sleepblocker:allow-enable`             | `bridge-settings.ts` 的 `toggleSleepBlocker(true)`                                                           | 播放时阻止休眠                           | 是           | 保留               | 当前设置流程直接调用。                                                       |
| `sleepblocker:allow-disable`            | `bridge-settings.ts` 的 `toggleSleepBlocker(false)`                                                          | 恢复系统休眠                             | 是           | 保留               | 当前设置流程直接调用。                                                       |

最终替代命令为：`core:app:allow-version`、`core:app:allow-tauri-version`、
`core:event:allow-listen`、`core:event:allow-unlisten`、`core:menu:allow-new`、
`core:menu:allow-popup`、`core:window:allow-is-minimized`、
`core:window:allow-is-focused`、`core:window:allow-theme`、
`core:window:allow-set-theme`、`core:window:allow-start-dragging`、
`core:window:allow-internal-toggle-maximize`、
`core:webview:allow-set-webview-zoom`、
`notification:allow-is-permission-granted` 和 `notification:allow-notify`。

`database:get_track` 在 Rust 命令注册中存在，但未发现前端调用，也没有加入 capability。

## Asset Protocol 与 CSP

### Asset protocol scope

静态 `assetProtocol.scope.allow` 已改为空数组。后端只在以下已确认时机逐文件授予
asset access：

1. 数据库插件启动后，从已入库曲目读取路径，并逐个调用 `allow_file`。
2. 扫描事务成功后，仅对仍能在数据库路径集合中查到的每个 `Track.path` 调用 `allow_file`。
3. 封面插件先验证请求曲目已在 asset scope 中；未授权时返回无封面，再仅对返回的文件系统封面调用 `allow_file`；嵌入式封面继续返回 `data:`。
4. 文件关联打开的曲目原本已逐个调用 `allow_file`，继续保持该行为。

不直接对 `scan_library` 的 IPC `import_paths` 调用 `allow_directory`。启动时还会验证
数据库中曲目 ID 与其规范化路径的既有确定性 ID 一致，才恢复该文件的 asset access。
这样不会把任意传入目录整体加入 asset scope，也不会仅因前端修改曲目记录中的路径就
在重启后授予该路径。

残余限制：两种现有的用户主动目录操作会绕过上述逐文件路径，在当前进程创建递归的
runtime asset scope：

1. 目录选择插件在用户选中目录后调用 `allow_directory`。
2. `DropzoneImport.tsx` 订阅 `onDragDropEvent`；Tauri 在将拖入目录事件交给前端前调用
   `allow_directory(path, true)`。

这是已安装 Tauri 2.11.2 的内建行为，静态配置仍不含全盘通配，且重启后临时目录 scope
不会保留。Tauri 当前 scope API 没有逐项移除已允许模式的接口；对目录执行 forbid 会
同时阻断合法曲目，因此不能用 forbid 伪造撤销。阶段 2 的人工验收必须覆盖目录选择和
目录拖放后的扫描、播放与封面显示，以及重启后已入库媒体与封面仍可播放、仍可显示。

另一个既有信任边界是 `database:scan_library` 接收渲染层传入的目录，以及
`database:update_track` 接收的曲目路径；阶段 2 不改变数据库领域规则。静态 scope
收缩后，启动恢复不会对 ID 与路径不一致的记录授权，扫描后也只授权确实持久化的路径；
但 Rust 扫描在写入前仍会读取传入路径的媒体元数据。封面目录扫描还会遵循符号链接，
因此用户已授权目录内的封面查找可能抵达链接目标。后续若改变这些领域接口，必须先补充
原生用户授权来源与路径授权的接口契约，再进一步收紧该边界。

### CSP 审计

| 指令          | 最终来源                                                           | 证据与结论                                                                                                        |
| ------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `connect-src` | `'self'`、`ipc:`、`http://ipc.localhost`、`https://api.github.com` | 前三项服务 Tauri 内部 IPC；GitHub 主机仅服务现有版本检查。移除无调用证据的 `asset:`、asset localhost 和 `blob:`。 |
| `media-src`   | `'self'`、`asset:`、asset localhost、`http://127.0.0.1:*`          | asset 来源用于本地音频；最后一项仅用于 Linux 本地流媒体插件的动态 loopback 端口。移除 `blob:` 与 `data:`。        |
| `img-src`     | `'self'`、`asset:`、asset localhost、`data:`                       | 文件系统封面通过 asset，嵌入式封面通过 `data:`。                                                                  |

`http://127.0.0.1:*` 是本机 loopback 动态端口的最小可行例外，不是互联网服务来源。
当前没有 WebSocket、EventSource、第三方音乐服务请求、在线音频或 MV 域名。

## 服务适配器权限登记模型

阶段 2 只定义登记结构，不创建适配器实现、网络请求或第三方域名。每个未来适配器必须
在代码和 CSP/capability 修改前，先提交一份有接口契约证据的登记表。

| 字段                | 说明                                                     |
| ------------------- | -------------------------------------------------------- |
| `adapterId`         | 稳定的服务适配器标识。                                   |
| `displayName`       | 面向用户的服务名称。                                     |
| `feature`           | 登录、歌单、推荐、音频、MV 等具体功能，按功能拆分。      |
| `userAuthorization` | 用户必须完成的授权前置条件与可见授权状态。               |
| `requestDomains`    | 经合法接口契约证据确认的 API 域名列表。                  |
| `mediaDomains`      | 经合法接口契约证据确认的音频或 MV 域名列表。             |
| `cspDirectives`     | 所需 CSP 指令和逐项最小域名集合。                        |
| `tauriPermissions`  | 所需 Tauri capability 及其功能理由。                     |
| `credentialStorage` | 会话材料的安全存储策略，不得写入日志、文档或普通配置。   |
| `enablement`        | 默认关闭、功能开关、用户可见状态和启用条件。             |
| `revocation`        | 注销、授权撤销、会话过期后清除会话材料和关闭功能的行为。 |
| `timeoutAndErrors`  | 超时、限流、服务不可用时的本地回退和可理解错误。         |
| `verification`      | 接口契约测试、权限测试、人工验收和发布前检查。           |

占位登记的所有 `requestDomains`、`mediaDomains`、CSP 和 capability 字段均为“未填充，
不启用”。未提供实际、合法接口契约证据的适配器不得进入 capability、CSP、构建产物或
用户可见入口。

### 未启用占位示例

| 字段                | 占位值         |
| ------------------- | -------------- |
| `adapterId`         | 未填充，不启用 |
| `displayName`       | 未填充，不启用 |
| `feature`           | 未填充，不启用 |
| `userAuthorization` | 未填充，不启用 |
| `requestDomains`    | 未填充，不启用 |
| `mediaDomains`      | 未填充，不启用 |
| `cspDirectives`     | 未填充，不启用 |
| `tauriPermissions`  | 未填充，不启用 |
| `credentialStorage` | 未填充，不启用 |
| `enablement`        | 未填充，不启用 |
| `revocation`        | 未填充，不启用 |
| `timeoutAndErrors`  | 未填充，不启用 |
| `verification`      | 未填充，不启用 |

### 启用与撤销规则

1. 默认关闭：没有登记表、用户授权和测试证据时，不授予网络域名或适配器功能。
2. 精确启用：先为单个功能登记实际域名，再在对应 CSP 指令和 capability 中逐项加入；
   不使用协议、域名或 URL 通配。
3. 可见状态：启用、授权失效、超时、限流和服务不可用必须是用户可理解的状态，不能
   静默降级为失败。
4. 可撤销：用户禁用或注销时，清除该适配器会话材料与内存状态，并停止其功能入口；
   本地库、队列和本地播放保持可用。
5. 发布前验证：每项新增网络能力必须有接口契约测试、CSP/capability 回归测试、撤销
   测试和人工验收记录。

## 回归检查

`src/lib/__tests__/security-capabilities.test.ts` 固定检查：

- 宽泛 core/default、shell、默认 URL、OS 和通知 permission 不会重新加入。
- 本地 bridge 需要的精确 permission 仍然存在。
- 外链 scope 仅包含当前四个固定项目页面。
- 静态 asset scope 为空，CSP 来源集合不含通配网络协议或域名。
- 只有 `bridge-*.ts` 可以从 `@tauri-apps/api/core` 导入 `invoke`。

自动检查不能证明操作系统窗口中的实际媒体解码、原生目录选择或拖放行为。发布或合并
前仍须人工完成：选择本地目录并扫描、拖入本地目录并扫描、播放本地音频、确认封面
显示、检查队列上一首/下一首、修改设置后重启确认设置持久化。
