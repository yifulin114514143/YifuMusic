use serde::Serialize;
use std::path::{Component, Path, PathBuf};
use std::time::Duration;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_dialog::{DialogExt, FilePath};

use super::db::DBState;
use crate::libs::error::AnyResult;
use uuid::Uuid;

const MAX_LYRICS_FILE_SIZE_BYTES: u64 = 1_024 * 1_024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
enum LyricsSource {
    SiblingFile,
    UserFile,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "kebab-case")]
enum LyricsReadResult {
    Available { text: String, source: LyricsSource },
    Unavailable,
    Failed,
    Cancelled,
}

fn decode_lyrics_text(bytes: &[u8]) -> Result<String, ()> {
    match bytes {
        [0xEF, 0xBB, 0xBF, rest @ ..] => String::from_utf8(rest.to_vec()).map_err(|_| ()),
        [0xFF, 0xFE, rest @ ..] => decode_utf16(rest, true),
        [0xFE, 0xFF, rest @ ..] => decode_utf16(rest, false),
        _ => String::from_utf8(bytes.to_vec()).map_err(|_| ()),
    }
}

fn decode_utf16(bytes: &[u8], little_endian: bool) -> Result<String, ()> {
    if !bytes.len().is_multiple_of(2) {
        return Err(());
    }

    let units = bytes
        .chunks_exact(2)
        .map(|bytes| {
            if little_endian {
                u16::from_le_bytes([bytes[0], bytes[1]])
            } else {
                u16::from_be_bytes([bytes[0], bytes[1]])
            }
        })
        .collect::<Vec<_>>();

    String::from_utf16(&units).map_err(|_| ())
}

fn read_lyrics_file(path: &Path, source: LyricsSource) -> LyricsReadResult {
    if !has_supported_lyrics_extension(path) || !path.is_file() {
        return LyricsReadResult::Unavailable;
    }

    let Ok(metadata) = path.metadata() else {
        return LyricsReadResult::Failed;
    };
    if metadata.len() > MAX_LYRICS_FILE_SIZE_BYTES {
        return LyricsReadResult::Failed;
    }

    let Ok(bytes) = std::fs::read(path) else {
        return LyricsReadResult::Failed;
    };
    let Ok(text) = decode_lyrics_text(&bytes) else {
        return LyricsReadResult::Failed;
    };

    LyricsReadResult::Available { text, source }
}

fn read_user_selected_lyrics(file_path: Option<FilePath>) -> LyricsReadResult {
    match file_path {
        None => LyricsReadResult::Cancelled,
        Some(FilePath::Path(path)) if !has_supported_lyrics_extension(&path) => {
            LyricsReadResult::Unavailable
        }
        Some(FilePath::Path(path)) if !path.is_file() => LyricsReadResult::Failed,
        Some(FilePath::Path(path)) => read_lyrics_file(&path, LyricsSource::UserFile),
        _ => LyricsReadResult::Failed,
    }
}

async fn wait_for_dialog_result(
    result_receiver: tokio::sync::oneshot::Receiver<LyricsReadResult>,
    timeout: Duration,
) -> LyricsReadResult {
    tokio::time::timeout(timeout, result_receiver)
        .await
        .ok()
        .and_then(Result::ok)
        .unwrap_or(LyricsReadResult::Failed)
}

fn has_supported_lyrics_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| matches!(extension, "lrc" | "txt"))
}

fn track_id_for_verified_path(track_path: &Path) -> Option<String> {
    let canonicalized_path = track_path.canonicalize().ok()?;
    Some(
        Uuid::new_v3(
            &Uuid::NAMESPACE_OID,
            canonicalized_path.to_string_lossy().as_bytes(),
        )
        .to_string(),
    )
}

fn is_in_verified_track_directory(track_path: &Path, lyrics_path: &Path) -> bool {
    let Ok(track_path) = track_path.canonicalize() else {
        return false;
    };
    let Some(track_directory) = track_path.parent() else {
        return false;
    };
    let Ok(lyrics_path) = lyrics_path.canonicalize() else {
        return false;
    };

    lyrics_path
        .parent()
        .is_some_and(|parent| parent == track_directory)
}

