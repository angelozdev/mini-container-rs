#!/usr/bin/env bash
set -euo pipefail

checkpoint_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$checkpoint_dir/../../scripts/lib/assertions.sh"

binary="${MINI_CONTAINER_BIN:-$checkpoint_dir/target/debug/mini-container}"
usage="usage: mini-container run <program> [args...]"
rootfs=/var/lib/mini-container/alpine
missing_rootfs_text="could not find the alpine root filesystem at $rootfs"
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

hide_rootfs_and_run() {
  unshare --mount sh -c 'mount -t tmpfs tmpfs /var/lib/mini-container && exec "$0" run /bin/true' "$binary"
}

[ -f "$rootfs/etc/os-release" ] || fail "alpine is not installed in $rootfs: download and extract it first"

snapshot_host_state
machine_hostname=$(hostname)
machine_mounts=$(findmnt -rn)

assert_exit_code 3 "the child exits with 3" "$binary" run /bin/sh -c 'exit 3'

assert_stdout_equals hello "the child prints hello" "$binary" run /bin/echo hello

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

assert_stdout_equals container "the child sees its own hostname" "$binary" run /bin/hostname
assert_equals "$machine_hostname" "$(hostname)" "the machine keeps its hostname"

alone_in_namespace=$(unshare --mount "$binary" run /bin/hostname 2>&1 || true)
assert_equals "container" "$alone_in_namespace" "the program works when it is the only process of its mount namespace"

process_list=$(capture_stdout "the container lists its processes" "$binary" run /bin/ps -o pid,comm)
mapfile -t process_lines <<<"$process_list"
assert_equals 2 "${#process_lines[@]}" "the container lists only the header and one process"
assert_matches '^ *1 ps$' "${process_lines[1]}" "the program is the PID 1 of the container"

assert_greater_than 5 "$(ps -e --no-headers | wc -l)" "the machine still lists its processes"

os_release=$(capture_stdout "the container prints its os-release" "$binary" run /bin/cat /etc/os-release)
assert_equals 'NAME="Alpine Linux"' "${os_release%%$'\n'*}" "the first line of os-release names alpine"

root_listing=$(capture_stdout "the container lists its root" "$binary" run /bin/ls /)
assert_has_line etc "$root_listing" "the root of the container has etc"
assert_not_contains Users "$root_listing" "the root of the container does not show the machine's folders"

assert_stdout_equals 10 "the container has /dev/zero" "$binary" run /bin/sh -c 'head -c 10 /dev/zero | wc -c'
assert_stdout_equals char "/dev/null is a character device" "$binary" run /bin/sh -c '[ -c /dev/null ] && echo char'
assert_stdout_equals 0 "/dev/null is empty" "$binary" run /bin/sh -c 'head -c 10 /dev/null | wc -c'
assert_stdout_equals "666 666" "the devices are open to everyone" "$binary" run /bin/sh -c 'echo $(stat -c %a /dev/null /dev/zero)'

capture_stderr "$binary" run bash
assert_contains 'could not run `bash`' "$stderr" "a program that alpine lacks says it could not be run"
assert_equals 1 "$status" "a program that alpine lacks exits with 1"

capture_stderr hide_rootfs_and_run
assert_contains "$missing_rootfs_text" "$stderr" "a missing root filesystem says where it looked"
assert_equals 1 "$status" "a missing root filesystem exits with 1"

assert_equals "$machine_mounts" "$(findmnt -rn)" "the machine keeps its mounts"
assert_not_contains /var/lib/mini-container "$(findmnt -rn)" "the machine has no mounts under /var/lib/mini-container"

capture_stderr sudo -u "$regular_user" "$binary" run /bin/hostname
assert_contains "did you run it with sudo?" "$stderr" "running without sudo says what is missing"
assert_contains "EPERM: Operation not permitted" "$stderr" "running without sudo shows the cause from the system"
assert_equals 1 "$status" "running without sudo exits with 1"

assert_host_unchanged
