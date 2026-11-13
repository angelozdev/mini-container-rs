#!/usr/bin/env bash
set -euo pipefail

scripts_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
guide_dir=$(cd "$scripts_dir/.." && pwd -P)
source "$scripts_dir/lib/assertions.sh"

[ "$(uname -s)" = "Linux" ] || { echo "run it inside the Linux machine" >&2; exit 1; }
[ "$(id -u)" -ne 0 ] || { echo "run it as your regular user, not as root" >&2; exit 1; }

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

usage_exit_code_check="no arguments exits with 2"
hello_check="the child prints hello"
launch_check="a missing program says it could not be launched"
check_usage="usage: sudo guide/scripts/check-my-code.sh <id>"
exercise_launch_text='could not launch `holaa`'
hostname_from_variable_edit='$a pub fn hostname() -> String { std::env::var("MINI_CONTAINER_HOSTNAME").unwrap_or_else(|_| HOSTNAME.to_string()) }'
use_hostname_function_edit='s/namespaces::set_hostname(namespaces::HOSTNAME)/namespaces::set_hostname(\&namespaces::hostname())/'
network_namespace_edit='s/CLONE_NEWPID | CloneFlags::CLONE_NEWNS)/CLONE_NEWPID | CloneFlags::CLONE_NEWNS | CloneFlags::CLONE_NEWNET)/'
skip_dev_edit='s/mount_dev(&rootfs.join("dev"))?;/let _ = mount_dev;/'
keep_default_modes_edit='/^use std::fs::/d;/PermissionsExt/d;/fs::set_permissions(path/,/to everyone/c Ok(())'
cpu_limit_method_edit='$a impl Cgroup { pub fn limit_cpu(&self) -> Result<()> { self.write("cpu.max", "50000 100000") } }'
use_cpu_limit_edit='s/cgroup.limit_memory(MEMORY_MAX)?;/cgroup.limit_memory(MEMORY_MAX)?; cgroup.limit_cpu()?;/'
skip_memory_limit_edit='s/cgroup.limit_memory(MEMORY_MAX)?;/let _ = (Cgroup::limit_memory, MEMORY_MAX);/'
exit_without_drop_edit='s/Ok(ExitCode::from(exit_code(status)))/std::process::exit(i32::from(exit_code(status)))/'
dev_zero_check="the container has /dev/zero"
dev_modes_check="the devices are open to everyone"
oom_check="a command over the memory limit gets the out-of-memory warning"
leftover_cgroup_check="a missing program leaves no cgroup"
launch_text_edit_prefix='s/\.context("could not launch the program")/'

reference_binary() {
  echo "$guide_dir/checkpoints/$1/target/debug/mini-container"
}

build_reference() {
  (cd "$guide_dir/checkpoints/$1" && cargo build --locked --quiet)
}

make_repo() {
  local root=$1 id=$2
  mkdir -p "$root/guide/checkpoints/$id/target/debug" "$root/target/debug"
  cp -R "$scripts_dir" "$root/guide/scripts"
  cp "$guide_dir/checkpoints/$id/accept.sh" "$root/guide/checkpoints/$id/accept.sh"
  cp "$(reference_binary "$id")" "$root/guide/checkpoints/$id/target/debug/mini-container"
}

install_student_binary() {
  install -m 755 "$2" "$1/target/debug/mini-container"
}

start_variant() {
  variant_dir="$work_dir/variant-$1"
  rm -rf "$variant_dir/src"
  mkdir -p "$variant_dir"
  cp "$guide_dir/checkpoints/$1/Cargo.toml" "$guide_dir/checkpoints/$1/Cargo.lock" "$variant_dir/"
  cp -R "$guide_dir/checkpoints/$1/src" "$variant_dir/src"
}

edit_variant() {
  sed -i "$1" "$variant_dir/src/$2"
}

