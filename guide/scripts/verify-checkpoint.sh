#!/usr/bin/env bash
set -euo pipefail

scripts_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
checkpoint_id=${1:?"usage: verify-checkpoint.sh <id>"}
checkpoint_dir="$scripts_dir/../checkpoints/$checkpoint_id"

[ "$(uname -s)" = "Linux" ] || { echo "run it inside the Linux machine" >&2; exit 1; }
[ -d "$checkpoint_dir" ] || { echo "checkpoint $checkpoint_id does not exist" >&2; exit 1; }

run_step() {
  printf '==> %s\n' "$*" >&2
  "$@"
}

cd "$checkpoint_dir"
run_step cargo fmt --check
run_step cargo clippy --locked --all-targets -- -D warnings
run_step cargo test --locked
run_step cargo build --locked
run_step sudo ./accept.sh

echo "OK $checkpoint_id"
