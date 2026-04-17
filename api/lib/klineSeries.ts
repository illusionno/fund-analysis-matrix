/** 趋势图：股票/黄金走东方财富 K 线；基金为基于净值的模拟曲线 */

export type KlinePeriod = 'week' | 'month' | 'year'

const GOLD_ETF_SECID = '1.518880'

function parseJsonpgz(text: string): Record<string, string> {
  const m = text.match(/jsonpgz\s*\(\s*(\{[\s\S]*?\})\s*\)/)
  if (!m?.[1]) throw new Error('无法解析基金估值脚本')
  return JSON.parse(m[1]) as Record<string, string>
}

function toSecid(code6: string): string {
  const c = code6.replace(/\D/g, '')
  if (c.length !== 6) throw new Error('股票代码须为 6 位数字')
  if (c.startsWith('6') || c.startsWith('5') || c.startsWith('9')) return `1.${c}`
  return `0.${c}`
}

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 FundMatrix/1.0' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

/** 基金：按周期生成模拟点（非真实历史） */
function buildMockFundSeries(endNav: number, period: KlinePeriod): { date: string; value: number }[] {
  if (!Number.isFinite(endNav) || endNav <= 0) return []
  const spec =
    period === 'week'
      ? { count: 52, stepDays: 7 }
      : period === 'month'
        ? { count: 36, stepDays: 30 }
        : { count: 120, stepDays: 30 }

  const { count, stepDays } = spec
  const out: { date: string; value: number }[] = []
  const start = endNav * 0.94
  for (let i = 0; i < count; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (count - 1 - i) * stepDays)
    const date = d.toISOString().slice(0, 10)
    const t = count > 1 ? i / (count - 1) : 1
    const wave = Math.sin(t * Math.PI * 2.2) * endNav * 0.008
    let value = start + (endNav - start) * t + wave
    if (i === count - 1) value = endNav
    out.push({ date, value: Number(value.toFixed(4)) })
  }
  return out
}

function klineParams(period: KlinePeriod): { klt: string; lmt: string } {
  switch (period) {
    case 'week':
      return { klt: '102', lmt: '104' }
    case 'month':
      return { klt: '103', lmt: '36' }
    case 'year':
      return { klt: '103', lmt: '120' }
    default:
      return { klt: '101', lmt: '60' }
  }
}

export async function fetchKlineSeries(
  kind: 'fund' | 'stock' | 'gold',
  code: string,
  period: KlinePeriod = 'month',
): Promise<{ date: string; value: number }[]> {
  if (kind === 'fund') {
    const c = code.replace(/\D/g, '')
    if (c.length !== 6) throw new Error('基金代码须为 6 位数字')
    const text = await fetchText(`https://fundgz.1234567.com.cn/js/${c}.js`)
    const j = parseJsonpgz(text)
    const nav = Number.parseFloat(j.dwjz ?? '')
    const end = Number.isFinite(nav) ? nav : 0
    return buildMockFundSeries(end, period)
  }

  const secid = kind === 'gold' ? GOLD_ETF_SECID : toSecid(code.replace(/\D/g, ''))
  const { klt, lmt } = klineParams(period)
  const kUrl =
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?` +
    new URLSearchParams({
      secid,
      klt,
      fqt: '1',
      lmt,
      end: '20500101',
      fields1: 'f1',
      fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
      ut: 'fa5fd1943c7b386f172d6893dbfba10b',
    })
  const kText = await fetchText(kUrl)
  const kJson = JSON.parse(kText) as { data?: { klines?: string[] } }
  const klines = kJson.data?.klines ?? []
  if (klines.length === 0) throw new Error('无K线数据')
  return klines.map((row) => {
    const p = row.split(',')
    const v = Number.parseFloat(p[2] ?? '')
    return {
      date: p[0] ?? '',
      value: Number.isFinite(v) ? Number(v.toFixed(3)) : 0,
    }
  })
}
