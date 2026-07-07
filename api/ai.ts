import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { QuoteSnapshot } from "./lib/quoteCore.js";
import type { MarketIndexSnapshot } from "./lib/marketCore.js";
import { parseJsonBody } from "./lib/parseBody.js";
import { formatFetchError } from "./lib/fetchWithTimeout.js";
import {
  CHAT_DISCLAIMER,
  runAiChat,
  streamAiChatToWriter,
  type ChatTurn,
} from "./lib/chatCore.js";
import {
  REVIEW_DISCLAIMER,
  runAiReview,
  runAiMarketAnalysis,
} from "./lib/reviewCore.js";
import { resolveMarketIndices } from "./lib/marketCore.js";
import { AI_CONFIG_REQUIRED_MESSAGE } from "./lib/aiConfigMessages.js";

// ── 辅助 ──────────────────────────────────────────────────────────

function parseTurns(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatTurn[] = [];
  for (const x of raw) {
    if (typeof x !== "object" || x === null) continue;
    const r = x as Record<string, unknown>;
    const role = r.role;
    const content = r.content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    out.push({ role, content });
  }
  return out;
}

// ── action 分发 ───────────────────────────────────────────────────

async function handleChat(
  body: Record<string, unknown>,
  key: string,
  base: string | undefined,
  model: string | undefined,
  res: VercelResponse,
) {
  const messages = parseTurns(body.messages);
  const quotes = (Array.isArray(body.quotes) ? body.quotes : []) as QuoteSnapshot[];
  const stream = body.stream === true;
  const deepThink = body.deepThink === true;

  if (stream) {
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.status(200);

    const writeLine = (obj: Record<string, unknown>) => {
      res.write(`${JSON.stringify(obj)}\n`);
    };

    try {
      await streamAiChatToWriter(
        messages,
        { apiKey: key, base, model, quotes, deepThink },
        writeLine,
      );
      writeLine({ done: true, disclaimer: CHAT_DISCLAIMER });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      writeLine({ err: msg });
      writeLine({ done: true, disclaimer: CHAT_DISCLAIMER });
    }
    res.end();
    return;
  }

  // 非流式
  const out = await runAiChat(messages, { apiKey: key, base, model, quotes });
  if ("error" in out) {
    res.status(502).json({ error: out.error, disclaimer: CHAT_DISCLAIMER });
    return;
  }
  res.status(200).json({ reply: out.reply, disclaimer: CHAT_DISCLAIMER });
}

async function handleReview(
  body: Record<string, unknown>,
  key: string,
  base: string | undefined,
  model: string | undefined,
  res: VercelResponse,
) {
  const quotes = (Array.isArray(body.quotes) ? body.quotes : []) as QuoteSnapshot[];
  const marketIndices: MarketIndexSnapshot[] | undefined = Array.isArray(body.marketIndices)
    ? (body.marketIndices as MarketIndexSnapshot[])
    : undefined;
  const hasQuotes = quotes.length > 0;
  const hasMarket = Array.isArray(marketIndices) && marketIndices.length > 0;

  if (!hasQuotes && !hasMarket) {
    res.status(400).json({ error: "quotes 与 marketIndices 不能同时为空", disclaimer: REVIEW_DISCLAIMER });
    return;
  }

  const out = await runAiReview(quotes, marketIndices, { apiKey: key, base, model });
  if ("error" in out) {
    res.status(502).json({ error: out.error, disclaimer: REVIEW_DISCLAIMER });
    return;
  }
  res.status(200).json({ result: out.result, disclaimer: REVIEW_DISCLAIMER });
}

async function handleMarketAnalysis(
  _body: Record<string, unknown>,
  key: string,
  base: string | undefined,
  model: string | undefined,
  res: VercelResponse,
) {
  // 服务端自己拉取最新大盘数据，不再依赖前端传入
  const { indices, warning } = await resolveMarketIndices();

  if (indices.length === 0) {
    res.status(502).json({
      error: "大盘指数数据源暂时不可用（东方财富接口连接失败），请稍后重试。",
      disclaimer: REVIEW_DISCLAIMER,
    });
    return;
  }

  const out = await runAiMarketAnalysis(indices, warning, { apiKey: key, base, model });
  if ("error" in out) {
    res.status(502).json({ error: out.error, disclaimer: REVIEW_DISCLAIMER });
    return;
  }
  res.status(200).json({ result: out.result, disclaimer: REVIEW_DISCLAIMER });
}

// ── 入口 ──────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = parseJsonBody(req) as {
      action?: string;
      messages?: unknown;
      quotes?: QuoteSnapshot[];
      marketIndices?: MarketIndexSnapshot[];
      stream?: unknown;
      deepThink?: unknown;
      _apiKey?: string;
      _apiBase?: string;
      _model?: string;
    };

    const key = body._apiKey?.trim() || process.env.OPENAI_API_KEY;
    if (!key) {
      const disclaimers: Record<string, string> = {
        chat: CHAT_DISCLAIMER,
        review: REVIEW_DISCLAIMER,
        marketAnalysis: REVIEW_DISCLAIMER,
      };
      res.status(503).json({
        error: AI_CONFIG_REQUIRED_MESSAGE,
        disclaimer: disclaimers[body.action ?? ""] ?? CHAT_DISCLAIMER,
      });
      return;
    }

    const base = body._apiBase?.trim() || process.env.OPENAI_API_BASE;
    const model = body._model?.trim() || process.env.OPENAI_MODEL;

    switch (body.action) {
      case "chat":
        await handleChat(body, key, base, model, res);
        break;
      case "review":
        await handleReview(body, key, base, model, res);
        break;
      case "marketAnalysis":
        await handleMarketAnalysis(body, key, base, model, res);
        break;
      default:
        res.status(400).json({ error: "action 须为 chat | review | marketAnalysis" });
    }
  } catch (e) {
    console.error("[api/ai]", e);
    if (res.headersSent) {
      try { res.end(); } catch { /* ignore */ }
      return;
    }
    res.status(502).json({ error: formatFetchError(e, "AI 服务"), disclaimer: CHAT_DISCLAIMER });
  }
}
