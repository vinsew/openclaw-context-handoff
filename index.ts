import {
  appendFileSync,
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
} from "fs";
import { dirname, isAbsolute, join } from "path";

const HANDOFF_POLICY_MARKER = "<!-- openclaw-context-handoff:handoff-policy:v1 -->";
const TRANSCRIPT_TAIL_CHUNK_BYTES = 64 * 1024;
const DEFAULT_CONTEXT_TOKENS = 200_000;
const DEFAULT_PROVIDER = "anthropic";
const ANTHROPIC_CONTEXT_1M_TOKENS = 1_048_576;
const ANTHROPIC_1M_MODEL_PREFIXES = ["claude-opus-4-6", "claude-sonnet-4-6"];

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

function debugLog(msg: string) {
  const logLine = `[${new Date().toISOString()}] ${msg}\n`;
  const debugPath = join(
    resolveStateDir(),
    "logs",
    "openclaw-context-handoff.debug.log",
  );
  try {
    mkdirSync(dirname(debugPath), { recursive: true });
    appendFileSync(debugPath, logLine);
  } catch {}
  console.log(msg);
}

function parseNumber(raw: unknown, fallback: number) {
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return num;
}

function normalizeRelativeHandoffDir(raw: unknown, fallback = "memory/handoff") {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    return fallback;
  }

  if (isAbsolute(value)) {
    debugLog(
      `[openclaw-context-handoff] absolute handoffDir is not supported for prompt injection; falling back to ${fallback}`,
    );
    return fallback;
  }

  const normalized = value
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");

  if (!normalized || normalized.split("/").includes("..")) {
    debugLog(
      `[openclaw-context-handoff] invalid relative handoffDir "${value}"; falling back to ${fallback}`,
    );
    return fallback;
  }

  return normalized;
}

function buildHandoffFilenameExample(prefix: string, useTimestamp: boolean) {
  if (useTimestamp) {
    return `${prefix}-YYYYMMDDHHMMSSsss-session.md`;
  }
  return `${prefix}-session.md`;
}

function buildContextHandoffPolicy(options: {
  handoffDir: string;
  handoffFilePrefix: string;
  handoffUseTimestamp: boolean;
}) {
  const filenameExample = buildHandoffFilenameExample(
    options.handoffFilePrefix,
    options.handoffUseTimestamp,
  );

  return [
    "## Context Handoff Policy",
    "",
    "职责边界：本插件只提供规则和上下文信号；是否创建或更新交接文件，由你根据用户意图和当前任务进展自行决定。",
    "",
    `交接目录：${options.handoffDir}`,
    `文件名建议：${filenameExample}`,
    "路径要求：始终使用工作区相对路径，禁止使用绝对路径。",
    "",
    "写交接规则：",
    "1. 当用户明确要求写交接，或当前上下文已到 critical 且任务有重要进展时，你可以创建交接文件；",
    "2. 交接内容至少包含：当前任务目标与进展、关键任务待办、决策与约束、风险与待确认、下一步建议；",
    "3. 写完后在回复里明确告知相对路径，并建议用户如需接续可开新会话后直接说“继续”；",
    "4. 如果当前任务没有值得保存的有效进展，不要为了形式而伪造交接。",
    "",
    "新会话继续规则：",
    "1. 除非用户明确说出“继续 / 接着聊 / 继续上次对话 / resume”，否则不要读取任何交接文件；",
    "2. 当用户明确表达继续意图时，只读取交接目录里最新的一份交接文件；",
    "3. 继续时只提取其中的关键决策、待办、下一步，不要扩读无关文件。",
  ].join("\n");
}

function isUserTriggeredRun(ctx: any) {
  return ctx?.trigger === "user";
}

function withHandoffPolicyMarker(instruction: string) {
  const trimmed = instruction.trim();
  if (!trimmed) {
    return HANDOFF_POLICY_MARKER;
  }
  if (trimmed.includes(HANDOFF_POLICY_MARKER)) {
    return trimmed;
  }
  return `${HANDOFF_POLICY_MARKER}\n${trimmed}`;
}

