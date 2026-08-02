/**
 * Those are a bunch of Tauri plugins used to interact with the Operating Systems
 * features, like global menu, sleep-blocker, dock, thumbar, etc.
 *
 * It also holds the different DB creations and various helpers.
 */
pub mod debug;

/**
 * Core features
 */
pub mod app_close;
pub mod app_menu;
pub mod cover;
pub mod desktop_lyrics;
pub mod file_associations;
pub mod lyrics;
pub mod media_controls;

/**
 * Stores
 */
pub mod config;
pub mod db;

/**
 * Settings-related plugins
 */
pub mod default_view;
pub mod native_audio;
pub mod sleepblocker;
pub mod stream_server;
pub mod tray;
