# Context Monitor Plugin — 详细开发 Plan

## 目标
写一个 OpenClaw Plugin，在每一轮对话中自动注入当前上下文使用百分比。
超过阈值时，以系统级指令强制要求 AI 提醒用户。

## 核心机制
利用 OpenClaw Plugin 的 `before_prompt_build` 生命周期钩子：
- 该钩子在每一轮 AI 看到 prompt **之前**执行
- 可以通过 `appendSystemContext` 向 system prompt 末尾追加文本
- 追加的文本 AI **必须看到**，不依赖 AI 自身记忆

## 文件结构

```
~/.openclaw/extensions/context-monitor/
├── openclaw.plugin.json    # Plugin manifest（告诉 OpenClaw 这是啥）
└── index.ts                # 核心逻辑
```

## 文件1：openclaw.plugin.json

```json
{
  "id": "context-monitor",
  "name": "Context Monitor",
  "version": "1.0.0",
  "description": "每轮对话自动注入上下文使用百分比，超阈值强制提醒用户",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "contextWindow": {
        "type": "number",
        "description": "模型的上下文窗口大小（tokens），默认 200000"
      },
      "showAlways": {
        "type": "boolean",
        "description": "是否每轮都显示百分比（false=仅超阈值时显示）"
      },
      "warnPercent": {
        "type": "number",
        "description": "警告阈值百分比，默认 50"
      },
      "criticalPercent": {
        "type": "number",
        "description": "强制提醒阈值百分比，默认 75"
      },
      "charsPerToken": {
        "type": "number",
        "description": "每 token 平均字符数（中文约2.5，英文约4），默认 3"
      }
    }
  },
  "uiHints": {
    "contextWindow": { "label": "Context Window (tokens)", "placeholder": "200000" },
    "warnPercent": { "label": "Warning Threshold (%)", "placeholder": "50" },
    "criticalPercent": { "label": "Critical Threshold (%)", "placeholder": "75" }
  }
}
```

## 文件2：index.ts

核心逻辑：

```typescript
export default function register(api: any) {
  // 从 plugin config 读取配置，提供默认值
  const pluginConfig = api.config?.plugins?.entries?.["context-monitor"]?.config || {};
  const contextWindow = pluginConfig.contextWindow || 200000;
  const showAlways = pluginConfig.showAlways || false;
  const warnPercent = pluginConfig.warnPercent || 50;
  const criticalPercent = pluginConfig.criticalPercent || 75;
  const charsPerToken = pluginConfig.charsPerToken || 3;

  api.on("before_prompt_build", (event: any, ctx: any) => {
    // 1. 从 ctx.messages 估算已使用 tokens
    const messages = ctx.messages || [];
    let totalChars = 0;
    for (const msg of messages) {
      // 累加所有消息内容的字符数
      if (typeof msg.content === "string") {
        totalChars += msg.content.length;
      } else if (Array.isArray(msg.content)) {
        // content 可能是数组（多模态消息）
        for (const part of msg.content) {
          if (part.type === "text" && typeof part.text === "string") {
            totalChars += part.text.length;
          }
        }
      }
      // 工具调用的结果也算
      if (msg.tool_calls) {
        totalChars += JSON.stringify(msg.tool_calls).length;
      }
    }

    // 2. 估算 token 数
    //    注意：这只是对话历史部分，system prompt 本身（约 10k-15k tokens）未计入
    //    加一个固定开销估算（system prompt + tool schemas）
    const systemPromptOverhead = 15000; // 保守估计 system prompt 约 15k tokens
    const estimatedHistoryTokens = Math.ceil(totalChars / charsPerToken);
    const estimatedTotalTokens = estimatedHistoryTokens + systemPromptOverhead;
    const usedPercent = Math.round((estimatedTotalTokens / contextWindow) * 100);
    const remainPercent = Math.max(0, 100 - usedPercent);

    // 3. 根据阈值决定注入内容
    let injection = "";

    if (usedPercent >= criticalPercent) {
      // 🚨 强制提醒级别
      injection = `

## 🚨 CONTEXT WINDOW CRITICAL ALERT 🚨
当前上下文使用：约 ${usedPercent}%（${estimatedTotalTokens.toLocaleString()} / ${contextWindow.toLocaleString()} tokens），剩余约 ${remainPercent}%。
⚠️ 强制要求：你必须在本轮回复的开头或结尾提醒用户"上下文即将用完，建议开新会话"。
如果有重要进度，先保存交接文件（Context Handoff Protocol），再提醒用户。
这不是建议，是系统级强制指令。`;
    } else if (usedPercent >= warnPercent) {
      // ⚠️ 警告级别
      injection = `

## ⚠️ Context Usage Notice
当前上下文使用：约 ${usedPercent}%（${estimatedTotalTokens.toLocaleString()} / ${contextWindow.toLocaleString()} tokens），剩余约 ${remainPercent}%。
如果对话还会继续较长时间，适当时候提醒用户可以考虑开新会话。`;
    } else if (showAlways) {
      // 📊 信息级别（仅 showAlways=true 时）
      injection = `
[Context: ~${usedPercent}% used (${estimatedTotalTokens.toLocaleString()}/${contextWindow.toLocaleString()} tokens)]`;
    }

    if (injection) {
      return { appendSystemContext: injection };
    }
    return {};
  }, { priority: 50 });
}
```

## 关键设计决策

### 为什么用 `appendSystemContext` 而不是 `prependContext`？
- `appendSystemContext` 追加到 system prompt 末尾 → AI 视为系统级指令，权威性最高
- `prependContext` 追加到用户消息前面 → 可能被 AI 忽略

### Token 估算的精度问题
- 纯字符数 ÷ 每 token 字符数是粗估（中文约 2-2.5 字符/token，英文约 3.5-4）
- 加 15000 tokens 固定开销覆盖 system prompt + tool schemas
- 误差范围约 ±15%，但对于"该不该提醒"这个判断来说够用了
- 未来可优化：读 session store 的 `contextTokens` 字段（上一轮 provider 返回的精确值）

### 三级阈值设计
| 使用百分比 | 行为 | 默认值 |
|-----------|------|--------|
| < 50% | 静默（或 showAlways 时显示信息） | — |
| 50% - 75% | 注入 ⚠️ 提示，AI 可选择是否告知用户 | warnPercent=50 |
| ≥ 75% | 注入 🚨 强制指令，AI **必须**提醒用户 | criticalPercent=75 |

## 部署步骤（Plugin 写完后）

1. 文件放到 `~/.openclaw/extensions/context-monitor/` 目录
2. 运行 `openclaw plugins list` 确认被发现
3. 如有需要在 `openclaw.json` 里配置：
   ```json
   {
     "plugins": {
       "entries": {
         "context-monitor": {
           "enabled": true,
           "config": {
             "contextWindow": 200000,
             "criticalPercent": 75,
             "warnPercent": 50,
             "showAlways": false,
             "charsPerToken": 3
           }
         }
       }
     }
   }
   ```
4. 重启 Gateway：`openclaw gateway restart`

## 测试验证

1. 启动后发几条消息，确认 Plugin 正常加载（不报错）
2. 在一个长对话里，观察是否在接近 50% 时看到警告
3. 手动把 `criticalPercent` 设为 10 来测试强制提醒是否生效
4. 测试完恢复正常阈值

## 参考文档
- Plugin 系统：`docs/tools/plugin.md`
- `before_prompt_build` hook：`docs/concepts/agent-loop.md` 第 85 行
- Context 机制：`docs/concepts/context.md`
- System prompt 构建：`docs/concepts/system-prompt.md`