build_variant() {
  (cd "$variant_dir" && cargo build --locked --quiet)
  variant_binary="$variant_dir/target/debug/mini-container"
}

run_script() {
  local root=$1
  shift
  status=0
  output=$(cd "$root" && sudo "$@" 2>&1) || status=$?
}

run_check() {
  run_script "$1" guide/scripts/check-my-code.sh "$2"
}

assert_refused() {
  local expected_message=$1 label=$2
  assert_greater_than 0 "$status" "$label exits with an error"
  assert_contains "$expected_message" "$output" "$label says why"
  assert_not_contains "OK " "$output" "$label does not print OK"
}

test_refuses_without_root() {
  local root="$work_dir/without-root"
  make_repo "$root" 1a
  install_student_binary "$root" "$(reference_binary 1a)"
  status=0
  output=$(cd "$root" && guide/scripts/check-my-code.sh 1a 2>&1) || status=$?
  assert_refused "sudo guide/scripts/check-my-code.sh 1a" "running without sudo"
}

test_refuses_outside_the_repo_root() {
  local root="$work_dir/outside-root"
  make_repo "$root" 1a
  install_student_binary "$root" "$(reference_binary 1a)"
  status=0
  output=$(cd "$work_dir" && sudo "$root/guide/scripts/check-my-code.sh" 1a 2>&1) || status=$?
  assert_refused "run it from the root of the repo" "running from another folder"
}

test_refuses_the_wrong_number_of_ids() {
  local root="$work_dir/wrong-number-of-ids"
  make_repo "$root" 1a
  install_student_binary "$root" "$(reference_binary 1a)"
  run_script "$root" guide/scripts/check-my-code.sh
  assert_refused "$check_usage" "a missing id"
  assert_equals "$check_usage" "$output" "a missing id prints only the usage"
  run_script "$root" guide/scripts/check-my-code.sh 1a 2a
  assert_refused "$check_usage" "two ids"
  assert_equals "$check_usage" "$output" "two ids print only the usage"
}

test_refuses_an_id_that_is_a_path() {
  local root="$work_dir/path-like-id"
  make_repo "$root" 1a
  install_student_binary "$root" "$(reference_binary 1a)"
  mkdir "$root/escape"
  printf '%s\n' '#!/usr/bin/env bash' "touch \"$root/escaped\"" >"$root/escape/accept.sh"
  chmod +x "$root/escape/accept.sh"
  run_check "$root" ../../escape
  assert_refused "the checkpoint id must be a digit and a letter, like 1a" "an id that is a path"
  [ ! -e "$root/escaped" ] || fail "an id that is a path ran a script outside the checkpoints"
}

test_refuses_an_unknown_id() {
  local root="$work_dir/unknown-id"
  make_repo "$root" 1a
  install_student_binary "$root" "$(reference_binary 1a)"
  run_check "$root" 9z
  assert_refused "checkpoint 9z does not exist" "an unknown id"
}

test_asks_for_cargo_build() {
  local root="$work_dir/without-binary"
  make_repo "$root" 1a
  run_check "$root" 1a
  assert_refused "run cargo build first" "a missing binary"
}

test_accepts_the_reference_program() {
  local id=$1 root="$work_dir/reference-$1"
  make_repo "$root" "$id"
  install_student_binary "$root" "$(reference_binary "$id")"
  run_check "$root" "$id"
  assert_equals 0 "$status" "the reference program of $id passes: $output"
  assert_equals "OK $id" "$output" "the reference program of $id prints OK"
}

test_names_the_failed_check() {
  local root="$work_dir/wrong-program"
  make_repo "$root" 1a
  start_variant 1a
  edit_variant 's/ExitCode::from(2)/ExitCode::from(1)/' main.rs
  build_variant
  install_student_binary "$root" "$variant_binary"
  run_check "$root" 1a
  assert_refused "$usage_exit_code_check" "a program that exits with the wrong code"
}

