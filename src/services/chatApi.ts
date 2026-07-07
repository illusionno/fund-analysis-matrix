// 前端发起请求的封装层
import type { QuoteSnapshot } from "../types/quote";
export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatResponse = {
  reply?: string;
  disclaimer?: string;
  error?: string;
};

export type StreamNdjson = {
  d?: string;
  r?: string;
  err?: string;
  done?: boolean;
  disclaimer?: string;
};

function getConfigOverrides() {
  try {
    // 动态 import 避免循环依赖；zustand persist 在 SSR 时可能不存在
    const raw = localStorage.getItem("fund-matrix-ai-config");
    if (!raw) return {};
    const j = JSON.parse(raw) as {
      state?: { apiKey?: string; apiBase?: string; model?: string };
    };
    const s = j.state ?? {};
    return {
      _apiKey: s.apiKey?.trim() || undefined,
      _apiBase: s.apiBase?.trim() || undefined,
      _model: s.model?.trim() || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * 流式对话：服务端 NDJSON，每行一个 JSON。
 * 字段：`d` 正文增量、`r` 模型 reasoning 增量（若接口提供）、`err` 错误、`done` 结束。
 */
export async function streamAiChat(
  messages: ChatTurn[],
  quotes: QuoteSnapshot[] | undefined,
  deepThink: boolean,
  onChunk: (line: StreamNdjson) => void,
  signal?: AbortSignal,
): Promise<void> {
  const overrides = getConfigOverrides();
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "chat",
      messages,
      quotes: quotes ?? [],
      stream: true,
      deepThink,
      ...overrides,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    let msg = `请求失败 ${res.status}`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      if (text) msg = text;
    }
    onChunk({ err: msg });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let carry = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 把新读到的字节解码，拼接到之前剩下的半截字符串后面
      carry += decoder.decode(value, { stream: true });

      // 按换行符切分，因为 NDJSON 是每一行一个完整的 JSON
      const parts = carry.split("\n");

      // 把最后一段（可能被截断的不完整字符串）弹出来，留在 carry 里等下一次网络包
      carry = parts.pop() ?? "";

      // 遍历所有被换行符切出来的完整行
      for (const row of parts) {
        const s = row.trim();
        if (!s) continue;
        try {
          // 把这行字符串解析成 JSON，并传给外面的回调函数（刷新 UI）
          onChunk(JSON.parse(s) as StreamNdjson);
        } catch {
          /* 忽略坏行 */
        }
      }
    }
    const tail = carry.trim();
    if (tail) {
      try {
        onChunk(JSON.parse(tail) as StreamNdjson);
      } catch {
        /* */
      }
    }
  } finally {
    reader.releaseLock(); //释放浏览器对这个数据流的锁定，防止内存泄漏
  }
}
