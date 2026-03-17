# Changelog

所有重要变更都会记录在这里。  
All notable changes to this project will be documented in this file.

## 1.0.6 - 2026-03-18

### 中文

- 调整 warn / critical 阈值提醒文案：在接近上限时直接重述交接目录、相对路径要求、建议文件名和 continue 读取规则，避免只引用远处的启动规则导致路径口径漂移

### English

- Updated the warn / critical threshold reminders to restate the handoff directory, relative-path requirement, filename guidance, and continue rule inline, so late-turn reminders do not rely on distant startup policy context

## 1.0.5 - 2026-03-13

### 中文

- 调整 handoff 规则：一旦达到 critical 阈值，或用户明确要求写交接，就必须执行交接
- 去掉“由 Agent 主观判断这段对话是否值得交接”的空间，聊天、灵感、思路讨论也需要交接
- 调整交接内容要求：没有明确任务时，至少记录本轮主题、讨论脉络、关键观点、未决问题和下一步方向
- 提升交接质量标准：默认写成可直接交给新 AI 实例接棒的完整 Markdown 交接报告，而不是简短摘要
- 调整 continue 规则：新会话继续时应完整读取最新交接报告，并优先依据其中保留的细节接棒

### English

- Updated the handoff rule so reaching the critical threshold, or receiving an explicit handoff request from the user, now makes handoff execution mandatory
- Removed the Agent's discretion to decide whether a conversation is "worth" handing off; chat, brainstorming, and idea exploration must also be handed off
- Updated the handoff content requirements so non-task conversations still capture the current theme, discussion thread, key points, open questions, and next direction
- Raised the handoff quality bar so the default output is a full Markdown continuation report for a fresh AI instance, not a short summary
- Updated the continue rule so fresh sessions should read the latest handoff report in full and continue from its preserved details

## 1.0.4 - 2026-03-12

### 中文

- 重构插件职责边界：插件只负责注入 handoff 规则与上下文信号，不再直接写交接文件
- 将 handoff 路径语义统一为工作区相对路径，默认仍为 `memory/handoff`
- 移除基于内部启动文案的脆弱首轮判断逻辑，改为对用户触发轮次稳定注入 handoff policy
- 收紧触发边界：仅在 `ctx.trigger === "user"` 的轮次注入 handoff policy
- 修复 token 用量刷新路径，改为优先按 `sessionId` 读取 transcript
- 将 transcript token 刷新改为尾部扫描，并补齐和 OpenClaw `/status` 更接近的 context window / fresh token fallback 语义
- 为默认和自定义 handoffInstruction 统一附加内部 marker，避免日志误报 `missing`
- 删除已失效的 `contextWindow` 和 `charsPerToken` 配置项
- 将内部插件 ID 统一为 `openclaw-context-handoff`，不再保留旧的 `context-monitor` 兼容名
- 将调试日志文件统一为 `openclaw-context-handoff.debug.log`
- 修复 `llm_input` 调试日志依赖缺失 `trigger` 的问题，改为按实际注入事件追踪最终 `present/missing`
- 为 pending handoff policy 验证日志补充 `agent_end` 清理，避免异常中断后残留状态污染后续日志
- 删除过时的本地安装路径声明，避免独立仓库场景下给出错误的 local install 提示
- 修复安装脚本对带 `@` 的本地路径误判，并把 README 链接到的 docs 一起纳入 npm 包
- 更新发布说明，要求同步更新 `package.json` 与 `openclaw.plugin.json` 版本号

### English

- Reworked the plugin boundary so it only injects handoff rules and context signals instead of writing handoff files directly
- Unified handoff path semantics as workspace-relative paths, still defaulting to `memory/handoff`
- Removed the fragile first-turn detection based on internal startup prompt wording and switched to stable policy injection for user-triggered runs
- Tightened the trigger boundary so handoff policy injection only runs when `ctx.trigger === "user"`
- Fixed token usage refresh to prefer session transcripts addressed by `sessionId`
- Switched transcript token refresh to tail scanning and aligned context-window / fresh-token fallback behavior more closely with OpenClaw `/status`
- Added a stable internal marker to both default and custom handoff instructions so logs no longer misreport successful injection as `missing`
- Removed the stale `contextWindow` and `charsPerToken` configuration knobs
- Unified the internal plugin id as `openclaw-context-handoff` and dropped the old `context-monitor` compatibility id
- Renamed the debug log file to `openclaw-context-handoff.debug.log`
- Fixed `llm_input` debug logging so final `present/missing` verification no longer depends on a missing `trigger` field
- Added `agent_end` cleanup for pending handoff-policy verification logs so aborted runs do not leak stale debug state
- Removed the stale bundled local install path so standalone clones no longer surface a broken local install hint
- Fixed installer path detection for local directories containing `@`, and bundled the README-linked docs into the npm package
- Updated the release guide so both `package.json` and `openclaw.plugin.json` versions must be bumped together

## 1.0.3 - 2026-03-11

### 中文

- 修复调试日志路径变量写错，确保失败信息会落盘到 `context-monitor.debug.log`
- 修复交接文件名在同一分钟内可能冲突的问题，改为使用更高精度时间戳并附带会话标识
- 更新默认交接文件命名说明，和实际生成规则保持一致

### English

- Fixed the debug log path typo so failures are persisted to `context-monitor.debug.log`
- Fixed same-minute handoff filename collisions by using a higher-precision timestamp plus a session-specific suffix
- Updated the default handoff filename guidance so the docs match the generated filenames

## 1.0.2 - 2026-03-11

### 中文

- 将 README 调整为中英双语首页
- 将发布说明文档改为中英双语规范
- 同步现有版本说明到中英双语格式
- 重新发布 npm 包，使 npm 页面同步最新双语 README

### English

- Turned the README into a bilingual Chinese-English landing page
- Updated the release guide to require bilingual release notes
- Synced the existing release messaging to a bilingual format
- Republished the npm package so the npm page reflects the latest bilingual README

## 1.0.1 - 2026-03-11

### 中文

- 完善了公开开源版本的项目文档
- 新增贡献指南、安全说明、更新记录和行为准则
- 新增配置说明、行为说明和发布说明文档
- 新增 GitHub issue 模板和 pull request 模板
- 完善了 GitHub 仓库的公开项目信息
- 重新发布 npm 包，使 npm 页面同步最新公开文档

### English

- Polished the public open source documentation
- Added contributing, security, changelog, and code of conduct documents
- Added configuration, behavior, and release guides
- Added GitHub issue templates and pull request template
- Improved GitHub repository metadata for public release
- Republished npm package so the package page reflects the public project docs

## 1.0.0 - 2026-03-11

### 中文

- 首次公开发布
- 新增每轮上下文使用比例注入
- 新增 warning 和 critical 阈值逻辑
- 新增达到 critical 阈值时自动写交接文件
- 新增手动触发交接支持
- 新增新会话启动时的继续规则注入
- 新增面向 agent 的安装契约和安装脚本
- 发布 npm 包 `openclaw-context-handoff`
- 在 GitHub 上开源项目

### English

- Initial public release
- Added per-turn context usage injection
- Added warning and critical threshold behavior
- Added automatic handoff file writing at critical threshold
- Added manual handoff trigger support
- Added bootstrap policy injection for new sessions
- Added agent-oriented install contract and installer script
- Published npm package `openclaw-context-handoff`
- Open-sourced the project on GitHub
