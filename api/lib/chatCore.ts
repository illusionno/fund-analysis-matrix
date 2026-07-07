import type { QuoteSnapshot } from "./quoteCore.js";

export const CHAT_DISCLAIMER =
  "AI 回复仅供参考，不构成投资建议。市场有风险，决策请独立判断。";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatOptions = {
  apiKey: string;
  base?: string;
  model?: string;
  quotes?: QuoteSnapshot[];
};

const MAX_USER_ASSISTANT_MESSAGES = 40;
const MAX_CONTENT_LEN = 12000;

// 把传过来的“自选股”数据（代码、现价、涨跌幅）拼接成一段 Markdown 文本
function buildQuotesContext(quotes: QuoteSnapshot[]): string {
  if (quotes.length === 0) return "";
  const lines = quotes.map(
    (q) =>
      `- [${q.kind}] ${q.name}（${q.code}）现价/净值 ${q.price}，今日涨跌 ${q.changePctDay.toFixed(2)}%，近一周涨跌 ${q.changePctWeek != null ? `${q.changePctWeek.toFixed(2)}%` : "暂无"}，时间 ${q.asOf}`,
  );
  return `用户当前自选行情摘要（仅供参考）：\n${lines.join("\n")}\n\n`;
}
//  构建系统提示词
function buildSystemPrompt(
  quotes: QuoteSnapshot[],
  deepThink: boolean,
): string {
  const quotesBlock = buildQuotesContext(quotes);

  const baseRules = `你是 FundMatrix 应用内的基金、A 股与黄金行情助手「小矩阵」。用户会围绕自选、涨跌、组合与常识性问题提问。
${quotesBlock}
【回答要求】
- 使用简体中文，语气专业、克制、友好。
- 严格区分「行情事实」与「推断」：无依据的推断用「可能」「或受」「不排除」等措辞。
- 禁止编造具体新闻标题、公告、精确政策日期；禁止给出具体买卖时点、目标价、杠杆倍数或「必涨必跌」断言。
- 若问题超出公开金融常识或缺少数据，请明确说明局限并给出可操作的查阅方向（如关注净值披露、季报、指数环境等），不要胡编。
- 正式回答可使用简短分段与列表；可使用 Markdown（标题、**加粗**、列表、表格、行内代码等）提升可读性；不要使用 JSON 包裹整段答案；不要使用未转义的 HTML 标签；除非用户明确要求较长代码片段或公式。`;

  if (!deepThink) return baseRules;

  return `${baseRules}

【深度思考模式 — 输出格式必须严格遵守】
1) 先输出一个完整的 <thinking>...</thinking> 块：用简体中文做链式推演——列关键前提、需要核对的数据、推理步骤与主要不确定性；约 120–320 字，不要复述最终答案正文。
2) 紧接着输出 <answer>...</answer> 块：用户可见的正式回答（支持 Markdown），遵守上述合规要求。
3) 两个块都必须出现且标签小写、成对闭合；不要输出其它 XML/HTML。`;
}
// 处理历史消息
function normalizeTurns(history: ChatTurn[]) {
  return history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content ?? "").slice(0, MAX_CONTENT_LEN),//单条消息限制12000字，防止爆 Token
    }))
    .filter((m) => m.content.trim().length > 0)
    .slice(-MAX_USER_ASSISTANT_MESSAGES);//最多只保留最近的 40 条消息
}


// 把上面生成的 System Prompt 放在数组第一位（role: "system"），后面跟着清理过的历史对话，打包成大模型 API 要求的标准格式。
export function buildChatMessages(
  history: ChatTurn[],
  opts: ChatOptions & { deepThink?: boolean },
): { error?: string; messages?: Array<{ role: string; content: string }> } {
  const turns = normalizeTurns(history);
  if (turns.length === 0) {
    return { error: "消息不能为空" };
  }
  const deepThink = opts.deepThink ?? false;
  const system = buildSystemPrompt(opts.quotes ?? [], deepThink);
  return {
    messages: [{ role: "system", content: system }, ...turns],
  };
}

