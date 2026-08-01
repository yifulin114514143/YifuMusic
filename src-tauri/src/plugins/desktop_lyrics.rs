use serde::{Deserialize, Serialize};
use std::sync::{Mutex, MutexGuard};
use std::time::Duration;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Runtime, State, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder,
};

use crate::libs::error::AnyResult;

const DESKTOP_LYRICS_WINDOW_LABEL: &str = "desktop-lyrics";
const DESKTOP_LYRICS_STATE_EVENT: &str = "desktop-lyrics:state";
const DESKTOP_LYRICS_ACTION_EVENT: &str = "desktop-lyrics:action";
const MIN_DESKTOP_LYRICS_WIDTH: f64 = 800.0;
const MIN_DESKTOP_LYRICS_HEIGHT: f64 = 128.0;

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopLyricLine {
    time_ms: Option<f64>,
    text: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum DesktopLyricsKind {
    Timed,
    Plain,
    #[default]
    Unavailable,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopLyricsPayload {
    track_id: Option<String>,
    title: String,
    artists: Vec<String>,
    album: String,
    current_time_seconds: f64,
    is_paused: bool,
    lyrics: Vec<DesktopLyricLine>,
    lyrics_kind: DesktopLyricsKind,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopLyricsControlsBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    device_pixel_ratio: f64,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopLyricsWindowGeometry {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    scale_factor: f64,
}

impl DesktopLyricsControlsBounds {
    fn contains_screen_point(
        &self,
        cursor_x: f64,
        cursor_y: f64,
        window_x: f64,
        window_y: f64,
    ) -> bool {
        if !self.x.is_finite()
            || !self.y.is_finite()
            || !self.width.is_finite()
            || !self.height.is_finite()
            || !self.device_pixel_ratio.is_finite()
            || self.width <= 0.0
            || self.height <= 0.0
            || self.device_pixel_ratio <= 0.0
        {
            return false;
        }

        let left = window_x + self.x * self.device_pixel_ratio;
        let top = window_y + self.y * self.device_pixel_ratio;
        let right = left + self.width * self.device_pixel_ratio;
        let bottom = top + self.height * self.device_pixel_ratio;

        cursor_x >= left && cursor_x <= right && cursor_y >= top && cursor_y <= bottom
    }
}

impl Default for DesktopLyricsPayload {
    fn default() -> Self {
        Self {
            track_id: None,
            title: String::new(),
            artists: Vec::new(),
            album: String::new(),
            current_time_seconds: 0.0,
            is_paused: true,
            lyrics: Vec::new(),
            lyrics_kind: DesktopLyricsKind::Unavailable,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
enum DesktopLyricsControl {
    Previous,
    PlayPause,
    Next,
}

struct DesktopLyricsState(Mutex<DesktopLyricsPayload>);

#[derive(Default)]
struct DesktopLyricsInteraction {
    mouse_passthrough_enabled: bool,
    controls_bounds: Option<DesktopLyricsControlsBounds>,
    is_ignoring_cursor_events: Option<bool>,
}

struct DesktopLyricsInteractionState(Mutex<DesktopLyricsInteraction>);

impl Default for DesktopLyricsState {
    fn default() -> Self {
        Self(Mutex::new(DesktopLyricsPayload::default()))
    }
}

fn lock(state: &DesktopLyricsState) -> AnyResult<MutexGuard<'_, DesktopLyricsPayload>> {
    state
        .0
        .lock()
        .map_err(|_| anyhow::anyhow!("Desktop lyrics state is unavailable").into())
}

fn lock_interaction(
    state: &DesktopLyricsInteractionState,
) -> AnyResult<MutexGuard<'_, DesktopLyricsInteraction>> {
    state
        .0
        .lock()
        .map_err(|_| anyhow::anyhow!("Desktop lyrics interaction state is unavailable").into())
}

fn ensure_desktop_lyrics_window<R: Runtime>(window: &WebviewWindow<R>) -> AnyResult<()> {
    ensure_desktop_lyrics_label(window.label())
}

fn ensure_desktop_lyrics_label(label: &str) -> AnyResult<()> {
    if label != DESKTOP_LYRICS_WINDOW_LABEL {
        return Err(anyhow::anyhow!("Desktop lyrics command was invoked by another window").into());
    }

    Ok(())
}

fn geometry_has_finite_positive_values(geometry: DesktopLyricsWindowGeometry) -> bool {
    geometry.x.is_finite()
        && geometry.y.is_finite()
        && geometry.width.is_finite()
        && geometry.height.is_finite()
        && geometry.width > 0.0
        && geometry.height > 0.0
}

fn clamp_geometry_to_work_area(
    geometry: DesktopLyricsWindowGeometry,
    work_area_x: f64,
    work_area_y: f64,
    work_area_width: f64,
    work_area_height: f64,
    scale_factor: f64,
) -> AnyResult<DesktopLyricsWindowGeometry> {
    if !geometry_has_finite_positive_values(geometry)
        || !work_area_x.is_finite()
        || !work_area_y.is_finite()
        || !work_area_width.is_finite()
        || !work_area_height.is_finite()
        || !scale_factor.is_finite()
        || work_area_width <= 0.0
        || work_area_height <= 0.0
        || scale_factor <= 0.0
    {
        return Err(anyhow::anyhow!("Desktop lyrics geometry contains invalid values").into());
    }

    let min_width = (MIN_DESKTOP_LYRICS_WIDTH * scale_factor).ceil();
    let min_height = (MIN_DESKTOP_LYRICS_HEIGHT * scale_factor).ceil();
    if min_width > work_area_width || min_height > work_area_height {
        return Err(
            anyhow::anyhow!("Desktop lyrics minimum size exceeds the monitor work area").into(),
        );
    }

    let width = geometry.width.clamp(min_width, work_area_width).round();
    let height = geometry.height.clamp(min_height, work_area_height).round();
    let x = geometry
        .x
        .clamp(work_area_x, work_area_x + work_area_width - width)
        .round();
    let y = geometry
        .y
        .clamp(work_area_y, work_area_y + work_area_height - height)
        .round();

    if x < f64::from(i32::MIN)
        || x > f64::from(i32::MAX)
        || y < f64::from(i32::MIN)
        || y > f64::from(i32::MAX)
        || width > f64::from(u32::MAX)
        || height > f64::from(u32::MAX)
    {
        return Err(anyhow::anyhow!("Desktop lyrics geometry exceeds native window limits").into());
    }

    Ok(DesktopLyricsWindowGeometry {
        x,
        y,
        width,
        height,
        scale_factor,
    })
}

fn read_window_geometry<R: Runtime>(
    window: &WebviewWindow<R>,
) -> AnyResult<DesktopLyricsWindowGeometry> {
    let position = window.outer_position()?;
    let size = window.outer_size()?;
    let scale_factor = window.scale_factor()?;
    if !scale_factor.is_finite() || scale_factor <= 0.0 {
        return Err(anyhow::anyhow!("Desktop lyrics window scale factor is invalid").into());
    }

    Ok(DesktopLyricsWindowGeometry {
        x: f64::from(position.x),
        y: f64::from(position.y),
        width: f64::from(size.width),
        height: f64::from(size.height),
        scale_factor,
    })
}

fn sync_mouse_passthrough<R: Runtime>(app_handle: &AppHandle<R>) {
    let Some(window) = app_handle.get_webview_window(DESKTOP_LYRICS_WINDOW_LABEL) else {
        return;
    };
    let interaction_state = app_handle.state::<DesktopLyricsInteractionState>();

    let should_ignore = {
        let interaction = match lock_interaction(&interaction_state) {
            Ok(interaction) => interaction,
            Err(_) => return,
        };

        if !interaction.mouse_passthrough_enabled {
            false
        } else if let Some(bounds) = interaction.controls_bounds.as_ref() {
            let cursor = match app_handle.cursor_position() {
                Ok(cursor) => cursor,
                Err(_) => return,
            };
            let outer_position = match window.outer_position() {
                Ok(position) => position,
                Err(_) => return,
            };

            !bounds.contains_screen_point(
                cursor.x,
                cursor.y,
                f64::from(outer_position.x),
                f64::from(outer_position.y),
            )
        } else {
            false
        }
    };

    let changed = {
        let mut interaction = match lock_interaction(&interaction_state) {
            Ok(interaction) => interaction,
            Err(_) => return,
        };
        if interaction.is_ignoring_cursor_events == Some(should_ignore) {
            false
        } else {
            interaction.is_ignoring_cursor_events = Some(should_ignore);
            true
        }
    };

    if changed
        && window.set_ignore_cursor_events(should_ignore).is_err()
        && let Ok(mut interaction) = lock_interaction(&interaction_state)
    {
        interaction.is_ignoring_cursor_events = None;
    }
}

fn disable_mouse_passthrough<R: Runtime>(app_handle: &AppHandle<R>) {
    let interaction_state = app_handle.state::<DesktopLyricsInteractionState>();
    if let Ok(mut interaction) = lock_interaction(&interaction_state) {
        interaction.mouse_passthrough_enabled = false;
        interaction.controls_bounds = None;
        interaction.is_ignoring_cursor_events = Some(false);
    }

    if let Some(window) = app_handle.get_webview_window(DESKTOP_LYRICS_WINDOW_LABEL) {
        let _ = window.set_ignore_cursor_events(false);
    }
}

#[tauri::command]
async fn open<R: Runtime>(app_handle: AppHandle<R>) -> AnyResult<()> {
    log::info!("Desktop lyrics open requested");
    disable_mouse_passthrough(&app_handle);

    if let Some(window) = app_handle.get_webview_window(DESKTOP_LYRICS_WINDOW_LABEL) {
        log::info!("Desktop lyrics window already exists; showing it");
        window.show()?;
        log::info!("Desktop lyrics window shown");
        return Ok(());
    }

    log::info!("Creating desktop lyrics window");
    let window = WebviewWindowBuilder::new(
        &app_handle,
        DESKTOP_LYRICS_WINDOW_LABEL,
        WebviewUrl::App("desktop-lyrics.html".into()),
    )
    .title("YifuMusic 桌面歌词")
    .inner_size(900.0, 180.0)
    .min_inner_size(800.0, 128.0)
    .resizable(true)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .visible_on_all_workspaces(true)
    .skip_taskbar(true)
    .shadow(false)
    .focused(false)
    .visible(false)
    .build()?;
    log::info!("Desktop lyrics window created");
    window.show()?;
    log::info!("Desktop lyrics window shown");

    Ok(())
}

#[tauri::command]
fn sync_state<R: Runtime>(
    app_handle: AppHandle<R>,
    state: State<'_, DesktopLyricsState>,
    payload: DesktopLyricsPayload,
) -> AnyResult<()> {
    *lock(&state)? = payload.clone();

    if app_handle
        .get_webview_window(DESKTOP_LYRICS_WINDOW_LABEL)
        .is_some()
    {
        app_handle.emit_to(
            DESKTOP_LYRICS_WINDOW_LABEL,
            DESKTOP_LYRICS_STATE_EVENT,
            payload,
        )?;
    }

    Ok(())
}

#[tauri::command]
fn get_state(state: State<'_, DesktopLyricsState>) -> AnyResult<DesktopLyricsPayload> {
    Ok(lock(&state)?.clone())
}

#[tauri::command]
fn close<R: Runtime>(window: WebviewWindow<R>) -> AnyResult<()> {
    ensure_desktop_lyrics_window(&window)?;
    window.set_ignore_cursor_events(false)?;
    window.close()?;
    Ok(())
}

#[tauri::command]
fn start_dragging<R: Runtime>(window: WebviewWindow<R>) -> AnyResult<()> {
    ensure_desktop_lyrics_window(&window)?;
    window.start_dragging()?;
    Ok(())
}

#[tauri::command]
fn control<R: Runtime>(
    app_handle: AppHandle<R>,
    window: WebviewWindow<R>,
    action: DesktopLyricsControl,
) -> AnyResult<()> {
    ensure_desktop_lyrics_window(&window)?;
    app_handle.emit_to("main", DESKTOP_LYRICS_ACTION_EVENT, action)?;
    Ok(())
}

#[tauri::command]
fn set_mouse_passthrough<R: Runtime>(
    app_handle: AppHandle<R>,
    state: State<'_, DesktopLyricsInteractionState>,
    window: WebviewWindow<R>,
    enabled: bool,
    controls_bounds: Option<DesktopLyricsControlsBounds>,
) -> AnyResult<()> {
    ensure_desktop_lyrics_window(&window)?;
    {
        let mut interaction = lock_interaction(&state)?;
        interaction.mouse_passthrough_enabled = enabled;
        interaction.controls_bounds = controls_bounds;
        interaction.is_ignoring_cursor_events = None;
    }

    sync_mouse_passthrough(&app_handle);
    Ok(())
}

#[tauri::command]
fn get_window_geometry<R: Runtime>(
    window: WebviewWindow<R>,
) -> AnyResult<DesktopLyricsWindowGeometry> {
    ensure_desktop_lyrics_window(&window)?;
    read_window_geometry(&window)
}

#[tauri::command]
fn update_window_geometry<R: Runtime>(
    window: WebviewWindow<R>,
    geometry: DesktopLyricsWindowGeometry,
) -> AnyResult<()> {
    ensure_desktop_lyrics_window(&window)?;
    let monitor = window
        .current_monitor()?
        .ok_or_else(|| anyhow::anyhow!("Desktop lyrics monitor is unavailable"))?;
    let work_area = monitor.work_area();
    let clamped = clamp_geometry_to_work_area(
        geometry,
        f64::from(work_area.position.x),
        f64::from(work_area.position.y),
        f64::from(work_area.size.width),
        f64::from(work_area.size.height),
        monitor.scale_factor(),
    )?;

    let current_size = window.outer_size()?;
    let requested_width = clamped.width as u32;
    let requested_height = clamped.height as u32;
    if current_size.width != requested_width || current_size.height != requested_height {
        window.set_size(PhysicalSize::new(requested_width, requested_height))?;
    }
    window.set_position(PhysicalPosition::new(clamped.x as i32, clamped.y as i32))?;
    Ok(())
}

#[tauri::command]
fn set_always_on_top<R: Runtime>(window: WebviewWindow<R>, always_on_top: bool) -> AnyResult<()> {
    ensure_desktop_lyrics_window(&window)?;
    window.set_always_on_top(always_on_top)?;
    Ok(())
}

#[tauri::command]
fn set_resizable<R: Runtime>(window: WebviewWindow<R>, resizable: bool) -> AnyResult<()> {
    ensure_desktop_lyrics_window(&window)?;
    window.set_resizable(resizable)?;
    Ok(())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("desktop-lyrics")
        .invoke_handler(tauri::generate_handler![
            open,
            sync_state,
            get_state,
            close,
            start_dragging,
            control,
            set_mouse_passthrough,
            get_window_geometry,
            update_window_geometry,
            set_always_on_top,
            set_resizable
        ])
        .setup(|app_handle, _api| {
            app_handle.manage(DesktopLyricsState::default());
            app_handle.manage(DesktopLyricsInteractionState(Mutex::new(
                DesktopLyricsInteraction::default(),
            )));

            let app_handle = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(Duration::from_millis(120)).await;
                    sync_mouse_passthrough(&app_handle);
                }
            });
            Ok(())
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::{
        DesktopLyricsControl, DesktopLyricsControlsBounds, DesktopLyricsKind, DesktopLyricsPayload,
        DesktopLyricsWindowGeometry, clamp_geometry_to_work_area, ensure_desktop_lyrics_label,
        geometry_has_finite_positive_values,
    };

    #[test]
    fn desktop_lyrics_payload_defaults_to_an_empty_paused_state() {
        let payload = DesktopLyricsPayload::default();

        assert_eq!(payload.track_id, None);
        assert_eq!(payload.current_time_seconds, 0.0);
        assert!(payload.is_paused);
        assert!(payload.lyrics.is_empty());
        assert!(matches!(
            payload.lyrics_kind,
            DesktopLyricsKind::Unavailable
        ));
    }

    #[test]
    fn desktop_lyrics_control_uses_the_frontend_action_names() {
        assert_eq!(
            serde_json::to_value(DesktopLyricsControl::PlayPause).unwrap(),
            "play-pause"
        );
    }

    #[test]
    fn desktop_lyrics_controls_bounds_uses_window_scale_factor() {
        let bounds = DesktopLyricsControlsBounds {
            x: 100.0,
            y: 8.0,
            width: 200.0,
            height: 36.0,
            device_pixel_ratio: 2.0,
        };

        assert!(bounds.contains_screen_point(420.0, 132.0, 200.0, 100.0));
        assert!(!bounds.contains_screen_point(398.0, 132.0, 200.0, 100.0));
    }

    #[test]
    fn desktop_lyrics_geometry_rejects_another_window_label() {
        assert!(ensure_desktop_lyrics_label("main").is_err());
        assert!(ensure_desktop_lyrics_label("desktop-lyrics").is_ok());
    }

    #[test]
    fn desktop_lyrics_geometry_rejects_non_finite_and_negative_sizes() {
        let non_finite = DesktopLyricsWindowGeometry {
            x: f64::NAN,
            y: 0.0,
            width: 900.0,
            height: 180.0,
            scale_factor: 1.0,
        };
        let negative = DesktopLyricsWindowGeometry {
            x: 0.0,
            y: 0.0,
            width: -1.0,
            height: 180.0,
            scale_factor: 1.0,
        };

        assert!(!geometry_has_finite_positive_values(non_finite));
        assert!(!geometry_has_finite_positive_values(negative));
    }

    #[test]
    fn desktop_lyrics_geometry_clamps_size_and_position_to_the_work_area() {
        let clamped = clamp_geometry_to_work_area(
            DesktopLyricsWindowGeometry {
                x: -200.0,
                y: 900.0,
                width: 4_000.0,
                height: 10.0,
                scale_factor: 1.0,
            },
            0.0,
            0.0,
            1_440.0,
            900.0,
            1.0,
        )
        .unwrap();

        assert_eq!(clamped.x, 0.0);
        assert_eq!(clamped.y, 772.0);
        assert_eq!(clamped.width, 1_440.0);
        assert_eq!(clamped.height, 128.0);
    }
}
