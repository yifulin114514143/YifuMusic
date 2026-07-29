use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU8, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use rodio::{Decoder, DeviceSinkBuilder, MixerDeviceSink, Player, Source};
use serde::Serialize;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime, State};

use crate::libs::error::AnyResult;

const TRACKER_ACTIVE: u8 = 0;
const TRACKER_ENDED: u8 = 1;
const TRACKER_FAILED: u8 = 2;
const EARLY_TERMINATION_MESSAGE: &str =
    "Native FLAC playback stopped before decoding its declared duration";

pub struct NativeAudioState(Mutex<NativeAudioStore>);

impl Default for NativeAudioState {
    fn default() -> Self {
        Self(Mutex::new(NativeAudioStore::default()))
    }
}

#[derive(Default)]
struct NativeAudioStore {
    active_request_id: u64,
    current: Option<NativeAudio>,
}

impl NativeAudioStore {
    fn replace_request(&mut self, request_id: u64) -> bool {
        if request_id <= self.active_request_id {
            return false;
        }

        self.active_request_id = request_id;
        if let Some(previous) = self.current.take() {
            previous.player.stop();
        }
        true
    }

    fn is_current_request(&self, request_id: u64) -> bool {
        self.active_request_id == request_id
    }

    fn install(&mut self, request_id: u64, native_audio: NativeAudio) -> bool {
        if !self.is_current_request(request_id) {
            native_audio.player.stop();
            return false;
        }

        if let Some(previous) = self.current.replace(native_audio) {
            previous.player.stop();
        }
        true
    }
}

struct NativeAudio {
    _device_sink: MixerDeviceSink,
    player: Player,
    duration: Duration,
    completion_tracker: Arc<CompletionTracker>,
}

struct CompletionTracker {
    decoded_samples: AtomicU64,
    expected_samples: u64,
    terminal: AtomicU8,
}

impl CompletionTracker {
    fn new(expected_samples: u64) -> Self {
        Self {
            decoded_samples: AtomicU64::new(0),
            expected_samples,
            terminal: AtomicU8::new(TRACKER_ACTIVE),
        }
    }

    fn record_sample(&self) {
        self.decoded_samples.fetch_add(1, Ordering::Relaxed);
    }

    fn seek_to_sample(&self, sample: u64) {
        self.decoded_samples.store(sample, Ordering::Release);
        self.terminal.store(TRACKER_ACTIVE, Ordering::Release);
    }

    fn finish(&self) {
        let terminal = if self.decoded_samples.load(Ordering::Acquire) >= self.expected_samples {
            TRACKER_ENDED
        } else {
            TRACKER_FAILED
        };
        let _ = self.terminal.compare_exchange(
            TRACKER_ACTIVE,
            terminal,
            Ordering::AcqRel,
            Ordering::Acquire,
        );
    }

    fn terminal_state(&self, player_empty: bool, is_paused: bool) -> NativeAudioTerminalState {
        match self.terminal.load(Ordering::Acquire) {
            TRACKER_ENDED => NativeAudioTerminalState::Ended,
            TRACKER_FAILED => NativeAudioTerminalState::Failed {
                message: EARLY_TERMINATION_MESSAGE.into(),
            },
            _ if player_empty => NativeAudioTerminalState::Failed {
                message: EARLY_TERMINATION_MESSAGE.into(),
            },
            _ if is_paused => NativeAudioTerminalState::Paused,
            _ => NativeAudioTerminalState::Playing,
        }
    }
}

struct CompletionTrackingSource<S> {
    source: S,
    completion_tracker: Arc<CompletionTracker>,
}

impl<S> CompletionTrackingSource<S> {
    fn new(source: S, completion_tracker: Arc<CompletionTracker>) -> Self {
        Self {
            source,
            completion_tracker,
        }
    }
}

impl<S: Source> Iterator for CompletionTrackingSource<S> {
    type Item = S::Item;

    fn next(&mut self) -> Option<Self::Item> {
        let sample = self.source.next();
        if sample.is_some() {
            self.completion_tracker.record_sample();
        } else {
            self.completion_tracker.finish();
        }
        sample
    }
}

impl<S: Source> Source for CompletionTrackingSource<S> {
    fn current_span_len(&self) -> Option<usize> {
        self.source.current_span_len()
    }

    fn channels(&self) -> rodio::ChannelCount {
        self.source.channels()
    }

    fn sample_rate(&self) -> rodio::SampleRate {
        self.source.sample_rate()
    }

    fn total_duration(&self) -> Option<Duration> {
        self.source.total_duration()
    }

