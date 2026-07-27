use std::env;

use home_config::HomeConfig;

use crate::plugins::config::Config;
use crate::{
    libs::error::AnyResult,
    plugins::config::{ConfigManager, get_storage_dir},
};

pub fn init() -> AnyResult<ConfigManager> {
    // Ensure Config is created and return it.
    let conf_path = get_storage_dir();
    let manager = HomeConfig::with_file(conf_path.join("config.toml"));
    let existing_config = manager.toml::<Config>();

    let config = match existing_config {
        Ok(config) => {
            // Backfill any missing keys populated by serde defaults.
            manager.save_toml(&config).unwrap();

            ConfigManager::new(manager, config)
        }
        Err(_) => {
            // The config does not exist, so let's instantiate it with defaults
            let default_config = Config::default();
            manager.save_toml(&default_config).unwrap();

            ConfigManager::new(manager, default_config)
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
