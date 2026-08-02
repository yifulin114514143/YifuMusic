#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=stage5-isolation-guard.sh
source "$script_dir/stage5-isolation-guard.sh"

if [[ "$#" -ne 1 ]]; then
  printf 'Usage: %s /absolute/path/to/YifuMusic_0.23.4_aarch64.dmg\n' "$0" >&2
  exit 64
fi

dmg_path="$1"
if [[ ! -f "$dmg_path" || "$dmg_path" != /* ]]; then
  printf 'DMG must be an existing absolute path.\n' >&2
  exit 64
fi

real_config_root="$HOME/Library/Application Support/yifumusic"
real_config_mtime_before="absent"
real_config_snapshot_before=""
real_config_snapshot_after=""
if [[ -e "$real_config_root" ]]; then
  real_config_mtime_before="$(stat -f '%m' "$real_config_root")"
fi

if pgrep -x yifumusic >/dev/null 2>&1; then
  pkill -TERM -x yifumusic
  for _ in {1..15}; do
    pgrep -x yifumusic >/dev/null 2>&1 || break
    sleep 1
  done
fi

if pgrep -x yifumusic >/dev/null 2>&1; then
  printf 'A yifumusic process is still running; refusing isolated startup.\n' >&2
  exit 1
fi

mount_point="$(mktemp -d -t yifumusic-stage5-mount.XXXXXXXX)"
mount_name="$(basename "$mount_point")"
isolation_root="$(dirname "$mount_point")/yifumusic-stage5-auto-$mount_name"
state_root="$isolation_root/state"
home_root="$isolation_root/home"
mkdir -p "$state_root" "$home_root"
if [[ -d "$real_config_root" ]]; then
  real_config_snapshot_before="$isolation_root/real-config-before.snapshot"
  snapshot_protected_root "$real_config_root" "$real_config_snapshot_before"
fi

device=""
app_pid=""

cleanup() {
  local exit_code="$?"
  if [[ -n "$app_pid" ]] && kill -0 "$app_pid" >/dev/null 2>&1; then
    kill -TERM "$app_pid" >/dev/null 2>&1 || true
    wait "$app_pid" >/dev/null 2>&1 || true
  fi
  if [[ -n "$device" ]]; then
    hdiutil detach "$device" >/dev/null 2>&1 || hdiutil detach "$mount_point" >/dev/null 2>&1 || true
  else
    hdiutil detach "$mount_point" >/dev/null 2>&1 || true
  fi

  local real_config_mtime_after="absent"
  if [[ -e "$real_config_root" ]]; then
    real_config_mtime_after="$(stat -f '%m' "$real_config_root")"
  fi
  if [[ -n "$real_config_snapshot_before" ]]; then
    real_config_snapshot_after="$isolation_root/real-config-after.snapshot"
    snapshot_protected_root "$real_config_root" "$real_config_snapshot_after"
  fi
  printf 'REAL_CONFIG_MTIME_BEFORE=%s\n' "$real_config_mtime_before"
  printf 'REAL_CONFIG_MTIME_AFTER=%s\n' "$real_config_mtime_after"
  printf 'REAL_CONFIG_SNAPSHOT_BEFORE=%s\n' "${real_config_snapshot_before:-absent}"
  printf 'REAL_CONFIG_SNAPSHOT_AFTER=%s\n' "${real_config_snapshot_after:-absent}"
  printf 'ISOLATION_ROOT_RETAINED=%s\n' "$isolation_root"
  if [[ "$real_config_mtime_before" != "$real_config_mtime_after" ]]; then
    printf 'Real configuration mtime changed; isolated acceptance failed.\n' >&2
    exit 1
  fi
  if [[ -n "$real_config_snapshot_before" ]] \
    && ! assert_protected_root_unchanged "$real_config_snapshot_before" "$real_config_snapshot_after"; then
    exit 1
  fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

attach_output="$(hdiutil attach -nobrowse -readonly -mountpoint "$mount_point" "$dmg_path")"
device="$(awk '/^\/dev\// { print $1; exit }' <<<"$attach_output")"
if [[ -z "$device" ]]; then
  printf 'Could not determine the mounted DMG device.\n' >&2
  exit 1
fi

binary_path="$mount_point/YifuMusic.app/Contents/MacOS/yifumusic"
if [[ ! -x "$binary_path" ]]; then
  printf 'Mounted DMG does not contain the expected executable.\n' >&2
  exit 1
fi

launch_record="$isolation_root/launch-record.txt"
{
  printf 'DMG=%s\n' "$dmg_path"
  printf 'BINARY=%s\n' "$binary_path"
  printf 'HOME=%s\n' "$home_root"
  printf 'YIFUMUSIC_CONFIG_ROOT=%s\n' "$state_root"
  printf 'REAL_CONFIG_MTIME_BEFORE=%s\n' "$real_config_mtime_before"
} >"$launch_record"

env \
  HOME="$home_root" \
  XDG_CONFIG_HOME="$isolation_root/xdg/config" \
  XDG_DATA_HOME="$isolation_root/xdg/data" \
  XDG_CACHE_HOME="$isolation_root/xdg/cache" \
  YIFUMUSIC_CONFIG_ROOT="$state_root" \
  "$binary_path" >"$isolation_root/launcher.log" 2>&1 &
app_pid="$!"

for _ in {1..30}; do
  if [[ -f "$state_root/config.toml" && -f "$state_root/yifumusic.db" ]]; then
    break
  fi
  if ! kill -0 "$app_pid" >/dev/null 2>&1; then
    printf 'Candidate process exited before isolated config and database were created.\n' >&2
    exit 1
  fi
  sleep 1
done

if [[ ! -f "$state_root/config.toml" || ! -f "$state_root/yifumusic.db" ]]; then
  printf 'Timed out waiting for isolated config.toml and SQLite database.\n' >&2
  exit 1
fi

printf 'CANDIDATE_PID=%s\n' "$app_pid"
ps -p "$app_pid" -o pid=,ppid=,command=
printf 'ISOLATION_ROOT=%s\n' "$isolation_root"
printf 'CONFIG_PATH=%s\n' "$state_root/config.toml"
printf 'DATABASE_PATH=%s\n' "$state_root/yifumusic.db"
printf 'LAUNCH_RECORD=%s\n' "$launch_record"
printf 'The candidate is ready for native acceptance. Quit the app when finished.\n'

wait "$app_pid"
