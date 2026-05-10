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

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 FundMatrix/1.0" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
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

export async function resolveMarketIndices(): Promise<MarketIndexSnapshot[]> {
  return Promise.all(MARKET_INDEX_LIST.map((spec) => fetchIndex(spec)));
}
