import type { VercelRequest, VercelResponse } from "@vercel/node";
import { formatFetchError } from "./lib/fetchWithTimeout";
import {
  MARKET_INDEX_TOTAL,
  resolveMarketIndices,
} from "./lib/marketCore";

const EMPTY_WARNING =
  "大盘指数行情暂不可用（上游可能对境外/机房 IP 有限制，或请求超时）。可稍后重试。";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const indices = await resolveMarketIndices();
    const payload: {
      indices: typeof indices;
      warning?: string;
    } = { indices };
    if (indices.length === 0) {
      payload.warning = EMPTY_WARNING;
    } else if (indices.length < MARKET_INDEX_TOTAL) {
      payload.warning = `部分指数行情未返回（${indices.length}/${MARKET_INDEX_TOTAL}），可能与网络或数据源限制有关。`;
    }
    res.status(200).json(payload);
  } catch (e) {
    console.error("[api/market]", e);
    res.status(200).json({
      indices: [],
      warning: `${formatFetchError(e, "大盘指数行情")}。${EMPTY_WARNING}`,
    });
  }
}
