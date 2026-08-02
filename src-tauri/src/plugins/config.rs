/**
 * Module in charge of persisting and returning the config to/from the filesystem
 */
use home_config::HomeConfig;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::fmt::Display;
use std::{
    path::{Path, PathBuf},
    sync::RwLock,
};
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Manager, Runtime, State};
use ts_rs::TS;

use crate::libs::error::{AnyResult, MuseeksError};

pub const DEFAULT_LANGUAGE: &str = "zh-CN";
const SUPPORTED_LANGUAGES: [&str; 7] = ["zh-CN", "en", "fr", "ja", "ru", "zh-TW", "es"];
pub const ISOLATION_CONFIG_ROOT_ENV: &str = "YIFUMUSIC_CONFIG_ROOT";
const STAGE5_MOUNT_PREFIX: &str = "yifumusic-stage5-mount.";

#[derive(Debug, Clone)]
pub struct StorageDir {
    pub path: PathBuf,
    pub isolation_enabled: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../../src/generated/typings.ts")]
pub enum Repeat {
    All,
    One,
    None,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, TS)]
#[ts(export, export_to = "../../src/generated/typings.ts")]
#[serde(rename_all = "kebab-case")]
pub enum PlaybackMode {
    Sequential,
    Shuffle,
    RepeatOne,
    RepeatAll,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../../src/generated/typings.ts")]
pub enum SortBy {
    Artist,
    Album,
    Title,
    Duration,
    Genre,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../../src/generated/typings.ts")]
pub enum SortOrder {
    Asc,
    Dsc,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../../src/generated/typings.ts")]
pub enum DefaultView {
    Library,
    Artists,
    Playlists,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../../src/generated/typings.ts")]
#[serde(rename_all = "lowercase")]
pub enum TrackViewDensity {
    Normal,
    Compact,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../../src/generated/typings.ts")]
#[serde(default)]
pub struct Config {
    pub language: String,
    pub theme: String,
    pub ui_accent_color: Option<String>,
    pub liquid_glass: bool,
    pub dynamic_effects: bool,
    pub discover_character_visible: bool,
    pub audio_volume: f32,
    pub audio_playback_rate: Option<f32>,
    pub audio_follow_playing_track: bool,
    pub audio_muted: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio_playback_mode: Option<PlaybackMode>,
    // Retained only to migrate configurations written before Stage 3.
    pub audio_shuffle: bool,
    pub audio_repeat: Repeat,
    pub audio_stream_server: bool,
    pub default_view: DefaultView,
    pub library_sort_by: SortBy,
    pub library_sort_order: SortOrder,
    pub library_folders: Vec<PathBuf>,
    pub library_autorefresh: bool,
    pub sleepblocker: bool,
    pub auto_update_checker: bool,
    pub notifications: bool,
    pub status_bar_lyrics: bool,
    pub track_view_density: TrackViewDensity,
    pub wayland_compat: bool,
    #[serde(default)]
    pub menu_bar_visible: bool,
}

pub const SYSTEM_THEME: &str = "__system";

impl Default for Config {
    fn default() -> Self {
        Config {
            language: DEFAULT_LANGUAGE.to_owned(),
            theme: SYSTEM_THEME.to_owned(),
            ui_accent_color: None,
            liquid_glass: true,
            dynamic_effects: true,
            discover_character_visible: true,
            audio_volume: 1.0,
            audio_playback_rate: Some(1.0),
            audio_follow_playing_track: false,
            audio_muted: false,
            audio_playback_mode: Some(PlaybackMode::Sequential),
            audio_shuffle: false,
            audio_repeat: Repeat::None,
            #[cfg(target_os = "linux")]
            audio_stream_server: true,
            #[cfg(not(target_os = "linux"))]
            audio_stream_server: false,
            default_view: DefaultView::Library,
            library_sort_by: SortBy::Artist,
            library_sort_order: SortOrder::Asc,
            library_folders: vec![],
            library_autorefresh: false,
            sleepblocker: false,
            auto_update_checker: true,
            notifications: false,
            status_bar_lyrics: false,
            track_view_density: TrackViewDensity::Normal,
            wayland_compat: false,
            menu_bar_visible: false,
        }
    }
}

impl Config {
    pub fn normalize_language(&mut self) -> bool {
        let language = self.language.trim();
        if SUPPORTED_LANGUAGES.contains(&language) {
            if language == self.language {
                return false;
            }
            self.language = language.to_owned();
            return true;
        }

        self.language = DEFAULT_LANGUAGE.to_owned();
        true
    }