test_names_the_check_when_the_program_crashes() {
  local root="$work_dir/crashing-program"
  make_repo "$root" 1a
  printf '%s\n' '#!/usr/bin/env bash' '[ "$2" = /bin/sh ] && exit 3' 'exit 9' >"$work_dir/crashing-program.sh"
  install_student_binary "$root" "$work_dir/crashing-program.sh"
  run_check "$root" 1a
  assert_refused "$hello_check" "a program that crashes"
}

test_accepts_the_exercise_text() {
  local root="$work_dir/exercise-text"
  make_repo "$root" 1a
  start_variant 1a
  edit_variant "${launch_text_edit_prefix}.with_context(|| format!(\"could not launch \`{}\`\", command.program))/" container.rs
  build_variant
  assert_contains "$exercise_launch_text" "$("$variant_binary" run holaa 2>&1 || true)" "the variant prints the text of exercise 1a.1"
  install_student_binary "$root" "$variant_binary"
  run_check "$root" 1a
  assert_equals "OK 1a" "$output" "the text of exercise 1a.1 passes"
}

test_rejects_a_looser_text() {
  local root="$work_dir/looser-text"
  make_repo "$root" 1a
  start_variant 1a
  edit_variant "${launch_text_edit_prefix}.context(\"could not launch\")/" container.rs
  build_variant
  install_student_binary "$root" "$variant_binary"
  run_check "$root" 1a
  assert_refused "$launch_check" "a launch text that is neither the main line nor the exercise"
}

test_ignores_the_hostname_variable() {
  local root="$work_dir/hostname-variable"
  make_repo "$root" 2a
  start_variant 2a
  edit_variant "$hostname_from_variable_edit" namespaces.rs
  edit_variant "$use_hostname_function_edit" container.rs
  build_variant
  assert_equals api "$(sudo MINI_CONTAINER_HOSTNAME=api "$variant_binary" run /bin/hostname)" "the variant reads the hostname from the variable"
  install_student_binary "$root" "$variant_binary"
  run_script "$root" MINI_CONTAINER_HOSTNAME=api guide/scripts/check-my-code.sh 2a
  assert_equals "OK 2a" "$output" "a hostname variable in the environment does not change the check"
}

test_accepts_every_exercise_up_to_2c1() {
  local root="$work_dir/exercises-up-to-2c1"
  make_repo "$root" 2c
  start_variant 2c
  edit_variant "${launch_text_edit_prefix}.with_context(|| format!(\"could not launch \`{}\`\", command.program))/" container.rs
  edit_variant "$hostname_from_variable_edit" namespaces.rs
  edit_variant "$use_hostname_function_edit" container.rs
  edit_variant "$network_namespace_edit" namespaces.rs
  build_variant
  assert_not_contains eth0 "$(sudo "$variant_binary" run /sbin/ip link)" "the variant has no network interface but lo"
  assert_equals api "$(sudo MINI_CONTAINER_HOSTNAME=api "$variant_binary" run /bin/hostname)" "the variant reads the hostname from the variable"
  install_student_binary "$root" "$variant_binary"
  run_script "$root" MINI_CONTAINER_HOSTNAME=api guide/scripts/check-my-code.sh 2c
  assert_equals "OK 2c" "$output" "the solutions of the exercises up to 2c.1 pass the check of 2c"
}

test_names_the_check_of_an_empty_dev() {
  local root="$work_dir/empty-dev"
  make_repo "$root" 2c
  start_variant 2c
  edit_variant "$skip_dev_edit" filesystem.rs
  build_variant
  install_student_binary "$root" "$variant_binary"
  run_check "$root" 2c
  assert_refused "$dev_zero_check" "a program that leaves the /dev of alpine empty"
}

test_names_the_check_of_the_device_modes() {
  local root="$work_dir/device-modes"
  make_repo "$root" 2c
  start_variant 2c
  edit_variant "$keep_default_modes_edit" filesystem.rs
  build_variant
  install_student_binary "$root" "$variant_binary"
  run_check "$root" 2c
  assert_refused "$dev_modes_check" "a program that leaves the devices with the mode the umask gives"
}

