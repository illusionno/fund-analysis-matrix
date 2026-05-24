import { fetchTextWithTimeout } from "./fetchWithTimeout.js";

export type MarketIndexSnapshot = {
  id: string;
  name: string;
  price: number;
  changePctDay: number;
  asOf: string;
};

type MarketIndexSpec = {
  id: string;
  secid: string;
  fallbackName: string;
};

const MARKET_INDEX_LIST: MarketIndexSpec[] = [
  { id: "sh", secid: "1.000001", fallbackName: "上证指数" },
  { id: "sz", secid: "0.399001", fallbackName: "深证成指" },
  { id: "cyb", secid: "0.399006", fallbackName: "创业板指" },
];

/** 供 API 返回提示文案（与上方列表长度一致） */
export const MARKET_INDEX_TOTAL = MARKET_INDEX_LIST.length;

const MARKET_FETCH_MS = 6000;

const EASTMONEY_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  Referer: "https://quote.eastmoney.com/",
};

async function fetchText(url: string): Promise<string> {
  return fetchTextWithTimeout(
    url,
    { headers: EASTMONEY_HEADERS },
    MARKET_FETCH_MS,
    "东方财富行情",
  );
}

function parseKlineRow(row: string): {
  date: string;
  close: number;
  dayPct: number;
} {
  const p = row.split(",");
  const date = p[0] ?? "";
  const close = Number.parseFloat(p[2] ?? "");
  const dayPct = Number.parseFloat(p[8] ?? "");
  return {
    date,
    close: Number.isFinite(close) ? close : 0,
    dayPct: Number.isFinite(dayPct) ? dayPct : 0,
  };
}

async function fetchIndex(spec: MarketIndexSpec): Promise<MarketIndexSnapshot> {
  const url =
    "https://push2his.eastmoney.com/api/qt/stock/kline/get?" +
    new URLSearchParams({
      secid: spec.secid,
      klt: "101",
      fqt: "0",
      lmt: "1",
      end: "20500101",
      fields1: "f1,f2,f3,f4,f5,f6",
      fields2: "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
      ut: "fa5fd1943c7b386f172d6893dbfba10b",
    });

  const text = await fetchText(url);
  const json = JSON.parse(text) as {
    data?: { name?: string; klines?: string[] };
  };

  const lastLine = json.data?.klines?.[0];
  if (!lastLine) throw new Error(`指数 ${spec.id} 无可用行情`);

  const last = parseKlineRow(lastLine);
  return {
    id: spec.id,
    name: json.data?.name ?? spec.fallbackName,
    price: last.close,
    changePctDay: last.dayPct,
    asOf: last.date,
  };
}

/** 单指数失败不拖垮整体（境外 Serverless 访问东财常被限流/阻断） */
async function fetchIndexSafe(
  spec: MarketIndexSpec,
): Promise<MarketIndexSnapshot | null> {
  try {
    return await fetchIndex(spec);
  } catch (e) {
    console.warn(`[marketCore] ${spec.id} failed:`, e);
    return null;
  }
}

export async function resolveMarketIndices(): Promise<MarketIndexSnapshot[]> {
  const rows = await Promise.all(
    MARKET_INDEX_LIST.map((spec) => fetchIndexSafe(spec)),
  );
  return rows.filter((x): x is MarketIndexSnapshot => x !== null);
}
