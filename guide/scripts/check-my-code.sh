#!/usr/bin/env bash
set -euo pipefail

scripts_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(cd "$scripts_dir/../.." && pwd -P)
checkpoint_id=${1:?"usage: sudo guide/scripts/check-my-code.sh <id>"}
accept_script="$repo_root/guide/checkpoints/$checkpoint_id/accept.sh"
student_binary="$repo_root/target/debug/mini-container"

stop() {
  printf '%s\n' "$1" >&2
  exit 1
}

[ "$(uname -s)" = "Linux" ] || stop "run it inside the Linux machine"
[ "$(id -u)" -eq 0 ] || stop "run it as root: sudo guide/scripts/check-my-code.sh $checkpoint_id"
[ "$(pwd -P)" = "$repo_root" ] || stop "run it from the root of the repo: cd $repo_root"
[ -f "$accept_script" ] || stop "checkpoint $checkpoint_id does not exist"
[ -x "$student_binary" ] || stop "$student_binary does not exist: run cargo build first, because sudo has no cargo"

MINI_CONTAINER_BIN="$student_binary" "$accept_script"

echo "OK $checkpoint_id"
