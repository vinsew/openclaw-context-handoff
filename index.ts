import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { dirname, isAbsolute, join } from "path";

function resolveStateDir() {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  return process.env.OPENCLAW_STATE_DIR || join(home, ".openclaw");
}

function resolveAgentId(sessionKey: string) {
  const parts = (sessionKey || "").split(":");
  if (parts[0] === "agent" && parts[1]) {
    return parts[1];
  }
  return "main";
}

function resolveHandoffDir(stateDir: string, handoffDir: string) {
  if (!handoffDir) {
    return join(stateDir, "memory", "handoff");
  }
  return isAbsolute(handoffDir) ? handoffDir : join(stateDir, handoffDir);
}

function formatTimestamp() {
  return new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 17);
}

function sanitizePathSegment(value: string, fallback = "session") {
  const normalized = (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return normalized || fallback;
}

function extractText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part: any) => {
      if (part && typeof part.text === "string") return part.text;
      if (typeof part === "string") return part;
      if (part && typeof part.content === "string") return part.content;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function getLatestUserMessage(ctx: any) {
  const messages = Array.isArray(ctx?.messages) ? ctx.messages : [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const role = message?.role || message?.message?.role;
    if (role !== "user") {
      continue;
    }
    const text = extractText(message.content ?? message.message?.content);
    if (text) {
      return text;
    }
  }
  return "";
}

function collectRecentTranscript(logPath: string, limitPairs = 4) {
  const pairs: Array<{ role: "user" | "assistant"; text: string }> = [];
  try {
    const raw = readFileSync(logPath, "utf-8").trim();
    if (!raw) {
      return pairs;
    }

    const lines = raw.split("\n");
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const message = entry?.message;
        const role = message?.role;
        if (role !== "user" && role !== "assistant") {
          continue;
        }
        const text = extractText(message?.content);
        if (!text) {
          continue;
        }
        pairs.push({ role, text: text.trim() });
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  if (pairs.length === 0) {
    return [];
  }

  return pairs.slice(-limitPairs * 2);
}

function summarizeRoleText(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 240) {
    return compact;
  }
  return `${compact.slice(0, 240)}...`;
}

function getLatestTranscriptForHandoff(ctx: any, logPath: string) {
  const transcript: Array<{ role: "user" | "assistant"; text: string }> = [];
  const messages = Array.isArray(ctx?.messages) ? ctx.messages : [];
  for (const m of messages) {
    const role = m?.role || m?.message?.role;
    const text = extractText(m?.content ?? m?.message?.content);
    if ((role === "user" || role === "assistant") && text) {
      transcript.push({ role, text: summarizeRoleText(text) });
    }
  }

  if (transcript.length >= 2) {
    return transcript.slice(-8);
  }

  return collectRecentTranscript(logPath, 4);
}

function stripSignature(text: string) {
  return text.replace(/\s+/g, "").slice(0, 180);
}

function looksLikeWriteHandoffIntent(text: string) {
  return /写交接|生成交接|记录交接|保存交接|handoff|交接文件/.test(text);
}

function buildBootstrapInstruction(options: { handoffDir: string; handoffFilePrefix: string }) {
  return [
    "## Context Continuation Policy（只在用户明确继续意图时才读取）",
    "",
    "默认规则：在新会话中，除非用户明确说出“继续 / 接着聊 / 继续上次对话 / resume”，否则**不要**读取任何交接文件。",
    "",
    `交接目录固定为：${options.handoffDir}`,
    `文件名规则前缀：${options.handoffFilePrefix}，建议格式：${options.handoffFilePrefix}-YYYYMMDDHHMMSSsss-session.md`,
    "",
    "新会话中，当用户明确说“继续”时：",
    "1. 在上述目录找最新时间戳的交接文件；",
    "2. 只读一个最新文件；",
    "3. 只读到本文件里的“关键决策/待办/下一步”继续执行。",
    "",
    "如果用户不说继续，正常处理当前会话，不能主动读取交接。",
  ].join("\n");
}

function buildHandoffPath(
  handoffDir: string,
  handoffFilePrefix: string,
  handoffUseTimestamp: boolean,
  sessionKey: string,
) {
  const stamp = handoffUseTimestamp ? `-${formatTimestamp()}` : "";
  const sessionSuffix = `-${sanitizePathSegment(sessionKey)}`;
  const basename = `${handoffFilePrefix}${stamp}${sessionSuffix}.md`;
  return join(handoffDir, basename);
}

function buildHandoffContent(opts: {
  mode: "critical_auto" | "manual";
  sessionKey: string;
  usage: { used: number; total: number; percent: number };
  userMsg: string;
  transcript: Array<{ role: "user" | "assistant"; text: string }>;
}) {
  const createdAt = new Date().toISOString();
  const modeLabel =
    opts.mode === "critical_auto" ? "上下文达到 critical 阈值自动触发" : "用户手动触发";

  return [
    "# Context Handoff",
    "",
    `- 会话：${opts.sessionKey || "unknown"}`,
    `- 生成方式：${modeLabel}`,
    `- 触发时间：${createdAt}`,
    `- 上下文：${opts.usage.used.toLocaleString()} / ${opts.usage.total.toLocaleString()} tokens（${opts.usage.percent}%）`,
    "",
    "## 当前任务目标与进展",
    "- （请按真实任务继续补齐）",
    "",
    "## 关键任务待办",
    "- [ ] 关键任务",
    "",
    "## 决策与约束",
    "- [ ] 关键决策/约束待补充",
    "",
    "## 风险与待确认",
    "- [ ] 待补充",
    "",
    "## 下一步建议",
    "- [ ] 在新会话开头明确说“继续”。",
    "",
    "## 最新上下文片段",
    ...(opts.transcript.length === 0
      ? ["- 暂无可解析片段"]
      : opts.transcript.map((item) => `- ${item.role}: ${item.text}`)),
    "",
    opts.userMsg ? `## 本轮触发原文\n- ${opts.userMsg.slice(0, 300)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSupplementContent(text: string) {
  const safeText = text.trim();
  if (!safeText) {
    return "";
  }

  return [
    "",
    `## 会话补充 ${new Date().toISOString()}`,
    safeText.length > 1400 ? `${safeText.slice(0, 1400)}...` : safeText,
    "",
  ].join("\n");
}

function writeHandoffFile(path: string, content: string, mode: "create" | "append") {
  try {
    mkdirSync(dirname(path), { recursive: true });
    if (mode === "append") {
      writeFileSync(path, content, { encoding: "utf-8", flag: "a" });
      return true;
    }

    writeFileSync(path, content, { encoding: "utf-8", flag: "w" });
    return true;
  } catch (err) {
    debugLog(`[context-monitor] writeHandoffFile failed: ${String((err as Error).message || err)}`);
    return false;
  }
}

function parseNumber(raw: unknown, fallback: number) {
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return num;
}

function debugLog(msg: string) {
  const logLine = `[${new Date().toISOString()}] ${msg}\n`;
  const debugPath = join(resolveStateDir(), "logs", "context-monitor.debug.log");
  try {
    mkdirSync(dirname(debugPath), { recursive: true });
    appendFileSync(debugPath, logLine);
  } catch {}
  console.log(msg);
}

/**
 * Context Monitor v7
 * 1) 每轮注入上下文占比
 * 2) critical 阈值自动写交接文件
 * 3) 手动交接触发
 * 4) bootstrap 虚拟文件注入
 */
export default function register(api: any) {
  const pluginEntry = api?.config?.plugins?.entries?.["context-monitor"] || {};
  const pluginConfig = pluginEntry.config || {};

  const showAlways = pluginConfig.showAlways ?? false;
  const warnPercent = parseNumber(pluginConfig.warnPercent, 50);
  const criticalPercent = parseNumber(pluginConfig.criticalPercent, 75);

  const stateDir = resolveStateDir();
  const handoffEnabled = pluginConfig.handoffEnabled ?? true;
  const handoffDirConfig = pluginConfig.handoffDir || "memory/handoff";
  const handoffDir = resolveHandoffDir(stateDir, handoffDirConfig);
  const handoffFilePrefix = pluginConfig.handoffFilePrefix || "context-handoff";
  const handoffUseTimestamp = pluginConfig.handoffUseTimestamp ?? true;
  const handoffInstruction =
    pluginConfig.handoffInstruction ||
    buildBootstrapInstruction({
      handoffDir: handoffDirConfig,
      handoffFilePrefix,
    });

  const handoffState = new Map<
    string,
    {
      path: string;
      lastUserSig: string;
      mode: "critical" | "manual" | "supplemented";
      createdAt: string;
      usagePercent: number;
    }
  >();

  const findOrCreateStatePath = (sessionKey: string) => {
    const existing = handoffState.get(sessionKey);
    if (existing?.path) {
      return existing.path;
    }

    const path = buildHandoffPath(
      handoffDir,
      handoffFilePrefix,
      handoffUseTimestamp,
      sessionKey,
    );
    handoffState.set(sessionKey, {
      path,
      lastUserSig: "",
      mode: "critical",
      createdAt: new Date().toISOString(),
      usagePercent: 0,
    });
    return path;
  };

  const writeHandoff = (
    sessionKey: string,
    usage: { used: number; total: number; percent: number },
    mode: "critical_auto" | "manual",
    ctx: any,
    userText: string,
  ) => {
    const path = findOrCreateStatePath(sessionKey);
    const logPath = join(
      stateDir,
      "agents",
      resolveAgentId(sessionKey),
      "sessions",
      `${sessionKey}.jsonl`,
    );
    const transcript = getLatestTranscriptForHandoff(ctx, logPath);
    const content = buildHandoffContent({
      mode,
      sessionKey,
      usage,
      userMsg: userText,
      transcript,
    });

    const ok = writeHandoffFile(path, content, "create");
    if (!ok) {
      return {
        ok: false,
        path,
        mode,
        message: "交接文件落盘失败，请稍后重试。",
      };
    }

    handoffState.set(sessionKey, {
      path,
      lastUserSig: stripSignature(userText),
      mode: mode === "critical_auto" ? "critical" : "manual",
      createdAt: new Date().toISOString(),
      usagePercent: usage.percent,
    });

    return {
      ok: true,
      path,
      mode,
      message:
        mode === "critical_auto"
          ? "已按规则自动写入交接文件。"
          : "已按你要求写入交接文件。",
    };
  };

  const appendHandoffSupplement = (sessionKey: string, userText: string) => {
    const state = handoffState.get(sessionKey);
    if (!state?.path) {
      return { ok: false, reason: "无可追踪交接文件" };
    }

    const signature = stripSignature(userText);
    if (!userText || !signature || signature === state.lastUserSig) {
      return { ok: false, reason: "内容未变化，不需要补充" };
    }

    const supplement = buildSupplementContent(`- 用户补充：${userText}`);
    if (!supplement) {
      return { ok: false, reason: "补充内容为空" };
    }

    const ok = writeHandoffFile(state.path, supplement, "append");
    if (!ok) {
      return { ok: false, reason: "追加失败" };
    }

    state.lastUserSig = signature;
    state.mode = "supplemented";
    handoffState.set(sessionKey, state);
    return { ok: true, path: state.path };
  };

  const readSessionAndLogUsage = (sessionKey: string) => {
    try {
      const agentId = resolveAgentId(sessionKey);

      const sessionsPath = join(
        stateDir,
        "agents",
        agentId,
        "sessions",
        "sessions.json",
      );
      const raw = readFileSync(sessionsPath, "utf-8");
      const sessions = JSON.parse(raw);
      const session = sessions?.[sessionKey];
      if (!session) {
        return null;
      }

      const contextTokens = Number(session.contextTokens);
      let totalTokens = Number(session.totalTokens);

      const logPath = join(
        stateDir,
        "agents",
        agentId,
        "sessions",
        `${sessionKey}.jsonl`,
      );
      if (existsSync(logPath)) {
        const lines = readFileSync(logPath, "utf-8").trim().split("\n");
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry?.__kind === "session_event" && entry?.totalTokens) {
              const logTotal = Number(entry.totalTokens);
              if (Number.isFinite(logTotal) && logTotal > totalTokens) {
                totalTokens = logTotal;
              }
            }
          } catch {
            // ignore
          }
        }
      }

      if (
        !Number.isFinite(totalTokens) ||
        !Number.isFinite(contextTokens) ||
        contextTokens <= 0
      ) {
        return null;
      }

      return {
        used: totalTokens,
        total: contextTokens,
        percent: Math.round((totalTokens / contextTokens) * 100),
      };
    } catch {
      return null;
    }
  };

  const handleBootstrap = (event: any) => {
    if (!handoffEnabled) {
      return;
    }

    if (!event?.context || !Array.isArray(event.context.bootstrapFiles)) {
      return;
    }

    event.context.bootstrapFiles.push({
      path: "CONTEXT_CONTINUATION_POLICY.md",
      content: `${handoffInstruction}\n\n- 触发会话：${event?.sessionKey || "unknown"}\n- 注入时间：${new Date().toISOString()}\n`,
      virtual: true,
    });
  };

  const handleHook = (_event: any, ctx: any) => {
    const sessionKey = ctx?.sessionKey;
    if (!sessionKey) {
      return {};
    }

    const usage = readSessionAndLogUsage(sessionKey);
    if (!usage) {
      return {};
    }

    const percent = Math.max(0, Math.min(1000, usage.percent));
    const remainPercent = Math.max(0, 100 - percent);
    const remainText = `当前上下文使用：${percent}%（${usage.used.toLocaleString()} / ${usage.total.toLocaleString()} tokens），剩余 ${remainPercent}%。`;

    const userText = getLatestUserMessage(ctx);
    const requestWrite = looksLikeWriteHandoffIntent(userText);
    const isCritical = percent >= criticalPercent;
    const isWarn = percent >= warnPercent;
    const state = handoffState.get(sessionKey);

    let injection = "";

    if (requestWrite) {
      const writeResult = writeHandoff(sessionKey, usage, "manual", ctx, userText);
      injection = [
        "\n\n## 🧩 Handoff Command",
        remainText,
        `${writeResult.ok ? "✅" : "⚠️"} ${writeResult.message}`,
        writeResult.ok
          ? `已写入：${writeResult.path}`
          : "请确认可写目录并重试。",
        "你可在新会话直接说“继续”，无需手动指定文件。",
      ].join("\n");
      return { prependContext: injection };
    }

    if (isCritical) {
      if (!state?.path) {
        const writeResult = writeHandoff(sessionKey, usage, "critical_auto", ctx, userText);
        injection = [
          "\n\n## 🚨 CONTEXT WINDOW CRITICAL ALERT 🚨",
          remainText,
          "系统级提醒：当前会话已到 critical 阈值，建议你开启新会话继续。",
          writeResult.ok
            ? "✅ 已按规则自动写入上下文交接文件。"
            : `⚠️ ${writeResult.message}`,
          writeResult.ok
            ? `交接文件：${writeResult.path}`
            : "请在新会话手动说“写交接”。",
          "新会话请先说“继续”即可接续。",
        ].join("\n");
      } else {
        const appended = appendHandoffSupplement(sessionKey, userText);
        injection = [
          "\n\n## 🚨 CONTEXT WINDOW CRITICAL ALERT 🚨",
          remainText,
          "系统级提醒：当前会话已到 critical 阈值，建议你开启新会话继续。",
          `当前已有交接文件：${state.path}`,
          appended.ok
            ? "✅ 已补充本轮新增内容到交接文件。"
            : `- ${appended.reason}`,
          "新会话请先说“继续”即可接续。",
        ].join("\n");
      }
    } else if (isWarn && !state?.path) {
      injection = [
        "\n\n## ⚠️ Context Usage Notice",
        remainText,
        "系统提示：上下文占比较高，建议提前准备交接；可在需要时说“写交接”。",
      ].join("\n");
    } else if (isWarn && state?.path) {
      injection = [
        "\n\n## ⚠️ Context Usage Notice",
        remainText,
        `上下文偏高，已存在交接文件：${state.path}`,
      ].join("\n");
    } else if (showAlways) {
      injection = `\n[Context: ${percent}% used (${usage.used.toLocaleString()}/${usage.total.toLocaleString()} tokens)]`;
    }

    return injection ? { prependContext: injection } : {};
  };

  api.on(
    "agent:bootstrap",
    (event: any) => {
      handleBootstrap(event);
    },
    { priority: 50 },
  );

  api.on(
    "before_prompt_build",
    (_event: any, ctx: any) => handleHook(_event, ctx),
    { priority: 50 },
  );
}