// 非流式请求（会一次性返回全部结果）
export async function runAiChat(
  history: ChatTurn[],
  opts: ChatOptions,
): Promise<{ reply: string } | { error: string }> {

  const built = buildChatMessages(history, { ...opts, deepThink: false });
  if (built.error) return { error: built.error };

  const base = opts.base?.replace(/\/$/, "") ?? "https://api.openai.com/v1";
  const model = opts.model ?? "gpt-4o-mini";

  let openaiRes: Response;
  try {
    openaiRes = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.55,
        max_tokens: 2048,
        messages: built.messages,
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `上游模型连接失败（请检查 API Base URL 是否可从部署环境访问）: ${msg}` };
  }

  if (!openaiRes.ok) {
    const t = await openaiRes.text();
    return { error: `模型请求失败: ${openaiRes.status} ${t}` };
  }

  const raw = (await openaiRes.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const reply = raw.choices?.[0]?.message?.content?.trim() ?? "";
  if (!reply) {
    return { error: "模型未返回有效内容" };
  }
  return { reply };
}

export type StreamChunk =
  | { kind: "content"; text: string }
  | { kind: "reasoning"; text: string }
  | { kind: "error"; message: string };

  // 从大模型返回的delta数据中提取内容和推理过程
function extractDeltaText(delta: Record<string, unknown>): {
  content: string;
  reasoning: string;
} {
  let content = "";
  let reasoning = "";
  const c = delta.content;
  if (typeof c === "string") {
    content = c;
  } else if (Array.isArray(c)) {// 兼容某些多模态模型的格式:{ "content": [{ "type": "text", "text": "你好" }] }
    for (const part of c) {
      if (typeof part !== "object" || part === null) continue;
      const p = part as Record<string, unknown>;
      if (p.type === "text" && typeof p.text === "string") content += p.text;
    }
  }
  const rc = delta.reasoning_content;
  if (typeof rc === "string") reasoning = rc;
  return { content, reasoning };
}

/** 解析 OpenAI chat.completions 的 SSE 流，产出文本增量 */
export async function* readOpenAiChatStream(
  body: ReadableStream<Uint8Array> | null,
): AsyncGenerator<StreamChunk> {
  if (!body) {
    yield { kind: "error", message: "响应体为空" };
    return;
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let lineBuf = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lineBuf += decoder.decode(value, { stream: true });
      const lines = lineBuf.split("\n");
      lineBuf = lines.pop() ?? "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;// SSE 协议要求有效数据必须以 "data:" 开头
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;//OpenAI协议规定的结束符
        try {
          const j = JSON.parse(data) as Record<string, unknown>;
          const choice = (
            j.choices as Record<string, unknown>[] | undefined
          )?.[0];
          const delta = choice?.delta as Record<string, unknown> | undefined;
          if (!delta) continue;
          const { content, reasoning } = extractDeltaText(delta);
           // 使用 yield 把提炼出来的数据一块一块“吐”给外层调用者
          if (reasoning) yield { kind: "reasoning", text: reasoning };
          if (content) yield { kind: "content", text: content };
        } catch {
          /* 非 JSON 行忽略 */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function streamAiChatToWriter(
  history: ChatTurn[],
  opts: ChatOptions & { deepThink: boolean },
  writeJsonLine: (obj: Record<string, unknown>) => void,
): Promise<void> {
    // 构建大模型的对话上下文 
  const built = buildChatMessages(history, {
    ...opts,
    deepThink: opts.deepThink,
  });
  if (built.error) {
    writeJsonLine({ err: built.error });
    return;
  }

  const base = opts.base?.replace(/\/$/, "") ?? "https://api.openai.com/v1";
  const model = opts.model ?? "gpt-4o-mini";

  let openaiRes: Response;
  try {
    openaiRes = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: opts.deepThink ? 0.45 : 0.55,
        max_tokens: opts.deepThink ? 3072 : 2048,
        stream: true,
        messages: built.messages,
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    writeJsonLine({
      err: `上游模型连接失败（请检查 OPENAI_API_BASE 是否可从部署环境访问）: ${msg}`,
    });
    return;
  }

  if (!openaiRes.ok) {
    const t = await openaiRes.text();
    writeJsonLine({ err: `模型请求失败: ${openaiRes.status} ${t}` });
    return;
  }

  for await (const chunk of readOpenAiChatStream(openaiRes.body)) {
    if (chunk.kind === "error") {
      writeJsonLine({ err: chunk.message });
      return;
    }
    // 推理增量
    if (chunk.kind === "reasoning" && chunk.text) {
      writeJsonLine({ r: chunk.text });// 如果提取出来的是思考过程，包装成 {"r": "字"} 吐给前端
    }
    // 正文增量
    if (chunk.kind === "content" && chunk.text) {
      writeJsonLine({ d: chunk.text });
    }
  }
}
