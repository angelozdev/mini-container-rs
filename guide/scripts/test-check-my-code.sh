#!/usr/bin/env bash
set -euo pipefail

scripts_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
guide_dir=$(cd "$scripts_dir/.." && pwd -P)
source "$scripts_dir/lib/assertions.sh"

[ "$(uname -s)" = "Linux" ] || { echo "run it inside the Linux machine" >&2; exit 1; }

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

variant_dir="$work_dir/variant"
usage_exit_code_check="no arguments exits with 2"
hello_check="the child prints hello"
launch_check="a missing program says it could not be launched"

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

build_variant_of_1a() {
  local sed_expression=$1 source_file=$2
  rm -rf "$variant_dir/src"
  mkdir -p "$variant_dir"
  cp "$guide_dir/checkpoints/1a/Cargo.toml" "$guide_dir/checkpoints/1a/Cargo.lock" "$variant_dir/"
  cp -R "$guide_dir/checkpoints/1a/src" "$variant_dir/src"
  sed -i "$sed_expression" "$variant_dir/src/$source_file"
  (cd "$variant_dir" && cargo build --locked --quiet)
}

run_check() {
  local root=$1 id=$2
  status=0
  output=$(cd "$root" && sudo guide/scripts/check-my-code.sh "$id" 2>&1) || status=$?
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

test_refuses_an_unknown_id() {
  local root="$work_dir/unknown-id"
  make_repo "$root" 1a
  install_student_binary "$root" "$(reference_binary 1a)"
  run_check "$root" zz
  assert_refused "checkpoint zz does not exist" "an unknown id"
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
  build_variant_of_1a 's/ExitCode::from(2)/ExitCode::from(1)/' main.rs
  install_student_binary "$root" "$variant_dir/target/debug/mini-container"
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
  build_variant_of_1a 's/\.context("could not launch the program")/.with_context(|| format!("could not launch `{}`", command.program))/' container.rs
  install_student_binary "$root" "$variant_dir/target/debug/mini-container"
  run_check "$root" 1a
  assert_equals "OK 1a" "$output" "the text of exercise 1a.1 passes"
}

test_rejects_a_looser_text() {
  local root="$work_dir/looser-text"
  make_repo "$root" 1a
  build_variant_of_1a 's/\.context("could not launch the program")/.context("could not launch")/' container.rs
  install_student_binary "$root" "$variant_dir/target/debug/mini-container"
  run_check "$root" 1a
  assert_refused "$launch_check" "a launch text that is neither the main line nor the exercise"
}

for id in 1a 2a 2b; do
  build_reference "$id"
done

test_refuses_without_root
test_refuses_outside_the_repo_root
test_refuses_an_unknown_id
test_asks_for_cargo_build
for id in 1a 2a 2b; do
  test_accepts_the_reference_program "$id"
done
test_names_the_failed_check
test_names_the_check_when_the_program_crashes
test_accepts_the_exercise_text
test_rejects_a_looser_text

echo "OK test-check-my-code"
