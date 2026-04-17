import type { EChartsOption } from 'echarts'
import ReactECharts from 'echarts-for-react'
import { Alert, Modal, Segmented, Spin, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { fetchKline } from '../services/klineApi'
import type { KlinePeriod } from '../types/kline'
import type { QuoteSnapshot } from '../types/quote'

const up = '#cf1322'
const down = '#389e0d'

const periodOptions: { label: string; value: KlinePeriod }[] = [
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
  { label: '年', value: 'year' },
]

interface TrendChartModalProps {
  quote: QuoteSnapshot | null
  onClose: () => void
}

function periodHint(kind: QuoteSnapshot['kind'], p: KlinePeriod): string {
  if (kind === 'fund') {
    if (p === 'week') return '近 52 周模拟净值（非官方历史）'
    if (p === 'month') return '近约 36 月模拟净值（非官方历史）'
    return '近约 120 月模拟净值（非官方历史）'
  }
  if (p === 'week') return '周 K 收盘（东方财富）'
  if (p === 'month') return '月 K 收盘（东方财富）'
  return '月 K 近约 10 年（按年维度浏览）'
}

export function TrendChartModal({ quote, onClose }: TrendChartModalProps) {
  const [period, setPeriod] = useState<KlinePeriod>('month')
  const [points, setPoints] = useState<{ date: string; value: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setPeriod('month')
  }, [quote?.id])

  useEffect(() => {
    if (!quote) {
      setPoints([])
      setErr(null)
      return
    }
    const code = quote.kind === 'gold' ? 'XAU' : quote.code
    setLoading(true)
    setErr(null)
    fetchKline(quote.kind, code, period)
      .then(setPoints)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [quote, period])

  const option = useMemo<EChartsOption>(() => {
    const isUp = quote ? quote.changePctDay >= 0 : true
    const accent = isUp ? up : down
    const areaFrom = isUp ? 'rgba(207,19,34,0.14)' : 'rgba(56,158,13,0.12)'
    const dates = points.map((p) => p.date)
    const values = points.map((p) => p.value)
    const labelInterval = dates.length > 24 ? Math.max(0, Math.floor(dates.length / 14) - 1) : 0

    return {
      backgroundColor: 'transparent',
      textStyle: { color: '#94a3b8', fontFamily: 'ui-monospace, monospace' },
      grid: { left: 52, right: 16, top: 48, bottom: period === 'year' ? 48 : 40 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15,23,42,0.95)',
        borderColor: 'rgba(37,99,235,0.35)',
        borderWidth: 1,
        textStyle: { color: '#e2e8f0' },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params]
          const first = arr[0] as { axisValue?: string; data?: number }
          const v = first?.data
          const d = first?.axisValue
          const label = quote?.kind === 'fund' ? '净值' : '收盘'
          return `${d}<br/><span style="color:${accent}">${label}</span> <b>${v != null ? Number(v).toFixed(quote?.kind === 'fund' ? 4 : 3) : '-'}</b>`
        },
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'rgba(51,65,85,0.8)' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 9,
          rotate: dates.length > 36 ? 42 : 24,
          interval: labelInterval,
        },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisLabel: { color: '#64748b', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(51,65,85,0.45)', type: 'dashed' } },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          showSymbol: false,
          lineStyle: { width: 2.5, color: accent, shadowBlur: 12, shadowColor: accent },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: areaFrom },
                { offset: 1, color: 'rgba(15,23,42,0.02)' },
              ],
            },
          },
          data: values,
        },
      ],
    }
  }, [points, quote, period])

  return (
    <Modal
      open={!!quote}
      onCancel={onClose}
      footer={null}
      width="min(92vw, 920px)"
      destroyOnClose
      centered
      title={
        quote ? (
          <div style={{ paddingRight: 8 }}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {quote.name}
            </Typography.Title>
            <Typography.Text type="secondary" code>
              {quote.code}
            </Typography.Text>
            <div style={{ marginTop: 6 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {periodHint(quote.kind, period)}
              </Typography.Text>
            </div>
          </div>
        ) : null
      }
    >
      {quote ? (
        <>
          <div style={{ marginBottom: 16 }}>
            <Segmented<KlinePeriod>
              options={periodOptions}
              value={period}
              onChange={setPeriod}
              block
            />
          </div>
          <Spin spinning={loading} tip="加载走势…">
            {err ? (
              <Alert type="error" showIcon message={err} />
            ) : points.length === 0 && !loading ? (
              <Typography.Text type="secondary">暂无数据</Typography.Text>
            ) : (
              <ReactECharts
                option={option}
                style={{ height: 380, width: '100%' }}
                opts={{ renderer: 'canvas' }}
                notMerge
              />
            )}
          </Spin>
        </>
      ) : null}
    </Modal>
  )
}
