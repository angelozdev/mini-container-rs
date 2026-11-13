fail() {
  printf 'FALLA: %s\n' "$1" >&2
  exit 1
}

assert_equals() {
  local expected=$1 actual=$2 label=$3
  [ "$expected" = "$actual" ] || fail "$label: se esperaba [$expected] y salió [$actual]"
}

assert_contains() {
  local needle=$1 haystack=$2 label=$3
  [[ "$haystack" == *"$needle"* ]] || fail "$label: no contiene [$needle] y salió [$haystack]"
}

assert_exit_code() {
  local expected=$1 label=$2
  shift 2
  local actual=0
  "$@" >/dev/null 2>&1 || actual=$?
  assert_equals "$expected" "$actual" "$label"
}

host_state() {
  hostname
  findmnt -rn
  ps -p 1 -o comm=
  ls /sys/fs/cgroup
}

snapshot_host_state() {
  HOST_STATE_BEFORE=$(host_state)
}

assert_host_unchanged() {
  local after
  after=$(host_state)
  [ "$HOST_STATE_BEFORE" = "$after" ] && return 0
  diff <(printf '%s\n' "$HOST_STATE_BEFORE") <(printf '%s\n' "$after") >&2 || true
  fail "el estado del host cambió"
}
