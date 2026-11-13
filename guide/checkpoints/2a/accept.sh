#!/usr/bin/env bash
set -euo pipefail

checkpoint_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$checkpoint_dir/../../scripts/lib/assertions.sh"
source "$checkpoint_dir/../../scripts/lib/exercise-texts.sh"

binary="${MINI_CONTAINER_BIN:-$checkpoint_dir/target/debug/mini-container}"
usage="usage: mini-container run <program> [args...]"
missing_program=holaa
regular_user=${SUDO_USER:?"run it with sudo"}

capture_stderr() {
  status=0
  stderr=$("$@" 2>&1 >/dev/null) || status=$?
}

snapshot_host_state
machine_hostname=$(hostname)

assert_exit_code 3 "the child exits with 3" "$binary" run /bin/sh -c 'exit 3'

assert_stdout_equals hello "the child prints hello" "$binary" run /bin/echo hello

capture_stderr "$binary"
assert_equals "$usage" "$stderr" "no arguments prints the usage on stderr"
assert_equals 2 "$status" "no arguments exits with 2"

capture_stderr "$binary" run
assert_equals "$usage" "$stderr" "run without a program prints the usage on stderr"
assert_equals 2 "$status" "run without a program exits with 2"

capture_stderr "$binary" run "$missing_program"
assert_launch_error "$missing_program" "$stderr" "a missing program says it could not be launched"
assert_contains "No such file or directory (os error 2)" "$stderr" "a missing program shows the cause from the system"
assert_equals 1 "$status" "a missing program exits with 1"

assert_exit_code 137 "a child killed by SIGKILL exits with 137" "$binary" run /bin/sh -c 'kill -9 $$'

assert_stdout_equals container "the child sees its own hostname" "$binary" run /bin/hostname
assert_equals "$machine_hostname" "$(hostname)" "the machine keeps its hostname"

capture_stderr sudo -u "$regular_user" "$binary" run /bin/hostname
assert_contains "did you run it with sudo?" "$stderr" "running without sudo says what is missing"
assert_contains "EPERM: Operation not permitted" "$stderr" "running without sudo shows the cause from the system"
assert_equals 1 "$status" "running without sudo exits with 1"

assert_host_unchanged
