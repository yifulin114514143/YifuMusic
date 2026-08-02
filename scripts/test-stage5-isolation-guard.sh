#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=stage5-isolation-guard.sh
source "$script_dir/stage5-isolation-guard.sh"

root="$(mktemp -d -t yifumusic-stage5-guard-test.XXXXXXXX)"
trap 'rm -rf "$root"' EXIT

protected_root="$root/protected"
mkdir -p "$protected_root"
printf 'language = "en"\n' >"$protected_root/config.toml"

snapshot_protected_root "$protected_root" "$root/before"
snapshot_protected_root "$protected_root" "$root/unchanged"
cmp -s "$root/before" "$root/unchanged"

printf 'language = "zh-CN"\n' >"$protected_root/config.toml"
snapshot_protected_root "$protected_root" "$root/after"
if assert_protected_root_unchanged "$root/before" "$root/after"; then
  printf 'expected protected root change assertion to fail after content changes\n' >&2
  exit 1
fi

rm "$protected_root/config.toml"
snapshot_protected_root "$protected_root" "$root/removed"
if assert_protected_root_unchanged "$root/after" "$root/removed"; then
  printf 'expected protected root change assertion to fail after file removal\n' >&2
  exit 1
fi

printf 'stage5 isolation guard tests passed\n'
