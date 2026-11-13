#!/usr/bin/env bash
set -euo pipefail

checkpoint_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$checkpoint_dir/../../scripts/lib/assertions.sh"

binary="$checkpoint_dir/target/debug/mini-container"
usage="uso: mini-container run <programa> [argumentos...]"

snapshot_host_state

assert_exit_code 3 "el hijo sale con 3" "$binary" run /bin/sh -c 'exit 3'

echoed=$("$binary" run /bin/echo hola)
assert_equals "hola" "$echoed" "el hijo imprime hola"

status=0
stderr=$("$binary" 2>&1 >/dev/null) || status=$?
assert_equals "$usage" "$stderr" "sin argumentos imprime el uso por stderr"
assert_equals 2 "$status" "sin argumentos sale con 2"

assert_exit_code 137 "un hijo muerto por SIGKILL sale con 137" "$binary" run /bin/sh -c 'kill -9 $$'

assert_host_unchanged