cgroup_names() {
  ls -d /sys/fs/cgroup/mini-container-* 2>/dev/null || true
}

remove_new_cgroups() {
  local before=$1 leftover
  for leftover in $(cgroup_names); do
    [[ " $before " == *" $leftover "* ]] || sudo rmdir "$leftover"
  done
}

throttled_periods_of_the_variant() {
  sudo "$variant_binary" run /bin/sh -c 'timeout 2 yes > /dev/null; sleep 3' >/dev/null 2>&1 &
  local launcher=$!
  sleep 3
  awk '$1 == "nr_throttled" { print $2 }' /sys/fs/cgroup/mini-container-*/cpu.stat
  wait "$launcher" || true
}

test_accepts_every_exercise_up_to_3a1() {
  local root="$work_dir/exercises-up-to-3a1"
  make_repo "$root" 3a
  start_variant 3a
  edit_variant "${launch_text_edit_prefix}.with_context(|| format!(\"could not launch \`{}\`\", command.program))/" container.rs
  edit_variant "$hostname_from_variable_edit" namespaces.rs
  edit_variant "$use_hostname_function_edit" container.rs
  edit_variant "$network_namespace_edit" namespaces.rs
  edit_variant "$cpu_limit_method_edit" cgroup.rs
  edit_variant "$use_cpu_limit_edit" container.rs
  build_variant
  assert_not_contains eth0 "$(sudo "$variant_binary" run /sbin/ip link)" "the variant has no network interface but lo"
  assert_greater_than 0 "$(throttled_periods_of_the_variant)" "the variant throttles a command that wants more than half a core"
  install_student_binary "$root" "$variant_binary"
  run_script "$root" MINI_CONTAINER_HOSTNAME=api guide/scripts/check-my-code.sh 3a
  assert_equals "OK 3a" "$output" "the solutions of the exercises up to 3a.1 pass the check of 3a"
}

test_names_the_check_of_a_missing_memory_limit() {
  local root="$work_dir/no-memory-limit"
  make_repo "$root" 3a
  start_variant 3a
  edit_variant "$skip_memory_limit_edit" container.rs
  build_variant
  install_student_binary "$root" "$variant_binary"
  run_check "$root" 3a
  assert_refused "$oom_check" "a program that sets no memory limit"
}

test_names_the_check_of_a_leftover_cgroup() {
  local root="$work_dir/leftover-cgroup" before
  make_repo "$root" 3a
  start_variant 3a
  edit_variant "$exit_without_drop_edit" container.rs
  build_variant
  install_student_binary "$root" "$variant_binary"
  before=$(cgroup_names | tr '\n' ' ')
  run_check "$root" 3a
  remove_new_cgroups "$before"
  assert_refused "$leftover_cgroup_check" "a program that exits without dropping its cgroup"
}

for id in 1a 2a 2b 2c 3a; do
  build_reference "$id"
done

test_refuses_without_root
test_refuses_outside_the_repo_root
test_refuses_the_wrong_number_of_ids
test_refuses_an_id_that_is_a_path
test_refuses_an_unknown_id
test_asks_for_cargo_build
for id in 1a 2a 2b 2c 3a; do
  test_accepts_the_reference_program "$id"
done
test_names_the_failed_check
test_names_the_check_when_the_program_crashes
test_accepts_the_exercise_text
test_rejects_a_looser_text
test_ignores_the_hostname_variable
test_accepts_every_exercise_up_to_2c1
test_names_the_check_of_an_empty_dev
test_names_the_check_of_the_device_modes
test_accepts_every_exercise_up_to_3a1
test_names_the_check_of_a_missing_memory_limit
test_names_the_check_of_a_leftover_cgroup

echo "OK test-check-my-code"
