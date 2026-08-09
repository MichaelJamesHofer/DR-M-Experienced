#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ "$(id -u)" -ne 1002 ]]; then
  printf '%s\n' "Install the Dropbox intake service as the otto user (UID 1002)." >&2
  exit 1
fi

activation=disable
if [[ "${1:-}" == "--enable" ]]; then
  activation=enable
elif [[ "${1:-}" == "--preserve-state" ]]; then
  activation=preserve
elif [[ $# -ne 0 ]]; then
  printf 'Usage: %s [--enable|--preserve-state]\n' "$0" >&2
  exit 2
fi

timer_was_enabled=false
timer_was_active=false
if [[ "$activation" == preserve ]]; then
  systemctl --user is-enabled --quiet drm-publisher-intake.timer 2>/dev/null && timer_was_enabled=true
  systemctl --user is-active --quiet drm-publisher-intake.timer 2>/dev/null && timer_was_active=true
fi

current_link="/home/otto/.local/share/drm-publisher/current"
project_root="$(readlink -f "$current_link" 2>/dev/null || true)"
if [[ -z "$project_root" || ! -d "$project_root" ]]; then
  printf '%s\n' "Install a pinned publisher-host release before installing Dropbox intake." >&2
  exit 1
fi
if [[ ! -f "$project_root/release.json" || ! -f "$project_root/scripts/publish/dropbox-intake.mjs" ]]; then
  printf '%s\n' "The current pinned publisher release does not contain Dropbox intake." >&2
  exit 1
fi

commit="$({ /home/otto/.nvm/versions/node/v22.22.0/bin/node -e '
  const fs = require("node:fs");
  const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!/^[a-f0-9]{40}$/.test(value.commit || "")) process.exit(1);
  process.stdout.write(value.commit);
' "$project_root/release.json"; } 2>/dev/null || true)"
if [[ ! "$commit" =~ ^[a-f0-9]{40}$ ]]; then
  printf '%s\n' "The pinned publisher release metadata is invalid." >&2
  exit 1
fi
if [[ "$project_root" != "/home/otto/.local/share/drm-publisher/releases/$commit" ]]; then
  printf '%s\n' "The current publisher link does not resolve to its declared immutable release." >&2
  exit 1
fi

inbox="/home/otto/Dropbox/Dr M Experienced/publisher-inbox"
state_root="/home/otto/.local/state/drm-publisher/intake"
install -d -m 0700 "$inbox" "$state_root" /home/otto/.config/systemd/user

service_tmp="$(mktemp)"
trap 'rm -f "$service_tmp"' EXIT
sed \
  -e "s|@PROJECT_ROOT@|$project_root|g" \
  -e "s|@BUILD_COMMIT@|$commit|g" \
  "$project_root/ops/systemd/drm-publisher-intake.service" > "$service_tmp"
install -m 0644 "$service_tmp" /home/otto/.config/systemd/user/drm-publisher-intake.service
install -m 0644 "$project_root/ops/systemd/drm-publisher-intake.timer" \
  /home/otto/.config/systemd/user/drm-publisher-intake.timer
systemctl --user daemon-reload
case "$activation" in
  enable)
    systemctl --user enable --now drm-publisher-intake.timer
    printf 'Enabled Dropbox intake from pinned publisher release %s.\n' "$commit"
    ;;
  preserve)
    $timer_was_enabled && systemctl --user enable drm-publisher-intake.timer >/dev/null
    $timer_was_active && systemctl --user restart drm-publisher-intake.timer
    printf 'Refreshed Dropbox intake from pinned publisher release %s; prior timer activation was preserved.\n' "$commit"
    ;;
  disable)
    systemctl --user disable --now drm-publisher-intake.timer >/dev/null 2>&1 || true
    printf 'Installed Dropbox intake from pinned publisher release %s; timer remains disabled.\n' "$commit"
    ;;
esac
