import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseJsonBody } from "./lib/parseBody.js";

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
      apiKey?: string;
      apiBase?: string;
      model?: string;
    };

    const apiKey = body.apiKey?.trim();
    if (!apiKey) {
      res.status(400).json({ ok: false, error: "API Key 不能为空" });
      return;
    }

    const base = (body.apiBase?.trim() || "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    );
    const model = body.model?.trim() || "gpt-4o-mini";

    const openaiRes = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 16,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (!openaiRes.ok) {
      const t = await openaiRes.text();
      res.status(200).json({
        ok: false,
        error: `模型请求失败: ${openaiRes.status} ${t.slice(0, 300)}`,
      });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(200).json({ ok: false, error: `连接失败: ${msg}` });
  }
}
