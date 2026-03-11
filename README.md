# OpenClaw Context Handoff

[![npm version](https://img.shields.io/npm/v/openclaw-context-handoff.svg)](https://www.npmjs.com/package/openclaw-context-handoff)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-plugin-black.svg)](https://github.com/vinsew/openclaw-context-handoff)

Give every long OpenClaw conversation a safe, resumable handoff.

`openclaw-context-handoff` is an OpenClaw plugin that watches context usage,
warns before a session gets too full, writes a handoff file automatically at
the critical threshold, and teaches the next session how to continue only when
the user clearly asks to continue.

It is built for agent-first workflows:

- inject context usage into each turn
- warn before the window gets tight
- automatically write a handoff file at the critical threshold
- let a new session continue from the latest handoff when the user says
  "continue", "resume", or similar

## At a Glance

```text
Long conversation -> context gets high -> plugin writes handoff ->
user starts a new session -> user says "continue" -> work resumes cleanly
```

## Why this exists

OpenClaw sessions are isolated. When a long conversation approaches the model
context limit, users need a reliable way to carry work into a new session.

This plugin standardizes that flow by doing two things:

- injecting context usage reminders during the conversation
- injecting a startup policy that tells a fresh session how to continue only
  when the user clearly asks to continue

## What It Feels Like

### During a long session

```text
Current context usage: 78% (156,000 / 200,000 tokens), remaining 22%.
System reminder: this conversation is at the critical threshold.
I already wrote a handoff file for you.
Start a new session and simply say: continue
```

### In the next session

```text
User: continue

Assistant behavior:
- find the latest handoff file
- read only that file
- continue from key decisions, todos, and next steps
```

## Features

- Per-turn context usage injection
- Warning and critical thresholds
- Automatic handoff file creation at critical threshold
- Manual handoff creation on natural-language request
- Handoff file supplements when the same session continues after the first
  automatic handoff
- Bootstrap policy injection for new sessions
- Agent-friendly installation contract for npm, GitHub, or local path installs

## Quick Start

### Install from npm

```bash
openclaw plugins install openclaw-context-handoff
openclaw plugins enable context-monitor
openclaw gateway restart
openclaw plugins info context-monitor
```

### Install from GitHub or local source

```bash
scripts/agent-install.sh https://github.com/vinsew/openclaw-context-handoff.git
```

The installer script also accepts:

```bash
scripts/agent-install.sh openclaw-context-handoff
scripts/agent-install.sh /path/to/openclaw-context-handoff
```

## How It Works

1. The plugin injects context usage into each turn.
2. At the warning threshold, it nudges the assistant to prepare for handoff.
3. At the critical threshold, it writes a handoff file automatically.
4. If the current session keeps going, new important user input can be added to
   that handoff file.
5. In a fresh session, the assistant reads the latest handoff only if the user
   explicitly signals continuation intent.

## Default Behavior

- npm package name: `openclaw-context-handoff`
- internal plugin id: `context-monitor`
- handoff directory: `memory/handoff`
- handoff filename prefix: `context-handoff`
- warning threshold: `50`
- critical threshold: `75`

The internal plugin id remains `context-monitor` to preserve compatibility with
existing OpenClaw configuration.

## Configuration

Most users do not need manual configuration. If you do, configure
`plugins.entries["context-monitor"].config`.

| Field | Default | Purpose |
| --- | --- | --- |
| `showAlways` | `false` | Show usage on every turn even below warning threshold |
| `warnPercent` | `50` | Warning threshold |
| `criticalPercent` | `75` | Critical threshold |
| `handoffEnabled` | `true` | Enable bootstrap policy injection |
| `handoffDir` | `memory/handoff` | Directory used for handoff files |
| `handoffFilePrefix` | `context-handoff` | Handoff file prefix |
| `handoffUseTimestamp` | `true` | Append timestamp to handoff filenames |
| `handoffInstruction` | built-in policy | Override bootstrap policy text |

Detailed docs:

- [Configuration](./docs/configuration.md)
- [Behavior](./docs/behavior.md)
- [Agent Bootstrap Contract](./AGENT-BOOTSTRAP.md)
- [Release Guide](./docs/release.md)

## Example Flow

1. A long session crosses the warning threshold.
2. The assistant starts warning that context usage is getting high.
3. The session crosses the critical threshold.
4. The plugin writes a handoff file automatically.
5. The assistant tells the user to start a new conversation and say
   "continue".
6. The new session reads the latest handoff file only if the user makes that
   intent explicit.

## Repository Standards

This repository is set up so another OpenClaw agent can read it and install the
plugin without hand-editing `openclaw.json`.

Project docs included in this repository:

- [Contributing](./CONTRIBUTING.md)
- [Security](./SECURITY.md)
- [Changelog](./CHANGELOG.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)

## Who This Is For

- OpenClaw users who regularly hit long-session context limits
- Agent-first workflows where users want to say "continue" instead of manually
  pointing to files
- Plugin builders who want a portable, installable continuity pattern

## Contributing

Small fixes and documentation improvements are welcome. For anything larger,
open an issue first so we can align on behavior before changing plugin logic.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

MIT