    pub fn resolved_playback_mode(&self) -> PlaybackMode {
        self.audio_playback_mode.unwrap_or({
            if self.audio_shuffle {
                PlaybackMode::Shuffle
            } else {
                match self.audio_repeat {
                    Repeat::One => PlaybackMode::RepeatOne,
                    Repeat::All => PlaybackMode::RepeatAll,
                    Repeat::None => PlaybackMode::Sequential,
                }
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{
        Config, DEFAULT_LANGUAGE, PlaybackMode, default_storage_dir, isolated_storage_dir_from,
        stage5_mount_root_from,
    };

    fn temporary_test_directory(name: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!(
            "yifumusic-storage-dir-test-{name}-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&path).expect("create storage directory test fixture");
        path
    }

    #[test]
    fn default_config_uses_simplified_chinese() {
        assert_eq!(Config::default().language, DEFAULT_LANGUAGE);
    }

    #[test]
    fn default_visual_settings_are_enabled() {
        let config = Config::default();

        assert!(config.liquid_glass);
        assert!(config.dynamic_effects);
        assert!(config.discover_character_visible);
    }

    #[test]
    fn language_migration_only_falls_back_for_invalid_values() {
        for language in ["en", "zh-CN"] {
            let mut config = Config::default();
            config.language = language.to_owned();
            assert!(!config.normalize_language());
            assert_eq!(config.language, language);
        }

        for language in ["", "  ", "de"] {
            let mut config = Config::default();
            config.language = language.to_owned();
            assert!(config.normalize_language());
            assert_eq!(config.language, DEFAULT_LANGUAGE);
        }
    }

    #[test]
    fn bundled_build_manifest_contains_only_build_identity_fields() {
        let manifest = include_str!(concat!(env!("OUT_DIR"), "/build-manifest.json"));
        let identity = super::build_identity().unwrap();

        for field in [
            "appVersion",
            "commitSha",
            "builtAt",
            "buildChannel",
            "targetTriple",
        ] {
            assert!(manifest.contains(field));
        }
        for sensitive_value in ["/Users/", "token", "cookie", "password", ".sqlite"] {
            assert!(!manifest.to_ascii_lowercase().contains(sensitive_value));
        }
        assert!(!identity.app_version.is_empty());
        assert!(!identity.target_triple.is_empty());
    }

    #[test]
    fn default_storage_dir_uses_the_platform_config_root() {
        let expected = dirs::config_dir()
            .expect("platform config directory")
            .join("yifumusic");

        assert_eq!(default_storage_dir(), expected);
    }

    #[test]
    fn storage_dir_accepts_only_a_distinct_temporary_override() {
        let root = temporary_test_directory("accepted");
        let isolated = root.join("isolated");
        let default = root.join("default");
        std::fs::create_dir_all(&isolated).expect("create isolated directory");
        std::fs::create_dir_all(&default).expect("create default directory");

        let resolved =
            isolated_storage_dir_from(Some(&isolated), &std::env::temp_dir(), &default, None);

        assert_eq!(resolved, Some(isolated.canonicalize().unwrap()));
        std::fs::remove_dir_all(root).expect("remove storage directory test fixture");
    }

    #[test]
    fn storage_dir_rejects_unsafe_overrides() {
        let root = temporary_test_directory("rejected");
        let isolated = root.join("isolated");
        let default = root.join("default");
        std::fs::create_dir_all(&isolated).expect("create isolated directory");
        std::fs::create_dir_all(&default).expect("create default directory");

        for override_path in [
            Path::new(""),
            Path::new("relative-state"),
            Path::new("/"),
            default.as_path(),
        ] {
            assert!(
                isolated_storage_dir_from(
                    Some(override_path),
                    &std::env::temp_dir(),
                    &default,
                    None,
                )
                .is_none(),
                "unsafe override should be rejected: {}",
                override_path.display()
            );
        }

        assert!(
            isolated_storage_dir_from(
                Some(&isolated),
                &std::env::temp_dir(),
                &default,
                Some(&isolated),
            )
            .is_none()
        );
        std::fs::remove_dir_all(root).expect("remove storage directory test fixture");
    }

    #[test]
    fn storage_dir_rejects_the_actual_platform_default_root() {
        let default = default_storage_dir();

        assert!(
            isolated_storage_dir_from(Some(&default), &std::env::temp_dir(), &default, None)
                .is_none()
        );
    }

    #[test]
    fn stage5_mount_root_accepts_exact_temporary_mount_layout() {
        let temp_root = std::env::temp_dir();
        let executable = temp_root
            .join("yifumusic-stage5-mount.fixture")
            .join("YifuMusic.app/Contents/MacOS/yifumusic");

        assert_eq!(
            stage5_mount_root_from(&executable, &temp_root),
            Some(temp_root.join("yifumusic-stage5-mount.fixture"))
        );
    }

    #[test]
    fn stage5_mount_root_rejects_non_stage5_paths() {
        let temp_root = std::env::temp_dir();
        let executable = temp_root
            .join("ordinary-mount")
            .join("YifuMusic.app/Contents/MacOS/yifumusic");

        assert!(stage5_mount_root_from(&executable, &temp_root).is_none());
    }

    #[test]
    fn legacy_config_maps_to_one_playback_mode() {
        let shuffle: Config = serde_json::from_value(serde_json::json!({
            "audio_shuffle": true,
            "audio_repeat": "All"
        }))
        .unwrap();
        assert_eq!(shuffle.audio_playback_mode, None);
        assert_eq!(shuffle.resolved_playback_mode(), PlaybackMode::Shuffle);

        let repeat_all: Config = serde_json::from_value(serde_json::json!({
            "audio_shuffle": false,
            "audio_repeat": "All"
        }))
        .unwrap();
        assert_eq!(repeat_all.resolved_playback_mode(), PlaybackMode::RepeatAll);
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../../src/generated/typings.ts")]
pub struct BuildIdentity {
    pub app_version: String,
    pub commit_sha: String,
    pub built_at: String,
    pub build_channel: String,
    pub target_triple: String,
    #[serde(default)]
    pub runtime_channel: String,
}

fn runtime_channel(build_channel: &str) -> String {
    let executable = std::env::current_exe().ok();
    let is_in = |prefix: &str| {
        executable
            .as_ref()
            .is_some_and(|path| path.starts_with(prefix))
    };

    if is_in("/Applications") {
        "installed".to_string()
    } else if is_in("/Volumes") {
        "mounted-dmg".to_string()
    } else if cfg!(debug_assertions) {
        "debug".to_string()
    } else {
        build_channel.to_owned()
    }
}

fn build_identity() -> AnyResult<BuildIdentity> {
    let mut build_identity: BuildIdentity = serde_json::from_str(include_str!(concat!(
        env!("OUT_DIR"),
        "/build-manifest.json"
    )))
    .map_err(config_err)?;
    build_identity.runtime_channel = runtime_channel(&build_identity.build_channel);
    Ok(build_identity)
}

#[derive(Debug)]
pub struct ConfigManager {
    manager: HomeConfig,
    pub data: RwLock<Config>,
}

impl ConfigManager {
    pub fn new(manager: HomeConfig, config: Config) -> Self {
        Self {
            manager,
            data: RwLock::new(config),
        }
    }
}

fn config_err<T: Display>(err: T) -> MuseeksError {
    MuseeksError::Config(format!("{}", err))
}

impl ConfigManager {
    pub fn get(&self) -> AnyResult<Config> {
        let lock = self.data.read().map_err(config_err)?;
        Ok(lock.clone())
    }

    pub fn update(&self, config: Config) -> AnyResult<()> {
        let mut writer = self.data.write().map_err(config_err)?;
        *writer = config;
        std::mem::drop(writer);
        self.save()
    }

    pub fn set_sleepblocker(&self, sleepblocker: bool) -> AnyResult<()> {
        let mut writer = self.data.write().map_err(config_err)?;
        writer.sleepblocker = sleepblocker;
        std::mem::drop(writer);
        self.save()
    }

    #[cfg(not(target_os = "macos"))]
    pub fn set_menu_bar_visible(&self, visible: bool) -> AnyResult<()> {
        let mut writer = self.data.write().map_err(config_err)?;
        writer.menu_bar_visible = visible;
        std::mem::drop(writer);
        self.save()
    }

    pub fn set_default_view(&self, default_view: DefaultView) -> AnyResult<()> {
        let mut writer = self.data.write().map_err(config_err)?;
        writer.default_view = default_view;
        std::mem::drop(writer);
        self.save()
    }

    fn save(&self) -> AnyResult<()> {
        let config = self.data.read().map_err(config_err)?;
        self.manager.save_toml(config.clone()).unwrap();
        info!("Config updated");
        Ok(())
    }
}

fn default_storage_dir() -> PathBuf {
    dirs::config_dir()
        .expect("Get config dir")
        .join("yifumusic")
}

fn isolated_storage_dir_from(
    configured_root: Option<&Path>,
    temporary_root: &Path,
    default_root: &Path,
    repository_root: Option<&Path>,
) -> Option<PathBuf> {
    let configured_root = configured_root?;
    if configured_root.as_os_str().is_empty() || !configured_root.is_absolute() {
        return None;
    }

    let configured_root = configured_root.canonicalize().ok()?;
    let temporary_root = temporary_root.canonicalize().ok()?;
    let default_root = default_root.canonicalize().ok();
    let repository_root = repository_root.and_then(|path| path.canonicalize().ok());

    if configured_root == temporary_root
        || !configured_root.starts_with(&temporary_root)
        || default_root.is_some_and(|path| configured_root == path)
        || repository_root.is_some_and(|path| configured_root.starts_with(path))
    {
        return None;
    }

    Some(configured_root)
}

fn stage5_mount_root_from(executable: &Path, temp_root: &Path) -> Option<PathBuf> {
    let mount_root = executable
        .parent()
        .and_then(Path::parent)
        .and_then(Path::parent)
        .and_then(Path::parent)?;
    let mount_name = mount_root.file_name()?.to_str()?;
    let mount_parent = mount_root.parent()?.canonicalize().ok()?;
    if mount_parent != temp_root.canonicalize().ok()?
        || !mount_name.starts_with(STAGE5_MOUNT_PREFIX)
    {
        return None;
    }

    Some(mount_root.to_owned())
}

pub fn resolve_storage_dir() -> StorageDir {
    let default_root = default_storage_dir();
    let configured_root = std::env::var_os(ISOLATION_CONFIG_ROOT_ENV).map(PathBuf::from);
    let storage_dir = isolated_storage_dir_from(
        configured_root.as_deref(),
        &std::env::temp_dir(),
        &default_root,
        std::env::current_dir().ok().as_deref(),
    );

    match storage_dir {
        Some(path) => StorageDir {
            path,
            isolation_enabled: true,
        },
        None => {
            if configured_root.is_some() {
                warn!(
                    "[isolation] rejected {ISOLATION_CONFIG_ROOT_ENV}; using the default storage root"
                );
            }
            StorageDir {
                path: default_root,
                isolation_enabled: false,
            }
        }
    }
}

/// LaunchServices may restart a mounted DMG executable without preserving the
/// launcher's environment. Only the launcher's private, named mountpoint gets
/// this deterministic fallback; installed and ordinary mounted apps do not.
pub fn apply_mounted_dmg_isolation() {
    let Ok(temp_root) = std::env::temp_dir().canonicalize() else {
        return;
    };
    let mut executable_candidates = Vec::with_capacity(2);
    if let Ok(executable) = std::env::current_exe() {
        executable_candidates.push(executable);
    }
    if let Some(argv0) = std::env::args_os().next() {
        let argv0 = PathBuf::from(argv0);
        if !executable_candidates.iter().any(|path| path == &argv0) {
            executable_candidates.push(argv0);
        }
    }
    let Some(mount_root) = executable_candidates
        .iter()
        .find_map(|path| stage5_mount_root_from(path, &temp_root))
    else {
        return;
    };
    let Some(mount_name) = mount_root.file_name().and_then(|name| name.to_str()) else {
        return;
    };

    let isolation_root = temp_root.join(format!("yifumusic-stage5-auto-{mount_name}"));
    let state_root = isolation_root.join("state");
    let home_root = isolation_root.join("home");
    if std::fs::create_dir_all(&state_root).is_err() || std::fs::create_dir_all(&home_root).is_err()
    {
        return;
    }

    unsafe {
        std::env::set_var(ISOLATION_CONFIG_ROOT_ENV, &state_root);
        std::env::set_var("HOME", &home_root);
        std::env::set_var("XDG_CONFIG_HOME", isolation_root.join("xdg/config"));
        std::env::set_var("XDG_DATA_HOME", isolation_root.join("xdg/data"));
        std::env::set_var("XDG_CACHE_HOME", isolation_root.join("xdg/cache"));
    }
}

/**
 * Get the app configuration/storage directory.
 *
 * The public bridge always returns the platform default location. A temporary
 * `YIFUMUSIC_CONFIG_ROOT` used for controlled native acceptance is never
 * exposed to the webview or persisted.
 */
#[tauri::command]
pub fn get_storage_dir() -> PathBuf {
    default_storage_dir()
}

#[tauri::command]
pub fn get_config(config_manager: State<ConfigManager>) -> AnyResult<Config> {
    config_manager.get()
}

#[tauri::command]
pub fn set_config(config_manager: State<ConfigManager>, config: Config) -> AnyResult<()> {
    config_manager.update(config)
}

pub fn init<R: Runtime>(config: ConfigManager) -> TauriPlugin<R> {
    // We need to inject the initial state of the config to the window object of
    // our webview, because some of our front-end modules are instantiated at
    // parsing time and require data that would otherwise only load-able asynchronously
    let initial_config_script = format!(
        r#"
            window.__MUSEEKS_INITIAL_CONFIG = {};
            window.__MUSEEKS_BUILD_IDENTITY = {};
            window.__MUSEEKS_PLATFORM = {:?};
        "#,
        serde_json::to_string(&config.get().unwrap()).unwrap(),
        serde_json::to_string(&build_identity().unwrap()).unwrap(),
        tauri_plugin_os::type_().to_string()
    );

    Builder::<R>::new("config")
        .invoke_handler(tauri::generate_handler![
            get_storage_dir,
            get_config,
            set_config,
        ])
        .js_init_script(initial_config_script)
        .setup(|app_handle, _api| {
            app_handle.manage(config);
            Ok(())
        })
        .build()
}
