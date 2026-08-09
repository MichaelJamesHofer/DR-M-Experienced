#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ "$(id -u)" -ne 1002 ]]; then
  printf '%s\n' "Install the publisher host as the otto user (UID 1002)." >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node_root=/home/otto/.nvm/versions/node/v22.22.0
node_bin="$node_root/bin/node"
npm_bin="$node_root/bin/npm"
enable=false
if [[ "${1:-}" == "--enable" ]]; then
  enable=true
elif [[ $# -ne 0 ]]; then
  printf 'Usage: %s [--enable]\n' "$0" >&2
  exit 2
fi

if [[ -n "$(git -C "$repo_root" status --porcelain)" ]]; then
  printf '%s\n' "Refusing to deploy a dirty publishing checkout." >&2
  exit 1
fi
if [[ ! -x "$node_bin" || ! -x "$npm_bin" || "$($node_bin --version)" != "v22.22.0" ]]; then
  printf '%s\n' "Pinned Node v22.22.0 and its npm executable are required." >&2
  exit 1
fi
if [[ "$(readlink -f "$npm_bin")" != "$node_root"/lib/node_modules/npm/bin/npm-cli.js ]]; then
  printf '%s\n' "The pinned npm executable does not belong to Node v22.22.0." >&2
  exit 1
fi
commit="$(git -C "$repo_root" rev-parse HEAD)"
if [[ ! "$commit" =~ ^[0-9a-f]{40}$ ]]; then
  printf '%s\n' "Could not resolve a pinned Git commit." >&2
  exit 1
fi
release_root="/home/otto/.local/share/drm-publisher/releases/$commit"
mkdir -p "$(dirname "$release_root")"
temporary=""
service_tmp=""
intake_timer_was_active=false
cleanup() {
  if [[ -n "$temporary" && -e "$temporary" ]]; then
    chmod -R u+w "$temporary" >/dev/null 2>&1 || true
    rm -rf "$temporary"
  fi
  [[ -z "$service_tmp" ]] || rm -f "$service_tmp"
  if $intake_timer_was_active; then
    systemctl --user start drm-publisher-intake.timer >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

release_valid=false
if [[ -d "$release_root" ]] &&
  "$node_bin" "$repo_root/ops/release-integrity.mjs" verify "$release_root" "$commit" >/dev/null 2>&1; then
  release_valid=true
fi

if ! $release_valid; then
  temporary="$(mktemp -d "${release_root}.tmp.XXXXXX")"
  git -C "$repo_root" archive "$commit" | tar -x -C "$temporary"
  (
    cd "$temporary"
    PATH="$node_root/bin:/usr/bin:/bin" "$npm_bin" ci --omit=dev --ignore-scripts
  )
  printf '{"schemaVersion":1,"commit":"%s","installedAt":"%s"}\n' \
    "$commit" "$(date --iso-8601=seconds)" > "$temporary/release.json"
  "$node_bin" "$repo_root/ops/release-integrity.mjs" seal "$temporary" "$commit"

  invalid_release=""
  if [[ -e "$release_root" ]]; then
    current_target="$(readlink -f /home/otto/.local/share/drm-publisher/current 2>/dev/null || true)"
    if [[ "$current_target" == "$release_root" ]]; then
      for unit in drm-publisher-controller.service drm-publisher-intake.service; do
        if systemctl --user is-active --quiet "$unit"; then
          printf 'Refusing to replace invalid release %s while %s is running.\n' "$commit" "$unit" >&2
          exit 1
        fi
      done
      systemctl --user stop drm-publisher-controller.timer >/dev/null 2>&1 || true
      if systemctl --user is-active --quiet drm-publisher-intake.timer; then
        intake_timer_was_active=true
        systemctl --user stop drm-publisher-intake.timer
      fi
    fi
    invalid_release="${release_root}.invalid-$(date +%s)-$$"
    mv "$release_root" "$invalid_release"
  fi
  if ! mv "$temporary" "$release_root"; then
    [[ -z "$invalid_release" || -e "$release_root" ]] || mv "$invalid_release" "$release_root"
    exit 1
  fi
  temporary=""
  "$node_bin" "$repo_root/ops/release-integrity.mjs" verify "$release_root" "$commit" >/dev/null
  if [[ -n "$invalid_release" ]]; then
    [[ -L "$invalid_release" ]] || chmod -R u+w "$invalid_release"
    rm -rf "$invalid_release"
  fi
fi
ln -sfn "$release_root" /home/otto/.local/share/drm-publisher/current.new
mv -Tf /home/otto/.local/share/drm-publisher/current.new /home/otto/.local/share/drm-publisher/current

if $intake_timer_was_active; then
  systemctl --user start drm-publisher-intake.timer
  intake_timer_was_active=false
fi

install -Dm0755 "$repo_root/ops/bin/drm-publish" /home/otto/.local/bin/drm-publish
service_tmp="$(mktemp)"
sed \
  -e "s|@PROJECT_ROOT@|$release_root|g" \
  -e "s|@BUILD_COMMIT@|$commit|g" \
  "$repo_root/ops/systemd/drm-publisher-controller.service" > "$service_tmp"
install -Dm0644 "$service_tmp" /home/otto/.config/systemd/user/drm-publisher-controller.service
install -Dm0644 "$repo_root/ops/systemd/drm-publisher-controller.timer" \
  /home/otto/.config/systemd/user/drm-publisher-controller.timer
systemctl --user daemon-reload

intake_args=(--preserve-state)
if $enable; then
  intake_args=(--enable)
fi
"$release_root/ops/install-publisher-intake.sh" "${intake_args[@]}"

if $enable; then
  systemctl --user enable --now drm-publisher-controller.timer
  printf '%s\n' "Enabled pinned publisher and Dropbox intake release $commit."
else
  systemctl --user disable --now drm-publisher-controller.timer >/dev/null 2>&1 || true
  printf '%s\n' "Installed pinned publisher release $commit; controller timer remains disabled."
fi