fn matching_title_lyrics_path(track_path: &Path, title: &str) -> Option<PathBuf> {
    let directory = track_path.parent()?;
    let title_path = Path::new(title);
    let mut components = title_path.components();
    if !matches!(components.next(), Some(Component::Normal(_))) || components.next().is_some() {
        return None;
    }

    Some(directory.join(format!("{title}.lrc")))
}

fn read_same_name_sibling_lyrics(track_path: &Path) -> LyricsReadResult {
    for extension in ["lrc", "txt"] {
        let lyrics_path = track_path.with_extension(extension);
        if !lyrics_path.is_file() {
            continue;
        }
        if !is_in_verified_track_directory(track_path, &lyrics_path) {
            return LyricsReadResult::Unavailable;
        }

        // A present LRC, including a malformed one, takes precedence over TXT.
        return read_lyrics_file(&lyrics_path, LyricsSource::SiblingFile);
    }

    LyricsReadResult::Unavailable
}

#[tauri::command]
async fn get_sibling_lyrics<R: Runtime>(
    app_handle: AppHandle<R>,
    db_state: State<'_, DBState>,
    track_id: String,
) -> AnyResult<LyricsReadResult> {
    let track = match db_state.get_lock().await.get_track(&track_id).await {
        Ok(Some(track)) => track,
        Ok(None) => return Ok(LyricsReadResult::Unavailable),
        Err(_) => return Ok(LyricsReadResult::Failed),
    };
    let track_path = PathBuf::from(&track.path);
    let asset_protocol_scope = app_handle.asset_protocol_scope();

    if !asset_protocol_scope.is_allowed(&track_path) {
        return Ok(LyricsReadResult::Unavailable);
    }

    let Some(verified_track_id) = track_id_for_verified_path(&track_path) else {
        return Ok(LyricsReadResult::Unavailable);
    };
    if verified_track_id != track.id || verified_track_id != track_id {
        return Ok(LyricsReadResult::Unavailable);
    }

    let same_name_result = read_same_name_sibling_lyrics(&track_path);
    if !matches!(same_name_result, LyricsReadResult::Unavailable) {
        return Ok(same_name_result);
    }

    let Some(title_path) = matching_title_lyrics_path(&track_path, &track.title) else {
        return Ok(LyricsReadResult::Unavailable);
    };
    if !is_in_verified_track_directory(&track_path, &title_path) {
        return Ok(LyricsReadResult::Unavailable);
    }

    Ok(read_lyrics_file(&title_path, LyricsSource::SiblingFile))
}

#[tauri::command]
async fn select_and_read<R: Runtime>(app_handle: AppHandle<R>) -> AnyResult<LyricsReadResult> {
    let (result_sender, result_receiver) = tokio::sync::oneshot::channel();

    let mut dialog = app_handle
        .dialog()
        .file()
        .add_filter("Lyrics", &["lrc", "txt"]);

    if let Some(parent) = app_handle.get_webview_window("main") {
        dialog = dialog.set_parent(&parent);
    }

    dialog.pick_file(move |file_path| {
        let _ = result_sender.send(read_user_selected_lyrics(file_path));
    });

    Ok(wait_for_dialog_result(result_receiver, Duration::from_secs(120)).await)
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::<R>::new("lyrics")
        .invoke_handler(tauri::generate_handler![
            get_sibling_lyrics,
            select_and_read
        ])
        .build()
}

#[cfg(test)]
mod tests {
    use super::{
        LyricsReadResult, LyricsSource, decode_lyrics_text, has_supported_lyrics_extension,
        read_same_name_sibling_lyrics, read_user_selected_lyrics, wait_for_dialog_result,
    };
    use std::{
        path::{Path, PathBuf},
        time::Duration,
    };
    use tauri_plugin_dialog::FilePath;
    use uuid::Uuid;

    fn temporary_lyrics_path(extension: &str) -> PathBuf {
        std::env::temp_dir().join(format!("yifumusic-lyrics-{}.{}", Uuid::new_v4(), extension))
    }