function normalizeUsage(raw: any) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const asFiniteNumber = (value: unknown) => {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  };

  const input = asFiniteNumber(
    raw.input ??
      raw.inputTokens ??
      raw.input_tokens ??
      raw.promptTokens ??
      raw.prompt_tokens,
  );
  const output = asFiniteNumber(
    raw.output ??
      raw.outputTokens ??
      raw.output_tokens ??
      raw.completionTokens ??
      raw.completion_tokens,
  );
  const cacheRead = asFiniteNumber(
    raw.cacheRead ??
      raw.cache_read ??
      raw.cache_read_input_tokens ??
      raw.cached_tokens ??
      raw.prompt_tokens_details?.cached_tokens,
  );
  const cacheWrite = asFiniteNumber(
    raw.cacheWrite ??
      raw.cache_write ??
      raw.cache_creation_input_tokens,
  );
  const total = asFiniteNumber(raw.total ?? raw.totalTokens ?? raw.total_tokens);

  if (
    input === undefined &&
    output === undefined &&
    cacheRead === undefined &&
    cacheWrite === undefined &&
    total === undefined
  ) {
    return null;
  }

  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    total,
  };
}

function hasNonzeroUsage(usage: {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  total?: number;
} | null) {
  if (!usage) {
    return false;
  }

  return [usage.input, usage.output, usage.cacheRead, usage.cacheWrite, usage.total]
    .some((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
}

function derivePromptTokens(usage: {
  input?: number;
  cacheRead?: number;
  cacheWrite?: number;
} | null) {
  if (!usage) {
    return undefined;
  }

  const promptTokens =
    (usage.input ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
  return promptTokens > 0 ? promptTokens : undefined;
}

function parsePositiveNumber(raw: unknown) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function parseModelRef(modelRaw: string, defaultProvider = DEFAULT_PROVIDER) {
  const trimmed = modelRaw.trim();
  if (!trimmed) {
    return undefined;
  }

  const slash = trimmed.indexOf("/");
  if (slash <= 0) {
    return {
      provider: defaultProvider,
      model: trimmed,
    };
  }

  const provider = trimmed.slice(0, slash).trim().toLowerCase();
  const model = trimmed.slice(slash + 1).trim();
  if (!provider || !model) {
    return undefined;
  }

  return { provider, model };
}

function buildContextWindowCache(cfg: any) {
  const cache = new Map<string, number>();
  const providers = cfg?.models?.providers;
  if (!providers || typeof providers !== "object") {
    return cache;
  }

  for (const [providerRaw, providerEntry] of Object.entries(providers)) {
    const provider = String(providerRaw || "").trim().toLowerCase();
    const models = Array.isArray((providerEntry as any)?.models)
      ? (providerEntry as any).models
      : [];

    for (const modelEntry of models) {
      const id = typeof modelEntry?.id === "string" ? modelEntry.id.trim() : "";
      const contextWindow = parsePositiveNumber(modelEntry?.contextWindow);
      if (!id || !contextWindow) {
        continue;
      }

      cache.set(id, contextWindow);
      if (provider) {
        cache.set(`${provider}/${id}`, contextWindow);
      }
    }
  }

  return cache;
}

function lookupContextTokens(
  contextWindowCache: Map<string, number>,
  modelId?: string,
) {
  if (!modelId) {
    return undefined;
  }

  const trimmed = modelId.trim();
  if (!trimmed) {
    return undefined;
  }

  return (
    contextWindowCache.get(trimmed) ??
    contextWindowCache.get(trimmed.toLowerCase())
  );
}

function resolveConfiguredModelParams(cfg: any, provider: string, model: string) {
  const models = cfg?.agents?.defaults?.models;
  if (!models || typeof models !== "object") {
    return undefined;
  }

  const key = `${provider}/${model}`.trim().toLowerCase();
  for (const [rawKey, entry] of Object.entries(models)) {
    if (String(rawKey).trim().toLowerCase() !== key) {
      continue;
    }
    const params = (entry as any)?.params;
    return params && typeof params === "object" ? params : undefined;
  }

  return undefined;
}

function isAnthropic1MModel(provider?: string, model?: string) {
  if (!provider || !model || provider !== "anthropic") {
    return false;
  }

  const normalized = model.trim().toLowerCase();
  const modelId = normalized.includes("/")
    ? normalized.split("/").at(-1) ?? normalized
    : normalized;

  return ANTHROPIC_1M_MODEL_PREFIXES.some((prefix) => modelId.startsWith(prefix));
}

function resolveDefaultModelRef(cfg: any) {
  const primary = cfg?.agents?.defaults?.model?.primary;
  return typeof primary === "string" ? parseModelRef(primary) : undefined;
}

function resolveSessionModelRef(cfg: any, session: any) {
  const resolvedDefault = resolveDefaultModelRef(cfg);
  let provider = resolvedDefault?.provider;
  let model = resolvedDefault?.model;

  const runtimeModel =
    typeof session?.model === "string" ? session.model.trim() : "";
  const runtimeProvider =
    typeof session?.modelProvider === "string"
      ? session.modelProvider.trim().toLowerCase()
      : "";

  if (runtimeModel) {
    if (runtimeProvider) {
      return { provider: runtimeProvider, model: runtimeModel };
    }

    const parsedRuntime = parseModelRef(runtimeModel, provider || DEFAULT_PROVIDER);
    if (parsedRuntime) {
      return parsedRuntime;
    }

    return { provider, model: runtimeModel };
  }

  const storedModelOverride =
    typeof session?.modelOverride === "string" ? session.modelOverride.trim() : "";
  if (storedModelOverride) {
    const overrideProvider =
      typeof session?.providerOverride === "string" && session.providerOverride.trim()
        ? session.providerOverride.trim().toLowerCase()
        : provider || DEFAULT_PROVIDER;
    const parsedOverride = parseModelRef(storedModelOverride, overrideProvider);
    if (parsedOverride) {
      return parsedOverride;
    }

    return { provider: overrideProvider, model: storedModelOverride };
  }

  return { provider, model };
}

function resolveContextTokensForSession(
  cfg: any,
  contextWindowCache: Map<string, number>,
  session: any,
) {
  const contextTokensOverride = parsePositiveNumber(session?.contextTokens);
  if (contextTokensOverride) {
    return contextTokensOverride;
  }

  const resolved = resolveSessionModelRef(cfg, session);
  if (
    resolved.provider &&
    resolved.model &&
    resolveConfiguredModelParams(cfg, resolved.provider, resolved.model)?.context1m === true &&
    isAnthropic1MModel(resolved.provider, resolved.model)
  ) {
    return ANTHROPIC_CONTEXT_1M_TOKENS;
  }

  const fallbackContextTokens =
    parsePositiveNumber(cfg?.agents?.defaults?.contextTokens) ??
    DEFAULT_CONTEXT_TOKENS;

  return (
    lookupContextTokens(contextWindowCache, resolved.model) ??
    lookupContextTokens(
      contextWindowCache,
      resolved.provider && resolved.model
        ? `${resolved.provider}/${resolved.model}`
        : undefined,
    ) ??
    fallbackContextTokens
  );
}

function resolveFreshSessionTotalTokens(session: any) {
  const totalTokens = Number(session?.totalTokens);
  if (!Number.isFinite(totalTokens) || totalTokens < 0) {
    return undefined;
  }

  if (session?.totalTokensFresh === false) {
    return undefined;
  }

  return totalTokens;
}

function parseTranscriptUsageTokenCount(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const entry = JSON.parse(trimmed);
    const usage = normalizeUsage(entry?.message?.usage ?? entry?.usage);
    if (!hasNonzeroUsage(usage)) {
      return undefined;
    }

    const promptTokens = derivePromptTokens(usage);
    const candidate = promptTokens ?? usage?.total;
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  } catch {
    // ignore malformed log lines
  }

  return undefined;
}

function readLatestTranscriptTokenCount(logPath: string) {
  let fd: number | undefined;
  try {
    fd = openSync(logPath, "r");
    let position = fstatSync(fd).size;
    let leadingPartial = "";

    while (position > 0) {
      const chunkSize = Math.min(TRANSCRIPT_TAIL_CHUNK_BYTES, position);
      const start = position - chunkSize;
      const buffer = Buffer.allocUnsafe(chunkSize);
      const bytesRead = readSync(fd, buffer, 0, chunkSize, start);
      if (bytesRead <= 0) {
        break;
      }

      const lines = `${buffer.toString("utf-8", 0, bytesRead)}${leadingPartial}`.split(/\n+/);
      leadingPartial = lines.shift() ?? "";

      for (let i = lines.length - 1; i >= 0; i -= 1) {
        const candidate = parseTranscriptUsageTokenCount(lines[i] ?? "");
        if (typeof candidate === "number") {
          return candidate;
        }
      }

      position = start;
    }

    return parseTranscriptUsageTokenCount(leadingPartial);
  } catch {
    return undefined;
  } finally {
    if (typeof fd === "number") {
      try {
        closeSync(fd);
      } catch {}
    }
  }
}

function resolveSessionLogPath(
  stateDir: string,
  agentId: string,
  sessionKey: string,
  session: any,
) {
  const candidatePath =
    typeof session?.sessionFile === "string" && session.sessionFile.trim()
      ? session.sessionFile.trim()
      : typeof session?.transcriptPath === "string" && session.transcriptPath.trim()
        ? session.transcriptPath.trim()
        : "";

  if (candidatePath) {
    return isAbsolute(candidatePath) ? candidatePath : join(stateDir, candidatePath);
  }

  const sessionId =
    typeof session?.sessionId === "string" ? session.sessionId.trim() : "";
  return join(
    stateDir,
    "agents",
    agentId,
    "sessions",
    `${sessionId || sessionKey}.jsonl`,
  );
}

function readSessionAndLogUsage(
  cfg: any,
  contextWindowCache: Map<string, number>,
  stateDir: string,
  sessionKey: string,
) {
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

    const contextTokens = resolveContextTokensForSession(
      cfg,
      contextWindowCache,
      session,
    );
    let totalTokens = resolveFreshSessionTotalTokens(session);
    const logPath = resolveSessionLogPath(stateDir, agentId, sessionKey, session);
    if (existsSync(logPath)) {
      const logTotal = readLatestTranscriptTokenCount(logPath);
      if (
        typeof logTotal === "number" &&
        Number.isFinite(logTotal) &&
        (
          typeof totalTokens !== "number" ||
          !Number.isFinite(totalTokens) ||
          logTotal > totalTokens
        )
      ) {
        totalTokens = logTotal;
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
}

/**
 * Context Monitor
 * 1) inject context usage on active user turns
 * 2) inject a stable handoff policy into the system prompt
 * 3) keep file creation as an Agent decision, not a plugin side effect
 */
export default function register(api: any) {
  const pluginEntry =
    api?.config?.plugins?.entries?.["openclaw-context-handoff"] || {};
  const pluginConfig = pluginEntry.config || {};
  const contextWindowCache = buildContextWindowCache(api?.config);

  const showAlways = pluginConfig.showAlways ?? false;
  const warnPercent = parseNumber(pluginConfig.warnPercent, 50);
  const criticalPercent = parseNumber(pluginConfig.criticalPercent, 75);

  const stateDir = resolveStateDir();
  const handoffEnabled = pluginConfig.handoffEnabled ?? true;
  const handoffDir = normalizeRelativeHandoffDir(
    pluginConfig.handoffDir,
    "memory/handoff",
  );
  const handoffFilePrefix = pluginConfig.handoffFilePrefix || "context-handoff";
  const handoffUseTimestamp = pluginConfig.handoffUseTimestamp ?? true;
  const handoffInstruction =
    typeof pluginConfig.handoffInstruction === "string" &&
    pluginConfig.handoffInstruction.trim()
      ? withHandoffPolicyMarker(pluginConfig.handoffInstruction)
      : withHandoffPolicyMarker(
          buildContextHandoffPolicy({
            handoffDir,
            handoffFilePrefix,
            handoffUseTimestamp,
          }),
        );
  const pendingPolicyLogs = new Map<string, number>();

  const resolvePendingPolicyLogKey = (ctx: any) => {
    if (typeof ctx?.sessionId === "string" && ctx.sessionId.trim()) {
      return `session:${ctx.sessionId.trim()}`;
    }
    if (typeof ctx?.sessionKey === "string" && ctx.sessionKey.trim()) {
      return `key:${ctx.sessionKey.trim()}`;
    }
    return undefined;
  };

  const markPendingPolicyLog = (pendingKey: string) => {
    pendingPolicyLogs.set(pendingKey, (pendingPolicyLogs.get(pendingKey) || 0) + 1);
  };

  const consumePendingPolicyLog = (pendingKey: string) => {
    const pending = pendingPolicyLogs.get(pendingKey) || 0;
    if (pending <= 1) {
      pendingPolicyLogs.delete(pendingKey);
      return;
    }
    pendingPolicyLogs.set(pendingKey, pending - 1);
  };

  const handleBeforeAgentStart = (_event: any, ctx: any) => {
    const sessionKey = ctx?.sessionKey;
    const pendingKey = resolvePendingPolicyLogKey(ctx);
    if (!handoffEnabled || !isUserTriggeredRun(ctx) || !sessionKey || !pendingKey) {
      return {};
    }

    markPendingPolicyLog(pendingKey);
    debugLog(
      `[openclaw-context-handoff] [before_agent_start] injecting handoff policy for session: ${sessionKey}`,
    );

    return {
      appendSystemContext: handoffInstruction,
    };
  };

  const handlePromptBuild = (_event: any, ctx: any) => {
    const sessionKey = ctx?.sessionKey;
    if (!sessionKey || !isUserTriggeredRun(ctx)) {
      return {};
    }

    const usage = readSessionAndLogUsage(
      api?.config,
      contextWindowCache,
      stateDir,
      sessionKey,
    );
    if (!usage) {
      return {};
    }

    const percent = Math.max(0, Math.min(1000, usage.percent));
    const remainPercent = Math.max(0, 100 - percent);
    const remainText = `当前上下文使用：${percent}%（${usage.used.toLocaleString()} / ${usage.total.toLocaleString()} tokens），剩余 ${remainPercent}%。`;

    let prependContext = "";

    if (percent >= criticalPercent) {
      prependContext = [
        "\n\n## 🚨 Context Window Critical Alert",
        remainText,
        handoffEnabled
          ? "系统级提醒：当前会话已到 critical 阈值。是否立即写交接、写什么内容、是否先结束当前回复，由你根据任务进展自行判断；如果决定写交接，请按 system prompt 中的 handoff 规则执行，并在回复里告知相对路径。"
          : "系统级提醒：当前会话已到 critical 阈值，建议尽快收束并视情况开启新会话。",
      ].join("\n");
    } else if (percent >= warnPercent) {
      prependContext = [
        "\n\n## ⚠️ Context Usage Notice",
        remainText,
        handoffEnabled
          ? "系统提示：上下文占比较高；如果当前任务后续还会继续较长时间，可提前准备 handoff，并视情况提醒用户后续开新会话。"
          : "系统提示：上下文占比较高；如后续讨论还会继续较长时间，可视情况提醒用户开新会话。",
      ].join("\n");
    } else if (showAlways) {
      prependContext = `\n[Context: ${percent}% used (${usage.used.toLocaleString()}/${usage.total.toLocaleString()} tokens)]`;
    }

    return prependContext ? { prependContext } : {};
  };

  const handleLlmInput = (event: any, ctx: any) => {
    if (!handoffEnabled) {
      return;
    }

    const sessionKey = ctx?.sessionKey || "unknown";
    const pendingKey = resolvePendingPolicyLogKey(ctx);
    const runId = event?.runId || "unknown";
    const systemPrompt = typeof event?.systemPrompt === "string" ? event.systemPrompt : "";
    const hasPolicy = systemPrompt.includes(HANDOFF_POLICY_MARKER);
    const pending =
      typeof pendingKey === "string" && (pendingPolicyLogs.get(pendingKey) || 0) > 0;

    if (!pending && !hasPolicy) {
      return;
    }

    if (pending && pendingKey) {
      consumePendingPolicyLog(pendingKey);
    }

    debugLog(
      `[openclaw-context-handoff] [llm_input] context handoff policy ${hasPolicy ? "present" : "missing"} in system prompt for session: ${sessionKey}, run: ${runId}`,
    );
  };

  const handleAgentEnd = (_event: any, ctx: any) => {
    const pendingKey = resolvePendingPolicyLogKey(ctx);
    if (!pendingKey) {
      return;
    }

    if ((pendingPolicyLogs.get(pendingKey) || 0) > 0) {
      consumePendingPolicyLog(pendingKey);
    }
  };

  api.on(
    "before_agent_start",
    (event: any, ctx: any) => handleBeforeAgentStart(event, ctx),
    { priority: 50 },
  );

  api.on(
    "before_prompt_build",
    (event: any, ctx: any) => handlePromptBuild(event, ctx),
    { priority: 50 },
  );

  api.on("llm_input", (event: any, ctx: any) => handleLlmInput(event, ctx), {
    priority: 50,
  });

  api.on("agent_end", (event: any, ctx: any) => handleAgentEnd(event, ctx), {
    priority: 50,
  });
}
