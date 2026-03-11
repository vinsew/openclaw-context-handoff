# Context Handoff Plugin (Agent Bootstrap Guide)

This document is for automated agent execution, not manual human use.

## 1) Install goal
Install and activate the plugin on a target OpenClaw instance so it works out of the box:

- Context percentage prompt injection
- Startup handoff bootstrap injection
- Automatic critical-threshold handoff file writing

## 2) Runtime assumptions
- `openclaw` CLI is available in PATH.
- Gateway process can be restarted by the current operator.
- Operator can write to OpenClaw workspace.

## 3) Required source types
The plugin supports:
- `npm spec` install (recommended): `openclaw plugins install <spec>`
- local path install: `openclaw plugins install <path>` (use `-l` for link mode if needed)
- If input is a GitHub URL, clone first, then use local path install.

## 4) Agent execution sequence
Use this exact order for idempotent behavior:

1. If source is GitHub URL, clone:
   - `git clone --depth=1 <repo-url> /tmp/openclaw-context-handoff-source`
2. Install plugin:
   - `openclaw plugins install <source-or-path> -l`
   - for npm spec, do not add `-l`.
3. Enable plugin:
   - `openclaw plugins enable context-monitor`
4. Restart gateway:
   - `openclaw gateway restart`
5. Verify:
   - `openclaw plugins info context-monitor`

## 5) Why this is zero-manual configuration
No `openclaw.json` manual edits are required.

- Installation command creates/refreshes plugin install metadata.
- `plugins enable` sets active status.
- Defaults are provided by plugin schema/config defaults inside the plugin package.

## 6) Optional automated path (single command)
Run:

```bash
extensions/context-monitor/scripts/agent-install.sh <npm-spec-or-path-or-directory-or-git-url>
```

Examples:

```bash
scripts/agent-install.sh /tmp/openclaw-context-handoff-source
scripts/agent-install.sh openclaw-context-handoff
scripts/agent-install.sh https://github.com/vinsew/openclaw-context-handoff.git
```

## 7) What you still need from user side
- If you want a one-shot URL install for end users (no clone step), publish to npm and distribute `npm spec`.
- If you stay with GitHub-only distribution, keep this repo URL stable (tagged releases optional), and let the agent handle clone.
