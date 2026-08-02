use std::sync::Mutex;

use log::error;
use serde::Deserialize;
use tauri::{
    AppHandle, Emitter, Manager, Runtime, State,
    menu::{MenuBuilder, MenuItem, MenuItemBuilder},
    plugin::{Builder, TauriPlugin},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

use crate::{
    libs::{
        error::{AnyResult, MuseeksError},
        events::IPCEvent,
    },
    plugins::config::ConfigManager,
};

const TRAY_ICON_ID: &str = "yifumusic-tray";
const MENU_TRACK: &str = "yifumusic-tray-track";
const MENU_PREVIOUS: &str = "yifumusic-tray-previous";
const MENU_PLAY_PAUSE: &str = "yifumusic-tray-play-pause";
const MENU_NEXT: &str = "yifumusic-tray-next";
const MENU_SHOW_HIDE: &str = "yifumusic-tray-show-hide";
const MENU_QUIT: &str = "yifumusic-tray-quit";

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrayPayload {
    track_id: Option<String>,
    title: String,
    artists: Vec<String>,
    is_paused: bool,
    current_lyric: String,
}

struct TrayState<R: Runtime> {
    track_item: MenuItem<R>,
    previous_item: MenuItem<R>,
    play_pause_item: MenuItem<R>,
    next_item: MenuItem<R>,
    last_status_bar_lyric: Mutex<Option<String>>,
}

fn track_menu_text(payload: &TrayPayload) -> String {
    if payload.track_id.is_none() {
        return "暂无正在播放".to_owned();
    }

    if payload.artists.is_empty() {
        return payload.title.clone();
    }

    format!("{} — {}", payload.title, payload.artists.join(" / "))
}

fn play_pause_menu_text(is_paused: bool) -> &'static str {
    if is_paused { "播放" } else { "暂停" }
}

fn desired_status_bar_lyric(
    status_bar_lyrics_enabled: bool,
    payload: &TrayPayload,
) -> Option<String> {
    if !status_bar_lyrics_enabled || payload.track_id.is_none() {
        return None;
    }

    let lyric = payload.current_lyric.trim();
    (!lyric.is_empty()).then(|| lyric.to_owned())
}

fn toggle_main_window<R: Runtime>(app_handle: &AppHandle<R>) -> AnyResult<()> {
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| MuseeksError::Unknown(anyhow::anyhow!("Main window is unavailable")))?;

    if window.is_visible()? {
        #[cfg(target_os = "macos")]
        app_handle.hide()?;

        #[cfg(not(target_os = "macos"))]
        window.hide()?;

        return Ok(());
    }

    #[cfg(target_os = "macos")]
    app_handle.show()?;

    window.show()?;
    window.set_focus()?;
    Ok(())
}

fn emit_playback_event<R: Runtime>(app_handle: &AppHandle<R>, event: IPCEvent<'static>) {
    let Some(window) = app_handle.get_webview_window("main") else {
        return;
    };

    if let Err(err) = window.emit(event.as_ref(), ()) {
        error!("Failed to emit tray playback event: {err}");
    }
}

fn handle_tray_menu_event<R: Runtime>(app_handle: &AppHandle<R>, menu_id: &str) {
    match menu_id {
        MENU_PREVIOUS => emit_playback_event(app_handle, IPCEvent::PlaybackPrevious),
        MENU_PLAY_PAUSE => emit_playback_event(app_handle, IPCEvent::PlaybackPlayPause),
        MENU_NEXT => emit_playback_event(app_handle, IPCEvent::PlaybackNext),
        MENU_SHOW_HIDE => {
            if let Err(err) = toggle_main_window(app_handle) {
                error!("Failed to toggle the main window from the tray: {err}");
            }
        }
        MENU_QUIT => app_handle.exit(0),
        _ => {}
    }
}

