# 阶段 3 原生媒体控制审计

## 结论

阶段 3 使用 `souvlaki 0.8.3` 作为原生媒体控制库。该库采用 MIT 许可，声明的最低 Rust
版本为 1.67；本项目使用 Rust 1.97.1，满足要求。macOS 后端通过公开的
`MediaControls` API 注册 `MPRemoteCommandCenter` 回调，并更新
`MPNowPlayingInfoCenter`；应用代码不直接声明或调用 Objective-C FFI。

`souvlaki` 的 `MediaControls` 公开 API 提供：

| 能力                    | 阶段 3 使用方式                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 接收系统命令            | `attach` 接收 `Play`、`Pause`、`Toggle`、`Previous`、`Next`；`Toggle` 依据当前会话状态转换为 `play` 或 `pause`。 |
| 更新 Now Playing 元数据 | `set_metadata` 写入曲名、艺术家、专辑、真实时长和安全可用的本地封面。                                            |
| 更新播放状态和位置      | `set_playback` 写入播放/暂停状态与当前位置。前端位置变化至少达到 1 秒才更新，seek、播放和暂停会强制立即更新。    |
| 停止/清理               | `clear` 写入 `Stopped` 和空元数据；应用退出的 `RunEvent::Exit` 也执行同样清理。                                  |

macOS 需要应用事件循环和 AppDelegate。YifuMusic 的 Tauri macOS 桌面运行时提供该事件循环。
该方案不需要新的 macOS entitlement、辅助进程、Shell、网络权限或 CSP 来源。

## 平台范围与降级

本阶段在 `Cargo.toml` 中把 `souvlaki` 限定为 `cfg(target_os = "macos")`：

| 平台    | 本构建行为                                                                                                                    |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| macOS   | 启用 `souvlaki` Now Playing 与 Remote Command。                                                                               |
| Linux   | 媒体控制 bridge 返回 `supported: false`，不影响本地播放器。后续若启用，可用该库的 MPRIS 后端并另行审计 D-Bus 名称和运行环境。 |
| Windows | 媒体控制 bridge 返回 `supported: false`，不影响本地播放器。后续若启用，必须从 Tauri 窗口取得库要求的 `HWND` 并另行审计。      |

若 macOS 初始化或命令更新失败，bridge 返回明确的 `supported: false` / 错误；播放器不因此终止或切换音频后端。

## 调用链与会话隔离

```text
实体媒体键
  -> souvlaki MediaControls::attach
  -> media-controls://command (play/pause/previous/next)
  -> MediaControlsBridge.listenToCommands
  -> IPCPlayerEvents
  -> player.play/pause/previous/next

Player 状态或曲目变化
  -> MediaControlsBridge.setMetadata/setPlayback/clear
  -> media-controls Rust plugin
  -> souvlaki MediaControls::set_metadata/set_playback
  -> macOS Now Playing
```

每次 `Player.setTrack()` 创建递增的 `sessionId`。Rust 仅接受当前活动会话：较旧会话的
元数据、位置、播放状态和 clear 请求都会被忽略；clear 后同一会话不能重新激活。因此快速
切歌、原生 FLAC 轮询回调、失败清理或异步封面解析都不能覆盖当前曲目的系统状态。

MP3 与 FLAC 均通过同一 `Player` 同步 metadata、播放状态和位置。FLAC 使用 Rodio 时的
真实 duration 与 position 来自既有 NativeAudioBridge，再写入同一个 media-controls bridge。

## 权限与文件边界

新增的 capability 仅有：

| Permission                          | bridge 调用                                 | 用户功能                                       | 安全理由                                                                                                     |
| ----------------------------------- | ------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `media-controls:allow-set-metadata` | `bridge-media-controls.ts` 的 `setMetadata` | 显示当前曲目、艺术家、专辑、时长和可用封面     | 仅接收播放器当前曲目的值；封面只在曲目路径已获 asset scope 授权后，扫描同目录支持格式并逐文件 `allow_file`。 |
| `media-controls:allow-set-playback` | `bridge-media-controls.ts` 的 `setPlayback` | 显示播放/暂停与当前位置                        | 仅接收有限播放状态和有限非负位置；旧 session 不生效。                                                        |
| `media-controls:allow-clear`        | `bridge-media-controls.ts` 的 `clear`       | 停止、错误、自然结束和退出时撤销旧 Now Playing | 仅接收当前 sessionId；不能清理或恢复另一个活动会话。                                                         |

没有添加 `shell:*`、网络/HTTP/HTTPS/任意 URL、宽泛文件系统权限，也没有修改 CSP 或
`assetProtocol.scope.allow`。`media_controls.rs` 不调用 `allow_directory`；封面只能由已授权
曲目路径的同目录解析得到，并以单文件授权传给系统图片加载器。嵌入式封面和无法构造本地
`file://` URL 的封面会被省略，而不会扩大访问范围。

## 自动化与人工验收

自动化覆盖 Rust 命令映射、metadata/position 有效性、会话清理和旧 session 隔离；前端覆盖
`play`、`pause`、`previous`、`next` 到唯一 Player 入口，以及 MP3/FLAC 的统一状态同步。

自动化不能证明 macOS 将 YifuMusic 选为实体媒体键当前目标。打包产物仍必须人工验证 MP3 与
FLAC 的播放/暂停、上一首、下一首、Now Playing 元数据、切歌/停止/损坏文件清理，以及不唤醒
Apple Music。