    fn try_seek(&mut self, position: Duration) -> Result<(), rodio::source::SeekError> {
        self.source.try_seek(position)?;
        self.completion_tracker.seek_to_sample(samples_at_position(
            position,
            self.source.sample_rate().get(),
            self.source.channels().get(),
        ));
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum NativeAudioTerminalState {
    Playing,
    Paused,
    Ended,
    Failed { message: String },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAudioSnapshot {
    position: f64,
    duration: f64,
    is_paused: bool,
    terminal_state: NativeAudioTerminalState,
}

fn lock(state: &NativeAudioState) -> AnyResult<MutexGuard<'_, NativeAudioStore>> {
    state
        .0
        .lock()
        .map_err(|_| anyhow::anyhow!("Native audio state is unavailable").into())
}

fn validate_flac_path(path: &Path, is_authorized: bool) -> AnyResult<()> {
    let is_flac = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("flac"));

    if !is_flac {
        return Err(anyhow::anyhow!("Native audio playback supports FLAC files only").into());
    }
    if !is_authorized {
        return Err(anyhow::anyhow!("Native audio path is not authorized").into());
    }

    Ok(())
}

fn get_authorized_flac_path<R: Runtime>(
    app_handle: &AppHandle<R>,
    path: String,
) -> AnyResult<PathBuf> {
    let path = PathBuf::from(path);
    validate_flac_path(&path, app_handle.asset_protocol_scope().is_allowed(&path))?;
    Ok(path)
}

fn samples_at_position(position: Duration, sample_rate: u32, channels: u16) -> u64 {
    let frames = (position.as_nanos() * u128::from(sample_rate) + 500_000_000) / 1_000_000_000;
    u64::try_from(frames)
        .unwrap_or(u64::MAX)
        .saturating_mul(u64::from(channels))
}

fn create_decoder(
    path: &Path,
) -> AnyResult<(Decoder<BufReader<File>>, Duration, Arc<CompletionTracker>)> {
    let file = File::open(path)?;
    let decoder = Decoder::try_from(file)
        .map_err(|error| anyhow::anyhow!("Failed to decode FLAC: {error}"))?;
    let duration = decoder
        .total_duration()
        .ok_or_else(|| anyhow::anyhow!("FLAC duration is unavailable"))?;
    let expected_samples = samples_at_position(
        duration,
        decoder.sample_rate().get(),
        decoder.channels().get(),
    );

    Ok((
        decoder,
        duration,
        Arc::new(CompletionTracker::new(expected_samples)),
    ))
}

fn snapshot(native_audio: &NativeAudio) -> NativeAudioSnapshot {
    let terminal_state = native_audio
        .completion_tracker
        .terminal_state(native_audio.player.empty(), native_audio.player.is_paused());
    NativeAudioSnapshot {
        position: if terminal_state == NativeAudioTerminalState::Ended {
            native_audio.duration.as_secs_f64()
        } else {
            native_audio.player.get_pos().as_secs_f64()
        },
        duration: native_audio.duration.as_secs_f64(),
        is_paused: native_audio.player.is_paused(),
        terminal_state,
    }
}

#[tauri::command]
fn load<R: Runtime>(
    app_handle: AppHandle<R>,
    state: State<'_, NativeAudioState>,
    path: String,
    request_id: u64,
) -> AnyResult<Option<NativeAudioSnapshot>> {
    if !lock(&state)?.is_current_request(request_id) {
        return Ok(None);
    }

    let path = get_authorized_flac_path(&app_handle, path)?;
    let (decoder, duration, completion_tracker) = create_decoder(&path)?;
    let mut device_sink = DeviceSinkBuilder::open_default_sink()
        .map_err(|error| anyhow::anyhow!("Failed to open the audio output: {error}"))?;
    device_sink.log_on_drop(false);
    let player = Player::connect_new(device_sink.mixer());
    player.pause();
    player.append(CompletionTrackingSource::new(
        decoder,
        completion_tracker.clone(),
    ));

    let native_audio = NativeAudio {
        _device_sink: device_sink,
        player,
        duration,
        completion_tracker,
    };
    let snapshot = snapshot(&native_audio);
    if !lock(&state)?.install(request_id, native_audio) {
        return Ok(None);
    }

    Ok(Some(snapshot))
}

#[tauri::command]
fn play(state: State<'_, NativeAudioState>, request_id: u64) -> AnyResult<bool> {
    let mut guard = lock(&state)?;
    if !guard.is_current_request(request_id) {
        return Ok(false);
    }
    let Some(native_audio) = guard.current.as_mut() else {
        return Ok(false);
    };
    native_audio.player.play();
    Ok(true)
}

#[tauri::command]
fn pause(state: State<'_, NativeAudioState>, request_id: u64) -> AnyResult<bool> {
    let mut guard = lock(&state)?;
    if !guard.is_current_request(request_id) {
        return Ok(false);
    }
    let Some(native_audio) = guard.current.as_mut() else {
        return Ok(false);
    };
    native_audio.player.pause();
    Ok(true)
}

#[tauri::command]
fn seek(
    state: State<'_, NativeAudioState>,
    position: f64,
    request_id: u64,
) -> AnyResult<Option<NativeAudioSnapshot>> {
    if !position.is_finite() || position < 0.0 {
        return Err(anyhow::anyhow!("Native audio seek position is invalid").into());
    }

    let mut guard = lock(&state)?;
    if !guard.is_current_request(request_id) {
        return Ok(None);
    }
    let Some(native_audio) = guard.current.as_mut() else {
        return Ok(None);
    };
    native_audio
        .player
        .try_seek(Duration::from_secs_f64(
            position.min(native_audio.duration.as_secs_f64()),
        ))
        .map_err(|error| anyhow::anyhow!("Failed to seek FLAC: {error}"))?;

    Ok(Some(snapshot(native_audio)))
}

#[tauri::command]
fn get_state(
    state: State<'_, NativeAudioState>,
    request_id: u64,
) -> AnyResult<Option<NativeAudioSnapshot>> {
    let mut guard = lock(&state)?;
    if !guard.is_current_request(request_id) {
        return Ok(None);
    }
    Ok(guard
        .current
        .as_mut()
        .map(|native_audio| snapshot(native_audio)))
}

#[tauri::command]
fn set_volume(state: State<'_, NativeAudioState>, volume: f32, request_id: u64) -> AnyResult<bool> {
    let mut guard = lock(&state)?;
    if !guard.is_current_request(request_id) {
        return Ok(false);
    }
    let Some(native_audio) = guard.current.as_mut() else {
        return Ok(false);
    };
    native_audio.player.set_volume(volume.clamp(0.0, 1.0));
    Ok(true)
}

#[tauri::command]
fn set_playback_rate(
    state: State<'_, NativeAudioState>,
    rate: f32,
    request_id: u64,
) -> AnyResult<bool> {
    if !rate.is_finite() || !(0.5..=5.0).contains(&rate) {
        return Err(anyhow::anyhow!("Native audio playback rate is invalid").into());
    }

    let mut guard = lock(&state)?;
    if !guard.is_current_request(request_id) {
        return Ok(false);
    }
    let Some(native_audio) = guard.current.as_mut() else {
        return Ok(false);
    };
    native_audio.player.set_speed(rate);
    Ok(true)
}

#[tauri::command]
fn stop(state: State<'_, NativeAudioState>, request_id: u64) -> AnyResult<()> {
    lock(&state)?.replace_request(request_id);
    Ok(())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("native-audio")
        .invoke_handler(tauri::generate_handler![
            load,
            play,
            pause,
            seek,
            get_state,
            set_volume,
            set_playback_rate,
            stop,
        ])
        .setup(|app_handle, _api| {
            app_handle.manage(NativeAudioState::default());
            Ok(())
        })
        .build()
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    #[test]
    fn rejects_non_flac_paths() {
        let error = validate_flac_path(Path::new("/music/track.mp3"), true)
            .expect_err("an MP3 path must be rejected");

        assert!(
            error
                .to_string()
                .contains("Native audio playback supports FLAC files only")
        );
    }

    #[test]
    fn rejects_unauthorized_paths() {
        let error = validate_flac_path(Path::new("/music/track.flac"), false)
            .expect_err("an unauthorized FLAC path must be rejected");

        assert!(
            error
                .to_string()
                .contains("Native audio path is not authorized")
        );
    }

    #[test]
    fn reports_missing_and_corrupted_flac_files() {
        let missing = std::env::temp_dir().join(format!(
            "yifumusic-missing-native-audio-{}.flac",
            uuid::Uuid::new_v4()
        ));
        assert!(create_decoder(&missing).is_err());

        let corrupted = std::env::temp_dir().join(format!(
            "yifumusic-corrupted-native-audio-{}.flac",
            uuid::Uuid::new_v4()
        ));
        fs::write(&corrupted, b"not a FLAC file").expect("write corrupted FLAC fixture");
        let result = create_decoder(&corrupted);
        fs::remove_file(&corrupted).expect("remove corrupted FLAC fixture");

        assert!(result.is_err());
    }

    #[test]
    fn distinguishes_natural_completion_from_early_termination() {
        let completed = CompletionTracker::new(4);
        for _ in 0..4 {
            completed.record_sample();
        }
        completed.finish();
        assert_eq!(
            completed.terminal_state(true, false),
            NativeAudioTerminalState::Ended
        );

        let interrupted = CompletionTracker::new(4);
        interrupted.record_sample();
        interrupted.finish();
        assert_eq!(
            interrupted.terminal_state(true, false),
            NativeAudioTerminalState::Failed {
                message: EARLY_TERMINATION_MESSAGE.into(),
            }
        );
    }

    #[test]
    fn newer_requests_prevent_older_requests_from_installing() {
        let mut store = NativeAudioStore::default();
        assert!(store.replace_request(1));
        assert!(store.is_current_request(1));

        assert!(store.replace_request(2));
        assert!(!store.is_current_request(1));
        assert!(store.is_current_request(2));
        assert!(!store.replace_request(1));
    }
}
