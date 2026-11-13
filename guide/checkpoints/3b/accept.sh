#!/usr/bin/env bash
set -euo pipefail

checkpoint_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$checkpoint_dir/../../scripts/lib/assertions.sh"

binary="${MINI_CONTAINER_BIN:-$checkpoint_dir/target/debug/mini-container}"
usage="usage: mini-container run <program> [args...]"
rootfs=/var/lib/mini-container/alpine
missing_rootfs_text="could not find the alpine root filesystem at $rootfs"
regular_user=${SUDO_USER:?"run it with sudo"}
cgroup_root=/sys/fs/cgroup
memory_hog='head -c 200m /dev/zero | tail'
oom_text="the kernel killed a process for running out of memory (oom_kill: 1)"
cgroup_line_pattern='^0::/mini-container-[0-9]+$'
cgroup_path_pattern='^/sys/fs/cgroup/mini-container-[0-9]+$'

capture_stderr() {
  status=0
  stderr=$("$@" 2>&1 >/dev/null) || status=$?
}

capture_output() {
  status=0
  output=$("$@" 2>&1) || status=$?
}

assert_no_cgroup_left() {
  local leftovers
  leftovers=$(ls -d "$cgroup_root"/mini-container-* 2>/dev/null || true)
  assert_equals "" "$leftovers" "$1"
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

launch_in_own_group() {
  setsid env --default-signal=INT "$binary" run "$@" >/dev/null 2>&1 &
  launcher=$!
}

wait_until_running() {
  local command_line=$1 attempts=0
  until pgrep -fx "$command_line" >/dev/null; do
    attempts=$((attempts + 1))
    if [ "$attempts" -gt 50 ]; then
      kill "$launcher" 2>/dev/null || true
      fail "the command [$command_line] never started"
    fi
    sleep 0.1
  done
}

wait_until_gone() {
  local command_line=$1 attempts=0
  while pgrep -fx "$command_line" >/dev/null && [ "$attempts" -lt 10 ]; do
    attempts=$((attempts + 1))
    sleep 0.05
  done
}

assert_not_running() {
  local command_line=$1 label=$2
  if pgrep -fx "$command_line" >/dev/null; then
    fail "$label: [$command_line] is still running"
  fi
}

press_ctrl_c() {
  launch_in_own_group /bin/sleep 3
  wait_until_running "/bin/sleep 3"
  kill -INT -- "-$launcher"
  status=0
  wait "$launcher" || status=$?
}

kill_the_parent() {
  launch_in_own_group /bin/sleep 30
  wait_until_running "/bin/sleep 30"
  kill -KILL "$launcher"
  status=0
  wait "$launcher" 2>/dev/null || status=$?
  wait_until_gone "/bin/sleep 30"
}

run_documented_cleanup() {
  rmdir "$cgroup_root"/mini-container-*
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
assert_no_cgroup_left "a missing program leaves no cgroup"

kill_child_from_outside
assert_equals 137 "$status" "a child killed by SIGKILL from outside exits with 137"
assert_no_cgroup_left "a child killed from outside leaves no cgroup"

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
assert_no_cgroup_left "a missing root filesystem leaves no cgroup"

assert_equals "$machine_mounts" "$(findmnt -rn)" "the machine keeps its mounts"
assert_not_contains /var/lib/mini-container "$(findmnt -rn)" "the machine has no mounts under /var/lib/mini-container"

capture_stderr sudo -u "$regular_user" "$binary" run /bin/hostname
assert_contains "did you run it with sudo?" "$stderr" "running without sudo says what is missing"
assert_contains "EPERM: Operation not permitted" "$stderr" "running without sudo shows the cause from the system"
assert_equals 1 "$status" "running without sudo exits with 1"
assert_no_cgroup_left "running without sudo leaves no cgroup"

capture_stderr "$binary" run /bin/sh -c "$memory_hog"
assert_contains "$oom_text" "$stderr" "a command over the memory limit gets the out-of-memory warning"
assert_equals 137 "$status" "a command over the memory limit exits with 137"
assert_no_cgroup_left "a command over the memory limit leaves no cgroup"

cgroup_line=$(capture_stdout "the container prints its cgroup" "$binary" run /bin/cat /proc/self/cgroup)
assert_matches "$cgroup_line_pattern" "$cgroup_line" "the command runs inside a cgroup of its own"
assert_no_cgroup_left "a command that prints its cgroup leaves no cgroup"

capture_output "$binary" run /bin/echo ok
assert_equals ok "$output" "a command within the limit prints its output and no warning"
assert_equals 0 "$status" "a command within the limit exits with 0"
assert_no_cgroup_left "a command within the limit leaves no cgroup"

press_ctrl_c
assert_equals 0 "$status" "Ctrl-C does not stop the program: it waits for the command and exits with 0"
assert_not_running "/bin/sleep 3" "after Ctrl-C the command has ended"
assert_no_cgroup_left "Ctrl-C leaves no cgroup"

kill_the_parent
assert_equals 137 "$status" "a parent killed with SIGKILL exits with 137"
assert_not_running "/bin/sleep 30" "a parent killed with SIGKILL takes its command with it"
leftover=$(ls -d "$cgroup_root"/mini-container-* 2>/dev/null || true)
assert_matches "$cgroup_path_pattern" "$leftover" "a parent killed with SIGKILL leaves exactly one cgroup"
assert_equals "" "$(cat "$leftover/cgroup.procs")" "the cgroup it leaves is empty"
run_documented_cleanup
assert_no_cgroup_left "the documented cleanup command removes it"

assert_host_unchanged
