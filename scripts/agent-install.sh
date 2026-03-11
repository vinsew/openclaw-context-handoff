#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ID="openclaw-context-handoff"
PLUGIN_NPM_SPEC="openclaw-context-handoff"
WORK_DIR="/tmp/openclaw-context-handoff"

usage() {
  cat <<'EOF'
Usage:
  agent-install.sh <source>

Example:
  agent-install.sh /path/to/openclaw-context-handoff
  agent-install.sh openclaw-context-handoff
  agent-install.sh https://github.com/example/openclaw-context-handoff.git
EOF
}

if [[ $# -ne 1 ]]; then
  usage
  exit 2
fi

SOURCE="$1"
if [[ -z "${SOURCE}" ]]; then
  usage
  exit 2
fi

if ! command -v openclaw >/dev/null 2>&1; then
  echo "openclaw CLI not found in PATH." >&2
  exit 2
fi

if [[ "$SOURCE" =~ ^(https?://|git@|ssh://) ]]; then
  if ! command -v git >/dev/null 2>&1; then
    echo "git CLI not found in PATH." >&2
    exit 2
  fi
  rm -rf "$WORK_DIR"
  echo "Cloning plugin source from git: $SOURCE"
  git clone --depth=1 "$SOURCE" "$WORK_DIR"
  if [[ -f "$WORK_DIR/index.ts" && -f "$WORK_DIR/openclaw.plugin.json" ]]; then
    SOURCE="$WORK_DIR"
  elif [[ -f "$WORK_DIR/extensions/context-monitor/index.ts" && -f "$WORK_DIR/extensions/context-monitor/openclaw.plugin.json" ]]; then
    SOURCE="$WORK_DIR/extensions/context-monitor"
  else
    echo "Cannot find openclaw-context-handoff plugin in cloned source: $SOURCE" >&2
    exit 2
  fi
elif [[ -d "$SOURCE" ]]; then
  echo "Installing Context Handoff from local path: $SOURCE"
  openclaw plugins install "$SOURCE" -l
elif [[ "${SOURCE:-}" == "$PLUGIN_NPM_SPEC" || "${SOURCE:-}" == *@* ]]; then
  echo "Installing Context Handoff from npm spec: $SOURCE"
  openclaw plugins install "$SOURCE"
else
  # Path-like fallback: if it looks like a local path but does not exist, fail early.
  if [[ "$SOURCE" == ./* || "$SOURCE" == ../* || "$SOURCE" == /* || "$SOURCE" == */* ]]; then
    echo "Invalid local path: $SOURCE" >&2
    exit 2
  fi

  # Fallback to npm-style install for unknown non-path token
  echo "Installing Context Handoff from spec: $SOURCE"
  openclaw plugins install "$SOURCE"
fi

openclaw plugins enable "$PLUGIN_ID"
openclaw gateway restart
openclaw plugins info "$PLUGIN_ID"

echo "Context Handoff install flow completed."
