source "$(dirname "${BASH_SOURCE[0]}")/assertions.sh"

launch_error_main_line="could not launch the program"

launch_error_exercise_1a1() {
  printf 'could not launch `%s`' "$1"
}

assert_launch_error() {
  local program=$1 stderr_text=$2 label=$3
  assert_contains_either "$launch_error_main_line" "$(launch_error_exercise_1a1 "$program")" "$stderr_text" "$label"
}
