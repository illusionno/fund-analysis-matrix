import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Empty, Skeleton, Space, Tag, Typography } from 'antd'
import { useCallback, useState, useEffect } from 'react'
import { LineChartOutlined } from '@ant-design/icons'
import { fetchQuotes } from '../services/quoteApi'
import type { QuoteSnapshot } from '../types/quote'
import { useWatchlist } from '../store/watchlistStore'
import { TrendChartModal } from './TrendChartModal'

function kindLabel(kind: QuoteSnapshot['kind']): string {
  if (kind === 'fund') return '基金'
  if (kind === 'stock') return '股票'
  return '黄金'
}

function PctCell({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="fm-pct-muted">—</span>
  }
  return (
    <span className={value >= 0 ? 'fm-pct-up' : 'fm-pct-down'}>
      {value >= 0 ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  )
}

function QuoteSnapshotCard({
  quote,
  onOpenTrend,
}: {
  quote: QuoteSnapshot
  onOpenTrend: (q: QuoteSnapshot) => void
}) {
  const priceStr = quote.kind === 'fund' ? quote.price.toFixed(4) : quote.price.toFixed(3)

  return (
    <Card
      size="small"
      hoverable
      className="fm-quote-snapshot-card"
      onClick={() => onOpenTrend(quote)}
      styles={{ body: { padding: '12px 14px' } }}
    >
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <Typography.Text strong ellipsis style={{ flex: 1, minWidth: 0 }} title={quote.name}>
            {quote.name}
          </Typography.Text>
          <Tag style={{ flexShrink: 0 }}>{kindLabel(quote.kind)}</Tag>
        </div>
        <Typography.Text type="secondary" code style={{ fontSize: 12 }}>
          {quote.code}
        </Typography.Text>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 2,
          }}
        >
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {quote.kind === 'fund' ? '净值' : '价格'}
          </Typography.Text>
          <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
            {priceStr}
          </Typography.Text>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '4px 12px',
            alignItems: 'center',
            fontSize: 13,
          }}
        >
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            今日
          </Typography.Text>
          <div style={{ textAlign: 'right' }}>
            <PctCell value={quote.changePctDay} />
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            近一周
          </Typography.Text>
          <div style={{ textAlign: 'right' }}>
            <PctCell value={quote.changePctWeek} />
          </div>
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 11, opacity: 0.75 }}>
          {quote.asOf || '—'}
        </Typography.Text>
      </Space>
    </Card>
  )
}

function QuoteSnapshotSkeletonCard({ index }: { index: number }) {
  return (
    <Card
      size="small"
      className="fm-quote-snapshot-card"
      styles={{ body: { padding: '12px 14px' } }}
    >
      <Skeleton
        active
        title={{ width: index % 2 === 0 ? '58%' : '46%' }}
        paragraph={{ rows: 4, width: ['34%', '82%', '68%', '52%'] }}
      />
    </Card>
  )
}

interface QuoteBoardProps {
  quotes: QuoteSnapshot[]
  onQuotesChange: (q: QuoteSnapshot[]) => void
}

export function QuoteBoard({ quotes, onQuotesChange }: QuoteBoardProps) {
  const items = useWatchlist((s) => s.items)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trendQuote, setTrendQuote] = useState<QuoteSnapshot | null>(null)

  const refresh = useCallback(async () => {
    if (items.length === 0) {
      onQuotesChange([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const payload = items.map((i) => ({
        kind: i.kind,
        code: i.kind === 'gold' ? 'XAU' : i.code,
      }))
      const data = await fetchQuotes(payload)
      onQuotesChange(data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      onQuotesChange([])
    } finally {
      setLoading(false)
    }
  }, [items, onQuotesChange])
  /** 持久化恢复完成后立即拉一次行情，避免首屏 items 仍为空 */
  useEffect(() => {
    const run = () => {
      void refresh()
    }
    if (useWatchlist.persist.hasHydrated()) {
      run()
    } else {
      return useWatchlist.persist.onFinishHydration(run)
    }
  }, [refresh])

  /** 每 5 分钟自动刷新 */
  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh()
    }, 5 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [refresh])
  return (
    <>
      <TrendChartModal quote={trendQuote} onClose={() => setTrendQuote(null)} />
      <Card
        size="small"
        title={
          <Space>
            <LineChartOutlined style={{ color: '#3b82f6' }} />
            <span>行情快照</span>
            <Tag color="blue"> 点击任意行情卡片查看趋势图（周 / 月 / 年可切换）</Tag>
          </Space>
        }
        variant="borderless"
        styles={{ body: { paddingTop: 8 } }}
        className="fm-card"
        extra={
          <Button
           className='fm-primary-btn'
            style={{marginBottom: 16}}
            icon={<ReloadOutlined spin={loading} />}
            disabled={items.length === 0 || loading}
            onClick={() => void refresh()}
          >
            刷新行情
          </Button>
          
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 12 }}>
         进入页面会自动拉取一次，之后每 5 分钟自动更新。
        </Typography.Paragraph>
        {error ? (
          <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />
        ) : null}

        {loading ? (
          <div className="fm-quote-grid">
            {Array.from({ length: Math.max(items.length, 2) }).map((_, idx) => (
              <QuoteSnapshotSkeletonCard key={`quote-skeleton-${idx}`} index={idx} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Typography.Text type="secondary">请先添加自选后再刷新行情。</Typography.Text>
        ) : quotes.length === 0 ? (
          <Empty description='点击右上角「刷新行情」拉取最新数据' />
        ) : (
          <div className="fm-quote-grid">
            {quotes.map((q) => (
              <QuoteSnapshotCard key={q.id} quote={q} onOpenTrend={setTrendQuote} />
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
