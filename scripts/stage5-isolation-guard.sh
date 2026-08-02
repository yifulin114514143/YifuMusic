#!/usr/bin/env bash

set -euo pipefail

snapshot_protected_root() {
  local protected_root="$1"
  local snapshot_path="$2"

  if [[ ! -d "$protected_root" ]]; then
    printf 'Protected root does not exist: %s\n' "$protected_root" >&2
    return 1
  fi

  (
    cd "$protected_root"
    while IFS= read -r -d '' path; do
      local relative_path="${path#./}"
      if [[ -L "$path" ]]; then
        printf 'link\t%s\t%s\n' "$relative_path" "$(readlink "$path")"
      elif [[ -d "$path" ]]; then
        printf 'directory\t%s\t%s\n' "$relative_path" "$(stat -f '%m' "$path")"
      else
        printf 'file\t%s\t%s\t%s\t%s\n' \
          "$relative_path" \
          "$(stat -f '%z' "$path")" \
          "$(stat -f '%m' "$path")" \
          "$(shasum -a 256 "$path" | awk '{print $1}')"
      fi
    done < <(find . -mindepth 1 -print0 | LC_ALL=C sort -z)
  ) >"$snapshot_path"
}

assert_protected_root_unchanged() {
  local before_snapshot="$1"
  local after_snapshot="$2"

  if ! cmp -s "$before_snapshot" "$after_snapshot"; then
    printf 'Protected configuration root changed during isolated acceptance.\n' >&2
    return 1
  fi
}
