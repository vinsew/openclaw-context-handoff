# OpenClaw Context Handoff

[![npm version](https://img.shields.io/npm/v/openclaw-context-handoff.svg)](https://www.npmjs.com/package/openclaw-context-handoff)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-plugin-black.svg)](https://github.com/vinsew/openclaw-context-handoff)

> 中文：给每一段长 OpenClaw 对话一个安全、可恢复的上下文交接机制。  
> English: Give every long OpenClaw conversation a safe, resumable handoff.

## 简介 | Overview

`openclaw-context-handoff` 是一个 OpenClaw 插件，用来监控会话上下文占比，并把交接规则注入到 Agent 的 system prompt 里，让 Agent 在触发规则时写出一份足够给新 AI 实例无缝接棒的完整交接报告。

`openclaw-context-handoff` is an OpenClaw plugin that monitors context usage and injects handoff rules into the agent system prompt, so the agent writes a full handoff report when the rules fire, detailed enough for a fresh AI instance to continue seamlessly.

## 核心能力 | Features

- 在用户触发轮次注入上下文使用信息 / Inject context usage on user-triggered turns
- 到达预警阈值时提醒 / Warn at the configured threshold
- 到达 critical 阈值时注入强提醒 / Inject a stronger reminder at the critical threshold
- 通过 system prompt 注入交接规范 / Inject the handoff policy into the system prompt
- 新会话里只在用户明确“继续”时允许读取交接 / Only allow handoff reading when the user explicitly asks to continue
- 兼容 npm、GitHub 仓库和本地路径安装 / Support npm, GitHub, and local-path installs

## 一眼看懂 | At a Glance

```text
长对话 -> 上下文变高 -> 插件注入 handoff 规则与提醒 ->
触发规则就必须写交接 -> 用户开启新会话说“继续” -> AI 读取最新交接并接着做

Long conversation -> context gets high -> plugin injects handoff rules and reminders ->
the trigger fires so the agent must write a full handoff report -> user starts a new session and says "continue" -> AI resumes from the latest handoff
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
我必须在这一轮写一份完整交接报告，并告诉你相对路径。
如需在新会话继续，你直接说“继续”。

Current context usage: 78% (156,000 / 200,000 tokens), remaining 22%.
System reminder: this session has reached the critical threshold.
I must write a full handoff report according to the injected rules and tell you the relative path.
If you want to continue in a fresh session, simply say: continue
```

### 新会话里继续时 | When continuing in the next session

```text
用户 / User: 继续

AI 行为 / Assistant behavior:
- 找到最新的交接文件 / find the latest handoff file
- 只读取这一份 / read only that file
- 把整份交接报告当成主要接棒上下文读完 / read the full handoff report as the main continuation context
- 优先依据报告里保留的细节继续 / continue using the preserved details in that report
```

## 安装方式 | Installation

### 通过 npm 安装 | Install from npm

```bash
openclaw plugins install openclaw-context-handoff
openclaw plugins enable openclaw-context-handoff
openclaw gateway restart
openclaw plugins info openclaw-context-handoff
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

1. 插件在用户触发的对话轮次里注入上下文使用比例。  
   The plugin injects context usage into user-triggered turns.
2. 插件把 handoff 规范注入到 system prompt。  
   The plugin injects the handoff policy into the system prompt.
3. 达到 warning 阈值后，插件提醒 Agent 开始准备 handoff。  
   After the warning threshold, the plugin tells the agent to start preparing a handoff.
4. 达到 critical 阈值或用户明确要求写交接时，Agent 必须执行交接，不得主观跳过。  
   At the critical threshold, or when the user explicitly asks for a handoff, the agent must execute it and may not skip it based on its own judgment.
5. 新会话只有在用户明确表达“继续”意图时，才会读取最新交接文件。  
   A fresh session reads the latest handoff file only when the user clearly signals continuation intent.

这意味着：只要达到 critical 阈值，或者用户明确要求写交接，就必须交接；聊天、灵感、思路讨论也不能跳过。

This means that once the session reaches the critical threshold, or the user
explicitly asks for a handoff, the assistant must write one. Casual chat,
brainstorming, and idea exploration are not exceptions.

## 交接质量标准 | Handoff Quality Bar

- 不是短摘要，而是一份完整 Markdown 交接报告  
  Not a short summary, but a full Markdown handoff report
- 细节保留优先于简洁、篇幅和形式感  
  Preserve details before optimizing for brevity, length, or polish
- 目标是交给一个全新的 AI 实例后，也能无缝继续  
  The goal is seamless continuation by a fresh AI instance
- 必须保留容易丢失但继续时关键的信息：用户原话、命名、判断标准、关键文件、命令、报错、约束、下一步  
  Preserve the easy-to-lose but continuation-critical details: user wording, naming, success criteria, files, commands, errors, constraints, and next steps
- 如果不确定某个细节后续是否重要，默认保留  
  If unsure whether a detail may matter later, keep it
- 即使只是聊天、思路或灵感讨论，也要写出足够完整的脉络、观点、未决问题和可展开方向  
  Even for chat, brainstorming, or idea exploration, the handoff must capture the thread, major ideas, open questions, and possible next directions

## 默认行为 | Default Behavior

- 包名 / npm package: `openclaw-context-handoff`
- 内部插件 ID / internal plugin id: `openclaw-context-handoff`
- 交接目录 / handoff directory: `memory/handoff`
- 文件名前缀 / filename prefix: `context-handoff`
- 预警阈值 / warning threshold: `50`
- critical 阈值 / critical threshold: `75`

内部插件 ID 统一为 `openclaw-context-handoff`，与公开 npm 包名保持一致。

The internal plugin id is now `openclaw-context-handoff`, matching the public npm package name.

## 配置项 | Configuration

多数用户不需要手动配置。如果需要，可以配置 `plugins.entries["openclaw-context-handoff"].config`。

Most users do not need manual configuration. If needed, configure `plugins.entries["openclaw-context-handoff"].config`.

| 字段 Field | 默认值 Default | 说明 Description |
| --- | --- | --- |
| `showAlways` | `false` | 每个用户触发轮次都显示上下文占比 / Show usage on every user-triggered turn |
| `warnPercent` | `50` | 预警阈值 / Warning threshold |
| `criticalPercent` | `75` | critical 强提醒阈值 / Critical reminder threshold |
| `handoffEnabled` | `true` | 是否启用 handoff 规则注入 / Enable handoff policy injection |
| `handoffDir` | `memory/handoff` | 工作区相对交接目录 / Workspace-relative handoff directory |
| `handoffFilePrefix` | `context-handoff` | 文件名前缀 / Filename prefix |
| `handoffUseTimestamp` | `true` | 是否附带时间戳 / Append timestamp to filenames |
| `handoffInstruction` | built-in policy | 覆盖默认继续规则（插件会自动附加内部验证标记） / Override continuation policy text (the plugin automatically adds an internal verification marker) |

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
4. Agent 按 handoff 规则强制写入交接。  
   The agent writes a handoff as required by the injected policy.
5. AI 告知用户相对路径，并提示新会话可直接说“继续”。  
   The assistant reports the relative path and suggests saying "continue" in a new session.
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