    fn temporary_lyrics_directory() -> PathBuf {
        std::env::temp_dir().join(format!("yifumusic-lyrics-{}", Uuid::new_v4()))
    }

    fn write_track(directory: &Path) -> PathBuf {
        let track_path = directory.join("sample.mp3");
        std::fs::write(&track_path, "audio fixture").expect("write track fixture");
        track_path
    }

    #[test]
    fn decodes_utf8_and_utf8_bom() {
        assert_eq!(decode_lyrics_text(b"lyrics"), Ok("lyrics".to_string()));
        assert_eq!(
            decode_lyrics_text(&[0xEF, 0xBB, 0xBF, b'l', b'y', b'r', b'i', b'c', b's']),
            Ok("lyrics".to_string())
        );
    }

    #[test]
    fn decodes_utf16_little_and_big_endian_bom() {
        assert_eq!(
            decode_lyrics_text(&[0xFF, 0xFE, b'l', 0, b'y', 0]),
            Ok("ly".to_string())
        );
        assert_eq!(
            decode_lyrics_text(&[0xFE, 0xFF, 0, b'l', 0, b'y']),
            Ok("ly".to_string())
        );
    }

    #[test]
    fn rejects_invalid_text_without_returning_file_details() {
        assert_eq!(decode_lyrics_text(&[0xFF]), Err(()));
        assert_eq!(decode_lyrics_text(&[0xFF, 0xFE, 0x61]), Err(()));
    }

    #[test]
    fn only_accepts_supported_lyrics_extensions() {
        assert!(has_supported_lyrics_extension(Path::new("song.lrc")));
        assert!(has_supported_lyrics_extension(Path::new("song.txt")));
        assert!(!has_supported_lyrics_extension(Path::new("song.mp3")));
    }

    #[test]
    fn selected_lyrics_returns_available_only_for_a_supported_regular_file() {
        let selected_file = temporary_lyrics_path("lrc");
        std::fs::write(&selected_file, "[00:00.000]Selected lyrics").expect("write lyrics fixture");

        let result = read_user_selected_lyrics(Some(FilePath::Path(selected_file.clone())));
        std::fs::remove_file(&selected_file).expect("remove lyrics fixture");

        assert!(matches!(
            result,
            LyricsReadResult::Available {
                text,
                source: LyricsSource::UserFile,
            } if text == "[00:00.000]Selected lyrics"
        ));
    }

    #[test]
    fn selected_lyrics_returns_cancelled_when_the_dialog_is_closed() {
        assert!(matches!(
            read_user_selected_lyrics(None),
            LyricsReadResult::Cancelled
        ));
    }

    #[test]
    fn selected_lyrics_rejects_unsupported_files_without_returning_contents() {
        let unsupported_file = temporary_lyrics_path("mp3");
        std::fs::write(&unsupported_file, "must not be returned")
            .expect("write unsupported fixture");

        let result = read_user_selected_lyrics(Some(FilePath::Path(unsupported_file.clone())));
        std::fs::remove_file(&unsupported_file).expect("remove unsupported fixture");

        assert!(matches!(result, LyricsReadResult::Unavailable));
    }

    #[test]
    fn selected_lyrics_returns_failed_when_a_supported_file_cannot_be_read() {
        let missing_file = temporary_lyrics_path("txt");

        assert!(matches!(
            read_user_selected_lyrics(Some(FilePath::Path(missing_file))),
            LyricsReadResult::Failed
        ));
    }

    #[test]
    fn same_name_lrc_takes_priority_over_txt() {
        let directory = temporary_lyrics_directory();
        std::fs::create_dir(&directory).expect("create lyrics fixture directory");
        let track_path = write_track(&directory);
        std::fs::write(track_path.with_extension("lrc"), "[00:00.000]LRC")
            .expect("write LRC fixture");
        std::fs::write(track_path.with_extension("txt"), "TXT").expect("write TXT fixture");

        let result = read_same_name_sibling_lyrics(&track_path);
        std::fs::remove_dir_all(&directory).expect("remove lyrics fixture directory");

        assert!(matches!(
            result,
            LyricsReadResult::Available {
                text,
                source: LyricsSource::SiblingFile,
            } if text == "[00:00.000]LRC"
        ));
    }

