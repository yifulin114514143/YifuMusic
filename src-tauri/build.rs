use std::{
    env, fs,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

fn build_channel() -> String {
    match env::var("YIFUMUSIC_BUILD_CHANNEL").as_deref() {
        Ok("debug") | Ok("local-dmg") | Ok("ci-artifact") => {
            env::var("YIFUMUSIC_BUILD_CHANNEL").unwrap()
        }
        _ if cfg!(debug_assertions) => "debug".to_string(),
        _ => "local-dmg".to_string(),
    }
}

fn git_commit() -> String {
    Command::new("git")
        .args(["rev-parse", "--short=12", "HEAD"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|commit| commit.trim().to_string())
        .filter(|commit| !commit.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}

fn write_build_manifest() {
    println!("cargo:rerun-if-env-changed=YIFUMUSIC_BUILD_CHANNEL");
    println!("cargo:rerun-if-changed=../.git/HEAD");

    let built_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock is before the Unix epoch")
        .as_secs();
    let manifest = format!(
        concat!(
            "{{\n",
            "  \"appVersion\": \"{}\",\n",
            "  \"commitSha\": \"{}\",\n",
            "  \"builtAt\": \"{}\",\n",
            "  \"buildChannel\": \"{}\",\n",
            "  \"targetTriple\": \"{}\"\n",
            "}}\n"
        ),
        env!("CARGO_PKG_VERSION"),
        git_commit(),
        built_at,
        build_channel(),
        env::var("TARGET").expect("Cargo must provide TARGET"),
    );
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").expect("Cargo must provide manifest dir");
    let resource_dir = std::path::Path::new(&manifest_dir).join("resources");
    fs::create_dir_all(&resource_dir).expect("create build manifest resource directory");
    fs::write(resource_dir.join("build-manifest.json"), &manifest)
        .expect("write bundled build manifest");
    fs::write(
        std::path::Path::new(&env::var("OUT_DIR").expect("Cargo must provide OUT_DIR"))
            .join("build-manifest.json"),
        manifest,
    )
    .expect("write embedded build manifest");
}

fn main() {
    write_build_manifest();
    // Build the app
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .codegen(tauri_build::CodegenContext::new())
            .plugin(
                "app-menu",
                tauri_build::InlinedPlugin::new().commands(&["show", "hide", "show_window"]),
            )
            .plugin(
                "config",
                tauri_build::InlinedPlugin::new().commands(&[
                    "get_storage_dir",
                    "get_config",
                    "set_config",
                ]),
            )
            .plugin(
                "cover",
                tauri_build::InlinedPlugin::new().commands(&["get_cover"]),
            )
            .plugin(
                "desktop-lyrics",
                tauri_build::InlinedPlugin::new().commands(&[
                    "open",
                    "sync_state",
                    "get_state",
                    "close",
                    "start_dragging",
                    "control",
                    "set_mouse_passthrough",
                    "get_window_geometry",
                    "update_window_geometry",
                    "set_always_on_top",
                    "set_resizable",
                ]),
            )
            .plugin(
                "lyrics",
                tauri_build::InlinedPlugin::new()
                    .commands(&["get_sibling_lyrics", "select_and_read"]),
            )
            .plugin(
                "tray",
                tauri_build::InlinedPlugin::new().commands(&["sync_state"]),
            )
            .plugin(
                "database",
                tauri_build::InlinedPlugin::new().commands(&[
                    "scan_library",
                    "get_all_tracks",
                    "remove_tracks",
                    "get_tracks",
                    "get_track",
                    "update_track",
                    "get_artists",
                    "get_artist_tracks",
                    "get_compilation_albums",
                    "has_compilations",
                    "get_all_playlists",
                    "get_playlist",
                    "create_playlist",
                    "rename_playlist",
                    "set_playlist_tracks",
                    "export_playlist",
                    "delete_playlist",
                    "reset",
                ]),
            )
            .plugin(
                "default-view",
                tauri_build::InlinedPlugin::new().commands(&["set"]),
            )
            .plugin(
                "media-controls",
                tauri_build::InlinedPlugin::new().commands(&[
                    "set_metadata",
                    "set_playback",
                    "clear",
                ]),
            )
            .plugin(
                "native-audio",
                tauri_build::InlinedPlugin::new().commands(&[
                    "load",
                    "play",
                    "pause",
                    "seek",
                    "get_state",
                    "set_volume",
                    "set_playback_rate",
                    "stop",
                ]),
            )
            .plugin(
                "sleepblocker",
                tauri_build::InlinedPlugin::new().commands(&["enable", "disable"]),
            ),
    )
    .expect("Failed to run tauri-build");
}
