#!/usr/bin/env bash
set -euo pipefail

checkpoint_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$checkpoint_dir/../../scripts/lib/assertions.sh"

binary="$checkpoint_dir/target/debug/mini-container"
usage="usage: mini-container run <program> [args...]"
regular_user=${SUDO_USER:?"run it with sudo"}

capture_stderr() {
  status=0
  stderr=$("$@" 2>&1 >/dev/null) || status=$?
}

snapshot_host_state
machine_hostname=$(hostname)

assert_exit_code 3 "the child exits with 3" "$binary" run /bin/sh -c 'exit 3'

echoed=$("$binary" run /bin/echo hello)
assert_equals "hello" "$echoed" "the child prints hello"

capture_stderr "$binary"
assert_equals "$usage" "$stderr" "no arguments prints the usage on stderr"
assert_equals 2 "$status" "no arguments exits with 2"

capture_stderr "$binary" run
assert_equals "$usage" "$stderr" "run without a program prints the usage on stderr"
assert_equals 2 "$status" "run without a program exits with 2"

capture_stderr "$binary" run holaa
assert_contains "could not launch the program" "$stderr" "a missing program says it could not be launched"
assert_contains "No such file or directory (os error 2)" "$stderr" "a missing program shows the cause from the system"
assert_equals 1 "$status" "a missing program exits with 1"

assert_exit_code 137 "a child killed by SIGKILL exits with 137" "$binary" run /bin/sh -c 'kill -9 $$'

inside_hostname=$("$binary" run /bin/hostname)
assert_equals "container" "$inside_hostname" "the child sees its own hostname"
assert_equals "$machine_hostname" "$(hostname)" "the machine keeps its hostname"

capture_stderr sudo -u "$regular_user" "$binary" run /bin/hostname
assert_contains "did you run it with sudo?" "$stderr" "running without sudo says what is missing"
assert_contains "EPERM: Operation not permitted" "$stderr" "running without sudo shows the cause from the system"
assert_equals 1 "$status" "running without sudo exits with 1"

assert_host_unchanged
