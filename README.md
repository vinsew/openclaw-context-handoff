# OpenClaw Context Handoff

`openclaw-context-handoff` is an OpenClaw plugin for two jobs:

- inject current context usage into each conversation turn
- create and maintain a handoff file when a conversation gets too full

It is designed for agent-first installation. A human can publish the repo, but
an OpenClaw agent should be able to read this repository and install it
without manual editing of `openclaw.json`.

## What it does

- Injects context usage percentage on each turn
- Warns when usage crosses the warning threshold
- Automatically writes a handoff file at the critical threshold
- Injects a startup bootstrap policy file for new sessions
- Supports manual handoff requests such as "write handoff"
- Appends follow-up notes to the latest handoff file when the same session
  continues after critical threshold

## Install

### From npm

```bash
openclaw plugins install openclaw-context-handoff
openclaw plugins enable context-monitor
openclaw gateway restart
openclaw plugins info context-monitor
```

### From a GitHub repository or local path

```bash
extensions/context-monitor/scripts/agent-install.sh <source>
```

Examples:

```bash
extensions/context-monitor/scripts/agent-install.sh openclaw-context-handoff
extensions/context-monitor/scripts/agent-install.sh https://github.com/<owner>/openclaw-context-handoff.git
extensions/context-monitor/scripts/agent-install.sh /path/to/openclaw-context-handoff
```

## Default behavior

- Plugin package name: `openclaw-context-handoff`
- Internal plugin id: `context-monitor`
- Default handoff directory: `memory/handoff`
- Default handoff filename prefix: `context-handoff`
- Default warning threshold: `50`
- Default critical threshold: `75`

The internal plugin id stays `context-monitor` so existing OpenClaw
configuration remains compatible.

## Configuration

The plugin exposes these main config fields through
`plugins.entries["context-monitor"].config`:

- `showAlways`
- `warnPercent`
- `criticalPercent`
- `handoffEnabled`
- `handoffDir`
- `handoffFilePrefix`
- `handoffUseTimestamp`
- `handoffInstruction`

Most users do not need to set anything manually.

## Agent-first publishing model

This repository is intentionally written so another OpenClaw agent can:

1. read the repository
2. understand the install contract
3. install the plugin
4. enable the plugin
5. restart the gateway

For that reason, [AGENT-BOOTSTRAP.md](/Users/wangyiyang/.openclaw/extensions/context-monitor/AGENT-BOOTSTRAP.md) is part of the public interface of this project.

## License

MIT
