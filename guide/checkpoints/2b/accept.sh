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

kill_child_from_outside() {
  "$binary" run /bin/sleep 30 &
  local launcher=$!
  local child attempts=0
  until child=$(pgrep -P "$launcher"); do
    attempts=$((attempts + 1))
    if [ "$attempts" -gt 50 ]; then
      kill "$launcher" 2>/dev/null || true
      fail "the launcher $launcher never started a child"
    fi
    sleep 0.1
  done
  kill -9 "$child"
  status=0
  wait "$launcher" || status=$?
}

snapshot_host_state
machine_hostname=$(hostname)
machine_mounts=$(findmnt -rn)

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
assert_contains 'could not run `holaa`' "$stderr" "a missing program says it could not be run"
assert_contains "No such file or directory (os error 2)" "$stderr" "a missing program shows the cause from the system"
assert_equals 1 "$status" "a missing program exits with 1"

kill_child_from_outside
assert_equals 137 "$status" "a child killed by SIGKILL from outside exits with 137"

inside_hostname=$("$binary" run /bin/hostname)
assert_equals "container" "$inside_hostname" "the child sees its own hostname"
assert_equals "$machine_hostname" "$(hostname)" "the machine keeps its hostname"

alone_in_namespace=$(unshare --mount "$binary" run /bin/hostname 2>&1 || true)
assert_equals "container" "$alone_in_namespace" "the program works when it is the only process of its mount namespace"

process_list=$("$binary" run /bin/ps -o pid,comm)
mapfile -t process_lines <<<"$process_list"
assert_equals 2 "${#process_lines[@]}" "the container lists only the header and one process"
assert_matches '^ *1 ps$' "${process_lines[1]}" "the program is the PID 1 of the container"

assert_greater_than 5 "$(ps -e --no-headers | wc -l)" "the machine still lists its processes"
assert_equals "$machine_mounts" "$(findmnt -rn)" "the machine keeps its mounts"

capture_stderr sudo -u "$regular_user" "$binary" run /bin/hostname
assert_contains "did you run it with sudo?" "$stderr" "running without sudo says what is missing"
assert_contains "EPERM: Operation not permitted" "$stderr" "running without sudo shows the cause from the system"
assert_equals 1 "$status" "running without sudo exits with 1"

assert_host_unchanged
