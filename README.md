# OpenClaw Context Handoff

[![npm version](https://img.shields.io/npm/v/openclaw-context-handoff.svg)](https://www.npmjs.com/package/openclaw-context-handoff)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-plugin-black.svg)](https://github.com/vinsew/openclaw-context-handoff)

> 中文：给每一段长 OpenClaw 对话一个安全、可恢复的上下文交接机制。  
> English: Give every long OpenClaw conversation a safe, resumable handoff.

## 简介 | Overview

`openclaw-context-handoff` 是一个 OpenClaw 插件，用来监控会话上下文占比，并在对话接近上限时自动生成交接文件，让用户可以在新会话里通过一句“继续”平滑接续之前的工作。

`openclaw-context-handoff` is an OpenClaw plugin that monitors context usage and automatically creates a handoff file when a conversation gets too full, so a new session can continue cleanly with a simple "continue" style intent.

## 核心能力 | Features

- 每轮注入上下文使用比例 / Inject context usage on every turn
- 到达预警阈值时提醒 / Warn at the configured threshold
- 到达 critical 阈值时自动写交接文件 / Automatically write a handoff file at the critical threshold
- 支持用户自然语言手动触发交接 / Support manual handoff requests in natural language
- 同一会话继续时可补充交接内容 / Append follow-up notes if the same session continues
- 新会话启动时注入“继续规则”虚拟文件 / Inject a bootstrap continuation policy for new sessions
- 兼容 npm、GitHub 仓库和本地路径安装 / Support npm, GitHub, and local-path installs

## 一眼看懂 | At a Glance

```text
长对话 -> 上下文变高 -> 插件自动写交接 ->
用户开启新会话 -> 说“继续” -> AI 读取最新交接并接着做

Long conversation -> context gets high -> plugin writes handoff ->
user starts a new session -> says "continue" -> AI resumes from latest handoff
```

## 为什么需要它 | Why This Exists

OpenClaw 的对话天然是隔离的。长对话一旦逼近模型上下文上限，如果没有统一的交接机制，用户就要手动告诉新会话“去哪里找、读哪一个文件、继续什么内容”，这既麻烦也不稳定。

OpenClaw sessions are isolated by design. When a long conversation approaches the model context limit, users need a reliable way to move work into a new session without manually explaining where to look, what to read, and what to continue.

这个插件做的，就是把这件事变成一个可复用、可移植、可安装的标准流程。

This plugin turns that problem into a portable, installable, reusable workflow.

## 使用体验 | What It Feels Like

### 当前会话快满时 | When the current session is getting full

```text
当前上下文使用：78%（156,000 / 200,000 tokens），剩余 22%。
系统提醒：当前会话已到 critical 阈值。
我已经为你写好交接文件。
请开启一个新会话，并直接告诉我：“继续”。

Current context usage: 78% (156,000 / 200,000 tokens), remaining 22%.
System reminder: this session has reached the critical threshold.
I already wrote a handoff file for you.
Start a new session and simply say: continue
```

### 新会话里继续时 | When continuing in the next session

```text
用户 / User: 继续

AI 行为 / Assistant behavior:
- 找到最新的交接文件 / find the latest handoff file
- 只读取这一份 / read only that file
- 从关键决策、待办、下一步继续 / continue from key decisions, todos, and next steps
```

## 安装方式 | Installation

### 通过 npm 安装 | Install from npm

```bash
openclaw plugins install openclaw-context-handoff
openclaw plugins enable context-monitor
openclaw gateway restart
openclaw plugins info context-monitor
```

### 通过 GitHub 或本地路径安装 | Install from GitHub or local source

```bash
scripts/agent-install.sh https://github.com/vinsew/openclaw-context-handoff.git
```

这个安装脚本也支持下面两种输入：

The installer script also accepts these inputs:

```bash
scripts/agent-install.sh openclaw-context-handoff
scripts/agent-install.sh /path/to/openclaw-context-handoff
```

## 工作方式 | How It Works

1. 插件在每轮对话中注入上下文使用比例。  
   The plugin injects context usage into each turn.
2. 达到 warning 阈值后，AI 会开始提醒用户准备交接。  
   After the warning threshold, the assistant starts nudging the user toward handoff.
3. 达到 critical 阈值后，插件自动写入交接文件。  
   At the critical threshold, the plugin writes a handoff file automatically.
4. 如果当前会话继续产生新信息，插件可以把新增内容补进同一份交接文件。  
   If the same session continues, the plugin can append new information to the same handoff file.
5. 新会话只有在用户明确表达“继续”意图时，才会读取最新交接文件。  
   A fresh session reads the latest handoff file only when the user clearly signals continuation intent.

## 默认行为 | Default Behavior

- 包名 / npm package: `openclaw-context-handoff`
- 内部插件 ID / internal plugin id: `context-monitor`
- 交接目录 / handoff directory: `memory/handoff`
- 文件名前缀 / filename prefix: `context-handoff`
- 预警阈值 / warning threshold: `50`
- critical 阈值 / critical threshold: `75`

内部插件 ID 保持为 `context-monitor`，这样可以继续兼容现有的 OpenClaw 配置。

The internal plugin id stays `context-monitor` so existing OpenClaw configuration remains compatible.

## 配置项 | Configuration

多数用户不需要手动配置。如果需要，可以配置 `plugins.entries["context-monitor"].config`。

Most users do not need manual configuration. If needed, configure `plugins.entries["context-monitor"].config`.

| 字段 Field | 默认值 Default | 说明 Description |
| --- | --- | --- |
| `showAlways` | `false` | 每轮都显示上下文占比 / Show usage on every turn |
| `warnPercent` | `50` | 预警阈值 / Warning threshold |
| `criticalPercent` | `75` | 自动交接阈值 / Automatic handoff threshold |
| `handoffEnabled` | `true` | 是否启用启动时继续规则注入 / Enable bootstrap policy injection |
| `handoffDir` | `memory/handoff` | 交接文件目录 / Handoff directory |
| `handoffFilePrefix` | `context-handoff` | 文件名前缀 / Filename prefix |
| `handoffUseTimestamp` | `true` | 是否附带时间戳 / Append timestamp to filenames |
| `handoffInstruction` | built-in policy | 覆盖默认继续规则 / Override bootstrap policy text |

详细文档：

Detailed docs:

- [配置说明 | Configuration](./docs/configuration.md)
- [行为说明 | Behavior](./docs/behavior.md)
- [Agent 安装契约 | Agent Bootstrap Contract](./AGENT-BOOTSTRAP.md)
- [发布说明 | Release Guide](./docs/release.md)

## 示例流程 | Example Flow

1. 一段长对话达到了 warning 阈值。  
   A long conversation crosses the warning threshold.
2. AI 开始提醒上下文偏高。  
   The assistant starts warning that context usage is getting high.
3. 会话达到 critical 阈值。  
   The session reaches the critical threshold.
4. 插件自动写入交接文件。  
   The plugin writes a handoff file automatically.
5. AI 告诉用户开启新会话并直接说“继续”。  
   The assistant tells the user to start a new conversation and say "continue".
6. 新会话只在用户明确表达继续意图时才读取最新交接。  
   The new session reads the latest handoff only when the user explicitly asks to continue.

## 适合谁用 | Who This Is For

- 经常遇到长对话上下文上限的 OpenClaw 用户  
  OpenClaw users who regularly hit long-session context limits
- 希望用户只说一句“继续”就能接续的 Agent 工作流  
  Agent-first workflows where users want to say "continue" instead of pointing to files
- 想把上下文交接做成可移植插件能力的开发者  
  Plugin builders who want a portable continuity pattern

## 仓库标准 | Repository Standards

这个仓库被设计成 agent 也能读懂和安装的形式，不要求人手动修改 `openclaw.json`。

This repository is intentionally structured so another OpenClaw agent can read it and install the plugin without hand-editing `openclaw.json`.

项目文档：

Project docs:

- [贡献指南 | Contributing](./CONTRIBUTING.md)
- [安全说明 | Security](./SECURITY.md)
- [更新记录 | Changelog](./CHANGELOG.md)
- [行为准则 | Code of Conduct](./CODE_OF_CONDUCT.md)

## 贡献 | Contributing

欢迎小修复、文档优化和兼容性改进。若要改动交接语义、阈值规则或默认行为，建议先提 issue 对齐方向。

Small fixes, documentation improvements, and compatibility work are welcome. For changes that affect handoff semantics, thresholds, or default behavior, please open an issue first.

详见：

See:

- [CONTRIBUTING.md](./CONTRIBUTING.md)

## 许可证 | License

MIT