    #[test]
    fn same_name_txt_is_available_when_lrc_is_absent() {
        let directory = temporary_lyrics_directory();
        std::fs::create_dir(&directory).expect("create lyrics fixture directory");
        let track_path = write_track(&directory);
        std::fs::write(track_path.with_extension("txt"), "First line\nSecond line")
            .expect("write TXT fixture");

        let result = read_same_name_sibling_lyrics(&track_path);
        std::fs::remove_dir_all(&directory).expect("remove lyrics fixture directory");

        assert!(matches!(
            result,
            LyricsReadResult::Available {
                text,
                source: LyricsSource::SiblingFile,
            } if text == "First line\nSecond line"
        ));
    }

    #[test]
    fn malformed_same_name_lrc_does_not_fall_back_to_txt() {
        let directory = temporary_lyrics_directory();
        std::fs::create_dir(&directory).expect("create lyrics fixture directory");
        let track_path = write_track(&directory);
        std::fs::write(track_path.with_extension("lrc"), [0xFF]).expect("write LRC fixture");
        std::fs::write(track_path.with_extension("txt"), "TXT").expect("write TXT fixture");

        let result = read_same_name_sibling_lyrics(&track_path);
        std::fs::remove_dir_all(&directory).expect("remove lyrics fixture directory");

        assert!(matches!(result, LyricsReadResult::Failed));
    }

    #[test]
    fn malformed_same_name_txt_returns_failed() {
        let directory = temporary_lyrics_directory();
        std::fs::create_dir(&directory).expect("create lyrics fixture directory");
        let track_path = write_track(&directory);
        std::fs::write(track_path.with_extension("txt"), [0xFF]).expect("write TXT fixture");

        let result = read_same_name_sibling_lyrics(&track_path);
        std::fs::remove_dir_all(&directory).expect("remove lyrics fixture directory");

        assert!(matches!(result, LyricsReadResult::Failed));
    }

    #[test]
    fn same_name_lookup_does_not_read_lyrics_from_another_directory() {
        let directory = temporary_lyrics_directory();
        let other_directory = temporary_lyrics_directory();
        std::fs::create_dir(&directory).expect("create track fixture directory");
        std::fs::create_dir(&other_directory).expect("create lyrics fixture directory");
        let track_path = write_track(&directory);
        std::fs::write(other_directory.join("sample.txt"), "TXT")
            .expect("write other-directory fixture");

        let result = read_same_name_sibling_lyrics(&track_path);
        std::fs::remove_dir_all(&directory).expect("remove track fixture directory");
        std::fs::remove_dir_all(&other_directory).expect("remove lyrics fixture directory");

        assert!(matches!(result, LyricsReadResult::Unavailable));
    }

    #[tokio::test]
    async fn dialog_wait_returns_selected_file_result() {
        let (sender, receiver) = tokio::sync::oneshot::channel();
        sender
            .send(LyricsReadResult::Available {
                text: "selected lyrics".to_string(),
                source: LyricsSource::UserFile,
            })
            .expect("send selected lyrics");

        assert!(matches!(
            wait_for_dialog_result(receiver, Duration::from_secs(1)).await,
            LyricsReadResult::Available {
                text,
                source: LyricsSource::UserFile,
            } if text == "selected lyrics"
        ));
    }

    #[tokio::test]
    async fn dialog_wait_returns_failed_when_native_callback_disconnects() {
        let (sender, receiver) = tokio::sync::oneshot::channel::<LyricsReadResult>();
        drop(sender);

        assert!(matches!(
            wait_for_dialog_result(receiver, Duration::from_secs(1)).await,
            LyricsReadResult::Failed
        ));
    }

    #[tokio::test]
    async fn dialog_wait_returns_failed_on_timeout() {
        let (_sender, receiver) = tokio::sync::oneshot::channel::<LyricsReadResult>();

        assert!(matches!(
            wait_for_dialog_result(receiver, Duration::ZERO).await,
            LyricsReadResult::Failed
        ));
    }
}
