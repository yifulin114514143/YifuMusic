use std::env;
use std::io::ErrorKind;
use std::path::Path;

use home_config::{HomeConfig, TomlParseError};

use crate::plugins::config::Config;
use crate::{libs::error::AnyResult, plugins::config::ConfigManager};

pub fn init(storage_dir: &Path) -> AnyResult<ConfigManager> {
    // Ensure Config is created and return it.
    let manager = HomeConfig::with_file(storage_dir.join("config.toml"));
    let existing_config = manager.toml::<Config>();

    let config = match existing_config {
        Ok(config) => {
            // Backfill missing keys and migrate the legacy playback pair.
            let mut config = config;
            let mut should_save = config.normalize_language();
            if config.audio_playback_mode.is_none() {
                config.audio_playback_mode = Some(config.resolved_playback_mode());
                should_save = true;
            }
            if should_save {
                manager
                    .save_toml(&config)
                    .map_err(|err| anyhow::anyhow!(format!("{err:?}")))?;
            }

            ConfigManager::new(manager, config)
        }
        Err(TomlParseError::Io(err)) if err.kind() == ErrorKind::NotFound => {
            // The config does not exist, so let's instantiate it with defaults
            let default_config = Config::default();
            manager
                .save_toml(&default_config)
                .map_err(|err| anyhow::anyhow!(format!("{err:?}")))?;

            ConfigManager::new(manager, default_config)
        }
        Err(err) => {
            return Err(anyhow::anyhow!(
                "Unable to read the existing configuration without replacing it: {err:?}"
            )
            .into());
        }
    };

    // Ensure Wayland compatibility fixes if the user requests them.
    if config.get()?.wayland_compat {
        unsafe {
            env::set_var("GDK_BACKEND", "x11");
            env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        }
    }

    Ok(config)
}
