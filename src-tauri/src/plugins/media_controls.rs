use std::sync::{Mutex, MutexGuard};
use std::time::Duration;

use log::warn;
use serde::{Deserialize, Serialize};
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use crate::libs::error::AnyResult;

#[cfg(target_os = "macos")]
use souvlaki::{
    MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, MediaPosition, PlatformConfig,
};
#[cfg(target_os = "macos")]
use url::Url;

const MEDIA_CONTROL_COMMAND_EVENT: &str = "media-controls://command";
#[cfg(not(target_os = "macos"))]
const UNSUPPORTED_PLATFORM_REASON: &str =
    "Native media controls are unavailable on this platform in the current build";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
enum MediaControlCommand {
    Play,
    Pause,
    Previous,
    Next,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MediaControlsMetadata {
    session_id: u64,
    title: String,
    artist: String,
    album: String,
    duration: Option<f64>,
    track_path: String,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum PlaybackState {
    Playing,
    Paused,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MediaControlsPlayback {
    session_id: u64,
    state: PlaybackState,
    position: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct MediaControlsUpdateResult {
    supported: bool,
    applied: bool,
    reason: Option<String>,
}

impl MediaControlsUpdateResult {
    fn unavailable(reason: &str) -> Self {
        Self {
            supported: false,
            applied: false,
            reason: Some(reason.into()),
        }
    }

    fn ignored() -> Self {
        Self {
            supported: true,
            applied: false,
            reason: None,
        }
    }

    fn applied() -> Self {
        Self {
            supported: true,
            applied: true,
            reason: None,
        }
    }
}

#[derive(Default)]
struct MediaControlsSession {
    active_session_id: u64,
    is_active: bool,
    is_playing: bool,
}

impl MediaControlsSession {
    fn activate(&mut self, session_id: u64) -> bool {
        if session_id < self.active_session_id {
            return false;
        }
        if session_id == self.active_session_id {
            return self.is_active;
        }

        self.active_session_id = session_id;
        self.is_active = true;
        self.is_playing = false;
        true
    }

    fn update_playback(&mut self, session_id: u64, state: PlaybackState) -> bool {
        if session_id != self.active_session_id || !self.is_active {
            return false;
        }

        self.is_playing = state == PlaybackState::Playing;
        true
    }

    fn clear(&mut self, session_id: u64) -> bool {
        if session_id != self.active_session_id || !self.is_active {
            return false;
        }

        self.is_active = false;
        self.is_playing = false;
        true
    }
}

pub struct MediaControlsState {
    session: Mutex<MediaControlsSession>,
    #[cfg(target_os = "macos")]
    controls: Mutex<Option<MediaControls>>,
    #[cfg(not(target_os = "macos"))]
    unavailable_reason: &'static str,
}

impl MediaControlsState {
    #[cfg(target_os = "macos")]
    fn new<R: Runtime>(app_handle: &AppHandle<R>) -> Self {
        let state = Self {
            session: Mutex::new(MediaControlsSession::default()),
            controls: Mutex::new(None),
        };

        let mut controls = match MediaControls::new(PlatformConfig {
            display_name: "YifuMusic",
            dbus_name: "com.yifulin114514143.yifumusic",
            hwnd: None,
        }) {
            Ok(controls) => controls,
            Err(error) => {
                warn!("Native media controls are unavailable: {error}");
                return state;
            }
        };

        let event_handle = app_handle.clone();
        if let Err(error) = controls.attach(move |event| {
            let state = event_handle.state::<MediaControlsState>();
            let is_playing = match state.session.lock() {
                Ok(session) if session.is_active => session.is_playing,
                _ => return,
            };
            let Some(command) = map_media_control_event(event, is_playing) else {
                return;
            };

            if let Err(error) = event_handle.emit(MEDIA_CONTROL_COMMAND_EVENT, command) {
                warn!("Failed to forward a native media control command: {error}");
            }
        }) {
            warn!("Native media controls are unavailable: {error}");
            return state;
        }

        if let Ok(mut stored_controls) = state.controls.lock() {
            *stored_controls = Some(controls);
        }
        state
    }

    #[cfg(not(target_os = "macos"))]
    fn new<R: Runtime>(_app_handle: &AppHandle<R>) -> Self {
        Self {
            session: Mutex::new(MediaControlsSession::default()),
            unavailable_reason: UNSUPPORTED_PLATFORM_REASON,
        }
    }
}

fn lock_session(state: &MediaControlsState) -> AnyResult<MutexGuard<'_, MediaControlsSession>> {
    state
        .session
        .lock()
        .map_err(|_| anyhow::anyhow!("Native media controls state is unavailable").into())
}

#[cfg(target_os = "macos")]
fn map_media_control_event(
    event: MediaControlEvent,
    is_playing: bool,
) -> Option<MediaControlCommand> {
    match event {
        MediaControlEvent::Play => Some(MediaControlCommand::Play),
        MediaControlEvent::Pause | MediaControlEvent::Stop => Some(MediaControlCommand::Pause),
        MediaControlEvent::Toggle => Some(if is_playing {
            MediaControlCommand::Pause
        } else {
            MediaControlCommand::Play
        }),
        MediaControlEvent::Previous => Some(MediaControlCommand::Previous),
        MediaControlEvent::Next => Some(MediaControlCommand::Next),
        _ => None,
    }
}

fn duration_from_seconds(duration: Option<f64>) -> Option<Duration> {
    duration
        .filter(|duration| duration.is_finite() && *duration >= 0.0)
        .map(Duration::from_secs_f64)
}

fn position_from_seconds(position: f64) -> Option<Duration> {
    (position.is_finite() && position >= 0.0).then(|| Duration::from_secs_f64(position))
}

#[cfg(target_os = "macos")]
fn get_safe_cover_url<R: Runtime>(app_handle: &AppHandle<R>, track_path: &str) -> Option<String> {
    let track_path = std::path::PathBuf::from(track_path);
    let asset_protocol_scope = app_handle.asset_protocol_scope();
    if !asset_protocol_scope.is_allowed(&track_path) {
        return None;
    }

    let cover_path = crate::plugins::cover::get_cover_path_from_filesystem(&track_path)?;
    asset_protocol_scope.allow_file(&cover_path).ok()?;
    Url::from_file_path(cover_path).ok().map(Into::into)
}

#[tauri::command]
fn set_metadata<R: Runtime>(
    app_handle: AppHandle<R>,
    state: State<'_, MediaControlsState>,
    metadata: MediaControlsMetadata,
) -> AnyResult<MediaControlsUpdateResult> {
    if !lock_session(&state)?.activate(metadata.session_id) {
        return Ok(MediaControlsUpdateResult::ignored());
    }

    #[cfg(target_os = "macos")]
    {
        let cover_url = get_safe_cover_url(&app_handle, &metadata.track_path);
        let mut controls = state
            .controls
            .lock()
            .map_err(|_| anyhow::anyhow!("Native media controls are unavailable"))?;
        let Some(controls) = controls.as_mut() else {
            return Ok(MediaControlsUpdateResult::unavailable(
                "Native media controls could not be initialized",
            ));
        };
        controls
            .set_metadata(MediaMetadata {
                title: Some(&metadata.title),
                artist: Some(&metadata.artist),
                album: Some(&metadata.album),
                cover_url: cover_url.as_deref(),
                duration: duration_from_seconds(metadata.duration),
            })
            .map_err(|error| anyhow::anyhow!("Failed to update native media metadata: {error}"))?;
        Ok(MediaControlsUpdateResult::applied())
    }

    #[cfg(not(target_os = "macos"))]
    {
        drop(app_handle);
        drop(metadata);
        Ok(MediaControlsUpdateResult::unavailable(
            state.unavailable_reason,
        ))
    }
}

#[tauri::command]
fn set_playback(
    state: State<'_, MediaControlsState>,
    playback: MediaControlsPlayback,
) -> AnyResult<MediaControlsUpdateResult> {
    if position_from_seconds(playback.position).is_none() {
        return Err(anyhow::anyhow!("Native media controls position is invalid").into());
    }
    if !lock_session(&state)?.update_playback(playback.session_id, playback.state) {
        return Ok(MediaControlsUpdateResult::ignored());
    }

    #[cfg(target_os = "macos")]
    {
        let mut controls = state
            .controls
            .lock()
            .map_err(|_| anyhow::anyhow!("Native media controls are unavailable"))?;
        let Some(controls) = controls.as_mut() else {
            return Ok(MediaControlsUpdateResult::unavailable(
                "Native media controls could not be initialized",
            ));
        };
        let progress = position_from_seconds(playback.position).map(MediaPosition);
        let playback = match playback.state {
            PlaybackState::Playing => MediaPlayback::Playing { progress },
            PlaybackState::Paused => MediaPlayback::Paused { progress },
        };
        controls
            .set_playback(playback)
            .map_err(|error| anyhow::anyhow!("Failed to update native media playback: {error}"))?;
        Ok(MediaControlsUpdateResult::applied())
    }

    #[cfg(not(target_os = "macos"))]
    Ok(MediaControlsUpdateResult::unavailable(
        state.unavailable_reason,
    ))
}

#[tauri::command]
fn clear(
    state: State<'_, MediaControlsState>,
    session_id: u64,
) -> AnyResult<MediaControlsUpdateResult> {
    if !lock_session(&state)?.clear(session_id) {
        return Ok(MediaControlsUpdateResult::ignored());
    }

    #[cfg(target_os = "macos")]
    {
        let mut controls = state
            .controls
            .lock()
            .map_err(|_| anyhow::anyhow!("Native media controls are unavailable"))?;
        let Some(controls) = controls.as_mut() else {
            return Ok(MediaControlsUpdateResult::unavailable(
                "Native media controls could not be initialized",
            ));
        };
        controls
            .set_playback(MediaPlayback::Stopped)
            .map_err(|error| anyhow::anyhow!("Failed to clear native media playback: {error}"))?;
        controls
            .set_metadata(MediaMetadata::default())
            .map_err(|error| anyhow::anyhow!("Failed to clear native media metadata: {error}"))?;
        Ok(MediaControlsUpdateResult::applied())
    }

    #[cfg(not(target_os = "macos"))]
    Ok(MediaControlsUpdateResult::unavailable(
        state.unavailable_reason,
    ))
}

pub fn clear_on_exit<R: Runtime>(app_handle: &AppHandle<R>) {
    let state = app_handle.state::<MediaControlsState>();
    if let Ok(mut session) = state.session.lock() {
        session.is_active = false;
        session.is_playing = false;
    }

    #[cfg(target_os = "macos")]
    if let Ok(mut controls) = state.controls.lock()
        && let Some(controls) = controls.as_mut()
    {
        let _ = controls.set_playback(MediaPlayback::Stopped);
        let _ = controls.set_metadata(MediaMetadata::default());
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("media-controls")
        .invoke_handler(tauri::generate_handler![set_metadata, set_playback, clear])
        .setup(|app_handle, _api| {
            app_handle.manage(MediaControlsState::new(app_handle));
            Ok(())
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_the_current_active_session() {
        let mut session = MediaControlsSession::default();
        assert!(session.activate(4));
        assert!(session.update_playback(4, PlaybackState::Playing));
        assert!(!session.activate(3));
        assert!(session.activate(5));
        assert!(!session.update_playback(4, PlaybackState::Paused));
        assert!(session.update_playback(5, PlaybackState::Paused));
    }

    #[test]
    fn clear_prevents_old_session_updates_from_reviving_now_playing() {
        let mut session = MediaControlsSession::default();
        assert!(session.activate(8));
        assert!(session.clear(8));
        assert!(!session.activate(8));
        assert!(!session.update_playback(8, PlaybackState::Playing));
        assert!(session.activate(9));
    }

    #[test]
    fn validates_media_duration_and_position() {
        assert_eq!(
            duration_from_seconds(Some(120.5)),
            Some(Duration::from_secs_f64(120.5))
        );
        assert_eq!(duration_from_seconds(Some(f64::NAN)), None);
        assert_eq!(duration_from_seconds(Some(-1.0)), None);
        assert_eq!(
            position_from_seconds(10.25),
            Some(Duration::from_secs_f64(10.25))
        );
        assert_eq!(position_from_seconds(f64::INFINITY), None);
        assert_eq!(position_from_seconds(-1.0), None);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn maps_system_events_to_the_supported_player_commands() {
        assert_eq!(
            map_media_control_event(MediaControlEvent::Play, false),
            Some(MediaControlCommand::Play)
        );
        assert_eq!(
            map_media_control_event(MediaControlEvent::Pause, true),
            Some(MediaControlCommand::Pause)
        );
        assert_eq!(
            map_media_control_event(MediaControlEvent::Toggle, false),
            Some(MediaControlCommand::Play)
        );
        assert_eq!(
            map_media_control_event(MediaControlEvent::Toggle, true),
            Some(MediaControlCommand::Pause)
        );
        assert_eq!(
            map_media_control_event(MediaControlEvent::Previous, false),
            Some(MediaControlCommand::Previous)
        );
        assert_eq!(
            map_media_control_event(MediaControlEvent::Next, false),
            Some(MediaControlCommand::Next)
        );
        assert_eq!(
            map_media_control_event(MediaControlEvent::Raise, false),
            None
        );
    }
}
