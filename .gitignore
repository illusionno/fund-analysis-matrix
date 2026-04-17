import type { QuoteItemInput, QuoteSnapshot } from "./api/lib/quoteCore";
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

            if (url === "/api/review" && req.method === "POST") {
              const key = env.OPENAI_API_KEY;
              if (!key) {
                res.statusCode = 503;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    error: "未配置 OPENAI_API_KEY（可在 .env.local 中设置）",
                    disclaimer:
                      "以上内容由大模型根据涨跌数据推测生成，不构成投资建议。市场有风险，决策请独立判断。",
                  }),
                );
                return;
              }
              try {
                const raw = await readBody(req);
                const body = JSON.parse(raw) as { quotes?: QuoteSnapshot[] };
                const { runAiReview, REVIEW_DISCLAIMER } =
                  await import("./api/lib/reviewCore.ts");
                const out = await runAiReview(body.quotes ?? [], {
                  apiKey: key,
                  base: env.OPENAI_API_BASE,
                  model: env.OPENAI_MODEL,
                });
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
