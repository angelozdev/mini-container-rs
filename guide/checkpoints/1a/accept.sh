#!/usr/bin/env bash
set -euo pipefail

checkpoint_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$checkpoint_dir/../../scripts/lib/assertions.sh"

binary="$checkpoint_dir/target/debug/mini-container"
usage="uso: mini-container run <programa> [argumentos...]"

capture_stderr() {
  status=0
  stderr=$("$@" 2>&1 >/dev/null) || status=$?
}

snapshot_host_state

assert_exit_code 3 "el hijo sale con 3" "$binary" run /bin/sh -c 'exit 3'

echoed=$("$binary" run /bin/echo hola)
assert_equals "hola" "$echoed" "el hijo imprime hola"

capture_stderr "$binary"
assert_equals "$usage" "$stderr" "sin argumentos imprime el uso por stderr"
assert_equals 2 "$status" "sin argumentos sale con 2"

capture_stderr "$binary" run
assert_equals "$usage" "$stderr" "run sin programa imprime el uso por stderr"
assert_equals 2 "$status" "run sin programa sale con 2"

capture_stderr "$binary" run holaa
assert_contains "no pude lanzar el programa" "$stderr" "un programa que no existe dice que no pudo lanzarlo"
assert_equals 1 "$status" "un programa que no existe sale con 1"

assert_exit_code 137 "un hijo muerto por SIGKILL sale con 137" "$binary" run /bin/sh -c 'kill -9 $$'

assert_host_unchanged
