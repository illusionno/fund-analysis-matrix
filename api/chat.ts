import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { QuoteSnapshot } from "./lib/quoteCore";
import {
  CHAT_DISCLAIMER,
  runAiChat,
  streamAiChatToWriter,
  type ChatTurn,
} from "./lib/chatCore";

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

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    res.status(503).json({
      error: "未配置 OPENAI_API_KEY",
      disclaimer: CHAT_DISCLAIMER,
    });
    return;
  }

  try {
    const body = (
      typeof req.body === "string" ? JSON.parse(req.body) : req.body
    ) as {
      messages?: unknown;
      quotes?: QuoteSnapshot[];
      stream?: unknown;
      deepThink?: unknown;
    };
    const messages = parseTurns(body.messages);
    const quotes = Array.isArray(body.quotes) ? body.quotes : [];
    const stream = body.stream === true;
    const deepThink = body.deepThink === true;
    
    // 流式请求（必须在首次 res.write 之前设置 status，否则 Node/Vercel 会抛错 → FUNCTION_INVOCATION_FAILED）
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
          {
            apiKey: key,
            base: process.env.OPENAI_API_BASE,
            model: process.env.OPENAI_MODEL,
            quotes,
            deepThink,
          },
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

    // 非流式请求（会一次性返回全部结果）
    const out = await runAiChat(messages, {
      apiKey: key,
      base: process.env.OPENAI_API_BASE,
      model: process.env.OPENAI_MODEL,
      quotes,
    });

    if ("error" in out) {
      res.status(502).json({ error: out.error, disclaimer: CHAT_DISCLAIMER });
      return;
    }

    res.status(200).json({
      reply: out.reply,
      disclaimer: CHAT_DISCLAIMER,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (res.headersSent) {
      try {
        res.end();
      } catch {
        /* ignore */
      }
      return;
    }
    res.status(500).json({ error: msg, disclaimer: CHAT_DISCLAIMER });
  }
}
