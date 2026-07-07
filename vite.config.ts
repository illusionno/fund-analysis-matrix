import type { QuoteItemInput, QuoteSnapshot } from "./api/lib/quoteCore";
import { AI_CONFIG_REQUIRED_MESSAGE } from "./api/lib/aiConfigMessages";
import react from "@vitejs/plugin-react";
import type { IncomingMessage } from "node:http";
import { defineConfig, loadEnv } from "vite";
import svgr from "vite-plugin-svgr";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      svgr(),
      {
        name: "fund-matrix-api-dev",
        // 线上部署时，Vercel 会把 api/quote.ts 映射成类似 /api/quote 的 HTTP 路由。
        // 但 vite dev 只是开发服务器，默认不会自动执行 Vercel 那套函数加载规则。
        // 所以在 vite.config.ts 里用 configureServer 中间件，在开发时拦截与线上一致的路径（如 /api/quote、/api/kline、/api/review）
        configureServer(server) {
          // req：请求对象，包含请求的URL、方法、头信息、请求体等。
          // res：响应对象，包含响应的头部信息、状态码、响应体等。
          // next：下一个中间件函数，用于调用下一个中间件函数。
          server.middlewares.use(async (req, res, next) => {
            const url = req.url?.split("?")[0] ?? "";
            if (url === "/api/quote" && req.method === "POST") {
              try {
                const raw = await readBody(req);
                const body = JSON.parse(raw) as { items?: QuoteItemInput[] };
                const { resolveQuotes } =
                  await import("./api/lib/quoteCore.ts");
                const quotes = await resolveQuotes(body.items ?? []);
                res.setHeader("Content-Type", "application/json");
                //将响应体设置为JSON字符串，并发送响应。
                res.end(JSON.stringify({ quotes }));
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: msg }));
              }
              return;
            }

            if (
              url === "/api/market" &&
              (req.method === "GET" || req.method === "POST")
            ) {
              try {
                const { resolveMarketIndices } =
                  await import("./api/lib/marketCore.ts");
                const { indices, warning } = await resolveMarketIndices();
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ indices, ...(warning ? { warning } : {}) }));
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: msg }));
              }
              return;
            }

            if (url === "/api/kline" && req.method === "POST") {
              try {
                const raw = await readBody(req);
                const body = JSON.parse(raw) as {
                  kind?: string;
                  code?: string;
                  period?: string;
                };
                const kind = body.kind as "fund" | "stock" | "gold" | undefined;
                const code = body.code ?? "";
                const periodRaw = body.period ?? "month";
                const period =
                  periodRaw === "week" ||
                  periodRaw === "month" ||
                  periodRaw === "year"
                    ? periodRaw
                    : "month";
                if (kind !== "fund" && kind !== "stock" && kind !== "gold") {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({ error: "kind 须为 fund | stock | gold" }),
                  );
                  return;
                }
                const { fetchKlineSeries } =
                  await import("./api/lib/klineSeries.ts");
                const points = await fetchKlineSeries(kind, code, period);
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ points }));
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: msg }));
              }
              return;
            }

            if (url === "/api/chat" && req.method === "POST") {
              try {
                const raw = await readBody(req);
                const body = JSON.parse(raw) as {
                  messages?: unknown;
                  quotes?: QuoteSnapshot[];
                  stream?: boolean;
                  deepThink?: boolean;
                  _apiKey?: string;
                  _apiBase?: string;
                  _model?: string;
                };
                const key = body._apiKey?.trim() || env.OPENAI_API_KEY;
                if (!key) {
                  res.statusCode = 503;
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      error: AI_CONFIG_REQUIRED_MESSAGE,
                      disclaimer:
                        "AI 回复仅供参考，不构成投资建议。市场有风险，决策请独立判断。",
                    }),
                  );
                  return;
                }
                const parseTurns = (rawMsgs: unknown) => {
                  if (!Array.isArray(rawMsgs)) return [];
                  const out: { role: "user" | "assistant"; content: string }[] =
                    [];
                  for (const x of rawMsgs) {
                    if (typeof x !== "object" || x === null) continue;
                    const r = x as Record<string, unknown>;
                    if (r.role !== "user" && r.role !== "assistant") continue;
                    if (typeof r.content !== "string") continue;
                    out.push({
                      role: r.role,
                      content: r.content,
                    });
                  }
                  return out;
                };
                const messages = parseTurns(body.messages);
                const quotes = Array.isArray(body.quotes) ? body.quotes : [];
                const { runAiChat, streamAiChatToWriter, CHAT_DISCLAIMER } =
                  await import("./api/lib/chatCore.ts");

                if (body.stream === true) {
                  res.setHeader(
                    "Content-Type",
                    "application/x-ndjson; charset=utf-8",
                  );
                  res.setHeader("Cache-Control", "no-cache, no-transform");
                  res.setHeader("X-Accel-Buffering", "no");
                  const writeLine = (obj: Record<string, unknown>) => {
                    res.write(`${JSON.stringify(obj)}\n`);
                  };
                  try {
                    await streamAiChatToWriter(
                      messages,
                      {
                        apiKey: key,
                        base: body._apiBase?.trim() || env.OPENAI_API_BASE,
                        model: body._model?.trim() || env.OPENAI_MODEL,
                        quotes,
                        deepThink: body.deepThink === true,
                      },
                      writeLine,
                    );
                    writeLine({ done: true, disclaimer: CHAT_DISCLAIMER });
                    res.statusCode = 200;
                    res.end();
                  } catch (streamErr) {
                    const msg =
                      streamErr instanceof Error
                        ? streamErr.message
                        : String(streamErr);
                    if (!res.headersSent) {
                      res.statusCode = 500;
                      res.setHeader("Content-Type", "application/json");
                      res.end(
                        JSON.stringify({
                          error: msg,
                          disclaimer: CHAT_DISCLAIMER,
                        }),
                      );
                    } else {
                      res.write(
                        `${JSON.stringify({ err: msg, disclaimer: CHAT_DISCLAIMER })}\n`,
                      );
                      res.end();
                    }
                  }
                  return;
                }

                const out = await runAiChat(messages, {
                  apiKey: key,
                  base: body._apiBase?.trim() || env.OPENAI_API_BASE,
                  model: body._model?.trim() || env.OPENAI_MODEL,
                  quotes,
                });
                if ("error" in out) {
                  res.statusCode = 502;
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      error: out.error,
                      disclaimer: CHAT_DISCLAIMER,
                    }),
                  );
                  return;
                }
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    reply: out.reply,
                    disclaimer: CHAT_DISCLAIMER,
                  }),
                );
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    error: msg,
                    disclaimer:
                      "AI 回复仅供参考，不构成投资建议。市场有风险，决策请独立判断。",
                  }),
                );
              }
              return;
            }

            if (url === "/api/review" && req.method === "POST") {
              try {
                const raw = await readBody(req);
                const body = JSON.parse(raw) as {
                  quotes?: QuoteSnapshot[];
                  marketIndices?: unknown[];
                  _apiKey?: string;
                  _apiBase?: string;
                  _model?: string;
                };
                const key = body._apiKey?.trim() || env.OPENAI_API_KEY;
                if (!key) {
                  res.statusCode = 503;
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      error: AI_CONFIG_REQUIRED_MESSAGE,
                      disclaimer:
                        "以上内容由大模型根据涨跌数据推测生成，不构成投资建议。市场有风险，决策请独立判断。",
                    }),
                  );
                  return;
                }
                const quotes = Array.isArray(body.quotes) ? body.quotes : [];
                const marketIndices = Array.isArray(body.marketIndices)
                  ? (body.marketIndices as import("./api/lib/marketCore.ts").MarketIndexSnapshot[])
                  : undefined;
                if (quotes.length === 0 && (!marketIndices || marketIndices.length === 0)) {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      error: "quotes 与 marketIndices 不能同时为空",
                      disclaimer:
                        "以上内容由大模型根据涨跌数据推测生成，不构成投资建议。市场有风险，决策请独立判断。",
                    }),
                  );
                  return;
                }
                const { runAiReview, REVIEW_DISCLAIMER } =
                  await import("./api/lib/reviewCore.ts");
                const out = await runAiReview(
                  quotes,
                  marketIndices,
                  {
                  apiKey: key,
                  base: body._apiBase?.trim() || env.OPENAI_API_BASE,
                  model: body._model?.trim() || env.OPENAI_MODEL,
                  },
                );
                if ("error" in out) {
                  res.statusCode = 502;
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      error: out.error,
                      disclaimer: REVIEW_DISCLAIMER,
                    }),
                  );
                  return;
                }
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    result: out.result,
                    disclaimer: REVIEW_DISCLAIMER,
                  }),
                );
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    error: msg,
                    disclaimer:
                      "以上内容由大模型根据涨跌数据推测生成，不构成投资建议。市场有风险，决策请独立判断。",
                  }),
                );
              }
              return;
            }

            if (url === "/api/marketAnalysis" && req.method === "POST") {
              try {
                const raw = await readBody(req);
                const body = JSON.parse(raw) as {
                  _apiKey?: string;
                  _apiBase?: string;
                  _model?: string;
                };
                const key = body._apiKey?.trim() || env.OPENAI_API_KEY;
                if (!key) {
                  res.statusCode = 503;
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      error: AI_CONFIG_REQUIRED_MESSAGE,
                      disclaimer:
                        "以上内容由大模型根据涨跌数据推测生成，不构成投资建议。市场有风险，决策请独立判断。",
                    }),
                  );
                  return;
                }

                // 服务端自己拉取大盘数据，不再依赖前端传入
                const { resolveMarketIndices: resolveIdx } =
                  await import("./api/lib/marketCore.ts");
                const { indices, warning } = await resolveIdx();

                if (indices.length === 0) {
                  res.statusCode = 502;
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      error: "大盘指数数据源暂时不可用（东方财富接口连接失败），请稍后重试。",
                      disclaimer:
                        "以上内容由大模型根据涨跌数据推测生成，不构成投资建议。市场有风险，决策请独立判断。",
                    }),
                  );
                  return;
                }

                const { runAiMarketAnalysis, REVIEW_DISCLAIMER } =
                  await import("./api/lib/reviewCore.ts");
                const out = await runAiMarketAnalysis(
                  indices,
                  warning,
                  {
                  apiKey: key,
                  base: body._apiBase?.trim() || env.OPENAI_API_BASE,
                  model: body._model?.trim() || env.OPENAI_MODEL,
                  },
                );
                if ("error" in out) {
                  res.statusCode = 502;
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      error: out.error,
                      disclaimer: REVIEW_DISCLAIMER,
                    }),
                  );
                  return;
                }
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    result: out.result,
                    disclaimer: REVIEW_DISCLAIMER,
                  }),
                );
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    error: msg,
                    disclaimer:
                      "以上内容由大模型根据涨跌数据推测生成，不构成投资建议。市场有风险，决策请独立判断。",
                  }),
                );
              }
              return;
            }

            if (url === "/api/config-test" && req.method === "POST") {
              try {
                const raw = await readBody(req);
                const body = JSON.parse(raw) as {
                  apiKey?: string;
                  apiBase?: string;
                  model?: string;
                };
                const apiKey = body.apiKey?.trim();
                if (!apiKey) {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ ok: false, error: "API Key 不能为空" }));
                  return;
                }
                const base = (body.apiBase?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
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
                res.setHeader("Content-Type", "application/json");
                if (!openaiRes.ok) {
                  const t = await openaiRes.text();
                  res.end(JSON.stringify({ ok: false, error: `模型请求失败: ${openaiRes.status} ${t.slice(0, 300)}` }));
                } else {
                  res.end(JSON.stringify({ ok: true }));
                }
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: `连接失败: ${msg}` }));
              }
              return;
            }

            if (url === "/api/search" && req.method === "GET") {
              try {
                const searchParams = new URL(req.url ?? "", "http://localhost").searchParams;
                const keyword = searchParams.get("keyword");
                if (!keyword) {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: "keyword is required" }));
                  return;
                }
                const targetUrl = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(keyword)}`;
                const r = await fetch(targetUrl, {
                  headers: { "User-Agent": "Mozilla/5.0 FundMatrix/1.0" },
                });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const data = await r.json();
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(data));
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: msg }));
              }
              return;
            }

            next();
          });
        },
      },
    ],
    // Vite 开发服务器的反向代理（proxy）配置，作用是：
    // 在本地开发时，把浏览器发到 http://localhost:5173/api/... 的请求，转发到真实的第三方数据源，从而绕开浏览器跨域限制（CORS），并让前端代码始终用统一的 /api/* 前缀。
    server: {
      proxy: {
        "/api/fundgz": {
          target: "https://fundgz.1234567.com.cn",
          changeOrigin: true,
          secure: true,//校验 HTTPS 证书
          rewrite: (path) => path.replace(/^\/api\/fundgz/, "/js"),
        },
        "/api/em": {
          target: "https://push2.eastmoney.com",
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/em/, ""),
        },
        "/api/emhis": {
          target: "https://push2his.eastmoney.com",
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/emhis/, ""),
        },
      },
    },
  };
});
