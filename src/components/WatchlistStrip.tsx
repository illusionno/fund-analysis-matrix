import { CloseOutlined } from '@ant-design/icons'
import { Button, Empty, Typography } from 'antd'
import type { WatchItem } from '../store/watchlistStore'
import { useWatchlist } from '../store/watchlistStore'
import type { QuoteSnapshot } from '../types/quote'

function kindLabel(k: WatchItem['kind']) {
  if (k === 'fund') return '基金'
  if (k === 'stock') return '股票'
  return '黄金'
}

interface WatchlistStripProps {
  quotes?: QuoteSnapshot[]
}

export function WatchlistStrip({ quotes = [] }: WatchlistStripProps) {
  const items = useWatchlist((s) => s.items)
  const remove = useWatchlist((s) => s.remove)
  const quoteNameMap = new Map(quotes.map((q) => [q.id, q.name]))

  if (items.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无自选。添加基金 / 股票，或使用黄金（华安黄金 ETF 518880 代理）。"
      />
    )
  }

  return (
    <div className="fm-watchlist-grid">
      {items.map((i) => (
        <div key={i.id} className="fm-watchlist-item">
          <div className="fm-watchlist-item__main">
            <div className="fm-watchlist-item__meta">
              <span className={`fm-watchlist-item__kind fm-watchlist-item__kind--${i.kind}`}>
                {kindLabel(i.kind)}
              </span>
              <Typography.Text
                code
                className="fm-watchlist-item__code"
              >
                {i.kind === 'gold' ? 'XAU' : i.code}
              </Typography.Text>
            </div>
            <Typography.Text
              strong
              className="fm-watchlist-item__name"
              title={quoteNameMap.get(i.id) ?? (i.kind === 'gold' ? '黄金' : '加载中')}
            >
              {quoteNameMap.get(i.id) ?? (i.kind === 'gold' ? '黄金' : '加载中')}
            </Typography.Text>
          </div>
          <Button
            type="text"
            size="small"
            className="fm-watchlist-item__remove"
            aria-label={`删除${quoteNameMap.get(i.id) ?? (i.kind === 'gold' ? '黄金' : '该自选')}`}
            icon={<CloseOutlined />}
            onClick={() => remove(i.id)}
          />
        </div>
      ))}
    </div>
  )
}