#[cfg(target_os = "macos")]
fn sync_status_bar_lyric<R: Runtime>(
    app_handle: &AppHandle<R>,
    state: &TrayState<R>,
    status_bar_lyrics_enabled: bool,
    payload: &TrayPayload,
) -> AnyResult<()> {
    let lyric = desired_status_bar_lyric(status_bar_lyrics_enabled, payload);
    let mut previous_lyric = match state.last_status_bar_lyric.lock() {
        Ok(previous_lyric) => previous_lyric,
        Err(_) => return Ok(()),
    };

    if *previous_lyric == lyric {
        return Ok(());
    }

    if let Some(tray) = app_handle.tray_by_id(TRAY_ICON_ID) {
        tray.set_title(lyric.as_deref())?;
    }

    *previous_lyric = lyric;
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn sync_status_bar_lyric<R: Runtime>(
    _app_handle: &AppHandle<R>,
    _state: &TrayState<R>,
    _status_bar_lyrics_enabled: bool,
    _payload: &TrayPayload,
) -> AnyResult<()> {
    Ok(())
}

#[tauri::command]
fn sync_state<R: Runtime>(
    app_handle: AppHandle<R>,
    state: State<'_, TrayState<R>>,
    config_manager: State<'_, ConfigManager>,
    payload: TrayPayload,
) -> AnyResult<()> {
    let has_track = payload.track_id.is_some();
    state.track_item.set_text(track_menu_text(&payload))?;
    state.previous_item.set_enabled(has_track)?;
    state
        .play_pause_item
        .set_text(play_pause_menu_text(payload.is_paused))?;
    state.play_pause_item.set_enabled(has_track)?;
    state.next_item.set_enabled(has_track)?;

    sync_status_bar_lyric(
        &app_handle,
        &state,
        config_manager.get()?.status_bar_lyrics,
        &payload,
    )
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("tray")
        .invoke_handler(tauri::generate_handler![sync_state])
        .setup(|app_handle, _api| {
            let track_item = MenuItemBuilder::with_id(MENU_TRACK, "暂无正在播放")
                .enabled(false)
                .build(app_handle)?;
            let previous_item = MenuItemBuilder::with_id(MENU_PREVIOUS, "上一首")
                .enabled(false)
                .build(app_handle)?;
            let play_pause_item = MenuItemBuilder::with_id(MENU_PLAY_PAUSE, "播放")
                .enabled(false)
                .build(app_handle)?;
            let next_item = MenuItemBuilder::with_id(MENU_NEXT, "下一首")
                .enabled(false)
                .build(app_handle)?;
            let show_hide_item =
                MenuItemBuilder::with_id(MENU_SHOW_HIDE, "显示/隐藏主窗口").build(app_handle)?;
            let quit_item =
                MenuItemBuilder::with_id(MENU_QUIT, "退出 YifuMusic").build(app_handle)?;

            let menu = MenuBuilder::new(app_handle)
                .item(&track_item)
                .separator()
                .item(&previous_item)
                .item(&play_pause_item)
                .item(&next_item)
                .separator()
                .item(&show_hide_item)
                .separator()
                .item(&quit_item)
                .build()?;
            let icon = app_handle
                .default_window_icon()
                .cloned()
                .ok_or_else(|| anyhow::anyhow!("Default window icon is unavailable"))?;

            TrayIconBuilder::with_id(TRAY_ICON_ID)
                .icon(icon)
                .tooltip("YifuMusic")
                .show_menu_on_left_click(false)
                .menu(&menu)
                .on_menu_event(|app_handle, event| {
                    handle_tray_menu_event(app_handle, event.id().as_ref());
                })
                .on_tray_icon_event(|tray, event| {
                    if matches!(
                        event,
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        }
                    ) && let Err(err) = toggle_main_window(tray.app_handle())
                    {
                        error!("Failed to toggle the main window from the tray: {err}");
                    }
                })
                .build(app_handle)?;

            app_handle.manage(TrayState {
                track_item,
                previous_item,
                play_pause_item,
                next_item,
                last_status_bar_lyric: Mutex::new(None),
            });
            Ok(())
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::{TrayPayload, desired_status_bar_lyric, play_pause_menu_text, track_menu_text};

    #[test]
    fn formats_current_track_for_the_tray_menu() {
        let payload = TrayPayload {
            track_id: Some("track-1".to_owned()),
            title: "测试曲目".to_owned(),
            artists: vec!["歌手甲".to_owned(), "歌手乙".to_owned()],
            is_paused: false,
            current_lyric: "当前歌词".to_owned(),
        };

        assert_eq!(track_menu_text(&payload), "测试曲目 — 歌手甲 / 歌手乙");
        assert_eq!(play_pause_menu_text(payload.is_paused), "暂停");
        assert_eq!(
            desired_status_bar_lyric(true, &payload),
            Some("当前歌词".to_owned())
        );
    }

    #[test]
    fn clears_status_bar_lyrics_without_a_playing_track_or_when_disabled() {
        let payload = TrayPayload {
            track_id: None,
            title: String::new(),
            artists: Vec::new(),
            is_paused: true,
            current_lyric: "旧歌词".to_owned(),
        };

        assert_eq!(track_menu_text(&payload), "暂无正在播放");
        assert_eq!(desired_status_bar_lyric(true, &payload), None);
        assert_eq!(desired_status_bar_lyric(false, &payload), None);
    }
}
