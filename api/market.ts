import type { VercelRequest, VercelResponse } from "@vercel/node";
import { formatFetchError } from "./lib/fetchWithTimeout.js";
import {
  resolveMarketIndices,
  MARKET_INDEX_TOTAL,
} from "./lib/marketCore.js";

const EMPTY_WARNING = `大盘指数数据源暂时不可用（东方财富接口连接失败），已尝试获取 ${MARKET_INDEX_TOTAL} 路指数均未成功，请稍后刷新重试。基金自选复盘不受影响。`;

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
    const { indices, warning } = await resolveMarketIndices();
    const payload: {
      indices: typeof indices;
      warning?: string;
    } = { indices, warning };
    res.status(200).json(payload);
  } catch (e) {
    console.error("[api/market]", e);
    res.status(200).json({
      indices: [],
      warning: `${formatFetchError(e, "大盘指数行情")}。${EMPTY_WARNING}`,
    });
  }
}
