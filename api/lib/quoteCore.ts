/** 东方财富 K 线 + 天天基金 fundgz — 供 Vercel / 服务端拉取 */

export type QuoteItemInput = { kind: "fund" | "stock" | "gold"; code: string };

export type QuoteSnapshot = {
  id: string;
  kind: "fund" | "stock" | "gold";
  code: string;
  name: string;
  price: number;
  changePctDay: number;
  changePctWeek: number | null;
  asOf: string;
};

const GOLD_ETF_SECID = "1.518880";//华安黄金 ETF 的 secid

// 解析天天基金 JSONP
function parseJsonpgz(text: string): Record<string, string> {
  const m = text.match(/jsonpgz\s*\(\s*(\{[\s\S]*?\})\s*\)/);
  if (!m?.[1]) throw new Error("无法解析基金估值脚本");
  return JSON.parse(m[1]) as Record<string, string>;
}

// 转换股票代码为东方财富的 secid 格式
function toSecid(code6: string): string {
  const c = code6.replace(/\D/g, "");
  if (c.length !== 6) throw new Error("股票代码须为 6 位数字");
  // 1.xxxxxx：沪市（常见 6/5/9 开头）
  // 0.xxxxxx：深市（常见 0/3 开头）
  if (c.startsWith("6") || c.startsWith("5") || c.startsWith("9"))
    return `1.${c}`;
  return `0.${c}`;
}

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 FundMatrix/1.0" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function fetchFundQuote(code: string): Promise<QuoteSnapshot> {
  const url = `https://fundgz.1234567.com.cn/js/${code}.js`;
  const text = await fetchText(url);
  const j = parseJsonpgz(text);
  const nav = Number.parseFloat(j.dwjz ?? "");
  const day = Number.parseFloat(j.gszzl ?? "");
  const id = `fund-${code}`;
  return {
    id,
    kind: "fund",
    code,
    name: j.name ?? code,
    price: Number.isFinite(nav) ? nav : 0, // 单位净值
    changePctDay: Number.isFinite(day) ? day : 0, // 日涨跌幅
    changePctWeek: null,
    asOf: j.gztime ?? j.jzrq ?? "", //净值日期
  };
}
// 解析东方财富K线数据
function parseKlineRow(row: string): {
  date: string;
  close: number;
  dayPct: number;
} {
  const p = row.split(",");
  const date = p[0] ?? ""; //日期
  const close = Number.parseFloat(p[2] ?? ""); //收盘价
  const dayPct = Number.parseFloat(p[8] ?? ""); //日涨跌幅
  return {
    date,
    close: Number.isFinite(close) ? close : 0,
    dayPct: Number.isFinite(dayPct) ? dayPct : 0,
  };
}

// 获取东方财富历史行情接口
async function fetchStockLike(
  secid: string,
  displayCode: string,
  kind: "stock" | "gold",
): Promise<QuoteSnapshot> {
  const kUrl =
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?` +
    new URLSearchParams({
      secid, // 市场标识+代码，如 "1.518880" (沪市华安黄金ETF)
      klt: "101", // K线粒度：101 代表日K
      fqt: "1", // 复权类型：1 代表前复权 (保证涨跌幅计算不受分红除权影响)
      lmt: "12", // 数据限制(limit)：获取最近 12 根日 K 线
      end: "20500101", // 结束日期设在未来，确保拉到的是今天最新的数据
      fields1: "f1", // 基础信息字段（不需要太多）
      fields2: "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61", // K 线具体字段
      // 东方财富返回的 K 线数据是一串逗号分隔的字符串，这里的 f51~f61 代表日期、开盘、收盘、最高、最低、成交量、成交额、振幅、涨跌幅等
      ut: "fa5fd1943c7b386f172d6893dbfba10b", // 东方财富接口常用的“通配”鉴权 Token
    });
  const kText = await fetchText(kUrl);
  const kJson = JSON.parse(kText) as {
    data?: { klines?: string[]; name?: string; code?: string };
  };
  const klines = kJson.data?.klines ?? [];
  if (klines.length === 0) throw new Error("无K线数据");
  const lastRow = klines[klines.length - 1]!; // 最新的日K线
  const firstIdx = Math.max(0, klines.length - 6); // 找到大约“一周前”那根
  const firstRow = klines[firstIdx]!; // “一周前”那根日K线
  const last = parseKlineRow(lastRow);
  const first = parseKlineRow(firstRow);
  // 计算近一周涨跌幅
  // 金融收益率计算公式：(期末 - 期初) / 期初 * 100。
  const weekPct =
    first.close > 0 ? ((last.close - first.close) / first.close) * 100 : null;

  const nm = kJson.data?.name ?? displayCode;
  const cd = kJson.data?.code ?? displayCode;

  const id = kind === "gold" ? "gold-XAU" : `stock-${displayCode}`;
  return {
    id,
    kind,
    code: displayCode,
    name: kind === "gold" ? `黄金（华安黄金ETF ${cd} 代理）` : nm,
    price: last.close, //今日收盘价
    changePctDay: last.dayPct, //今日涨跌幅
    // 周涨跌幅
    changePctWeek:
      weekPct != null && Number.isFinite(weekPct)
        ? Number(weekPct.toFixed(2))
        : null,
    asOf: last.date, //截止日期
  };
}

// 整个行情抓取模块的总入口
export async function resolveQuoteItem(
  item: QuoteItemInput,
): Promise<QuoteSnapshot> {
  // 判断是基金、黄金还是股票，然后调用各自对应的抓取函数
  if (item.kind === "fund") {
    const code = item.code.replace(/\D/g, "");//数据清洗，只保留数字
    if (code.length !== 6) throw new Error("基金代码须为 6 位数字");
    return fetchFundQuote(code);
  }

  // 黄金没有代码输入（因为全世界的现货黄金指标基本一致），只要看到 gold，就强制把写死好的 GOLD_ETF_SECID (即华安黄金 ETF 1.518880) 和固定代码 "XAU" 传给 fetchStockLike 去东方财富查。
  if (item.kind === "gold") {
    return fetchStockLike(GOLD_ETF_SECID, "XAU", "gold");
  }
  const code = item.code.replace(/\D/g, "");
  if (code.length !== 6) throw new Error("股票代码须为 6 位数字");
  const secid = toSecid(code);
  return fetchStockLike(secid, code, "stock");
}
// 批量抓取行情，这个函数被暴露给 api/quote.ts (API 路由入口) 调用
export async function resolveQuotes(
  items: QuoteItemInput[],
): Promise<QuoteSnapshot[]> {
  const out: QuoteSnapshot[] = [];
  // 采用串行解析方式，防止并发请求过多导致东方财富/天天基金接口被封禁
  for (const it of items) {
    out.push(await resolveQuoteItem(it));
  }
  return out;
}
