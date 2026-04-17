import { CloseOutlined } from '@ant-design/icons'
import { Empty, Space, Tag, Typography } from 'antd'
import type { WatchItem } from '../store/watchlistStore'
import { useWatchlist } from '../store/watchlistStore'

function kindLabel(k: WatchItem['kind']) {
  if (k === 'fund') return '基金'
  if (k === 'stock') return '股票'
  return '黄金'
}

export function WatchlistStrip() {
  const items = useWatchlist((s) => s.items)
  const remove = useWatchlist((s) => s.remove)

  if (items.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无自选。添加基金 / 股票，或使用黄金（华安黄金 ETF 518880 代理）。"
      />
    )
  }

  return (
    <Space wrap >
      {items.map((i) => (
        <Tag
          key={i.id}
          closable
          closeIcon={<CloseOutlined />}
          onClose={(e) => {
            e.preventDefault()
            remove(i.id)
          }}
          style={{ padding: '6px 10px', fontSize: 13 }}
        >
          <Typography.Text type="secondary" style={{ fontSize: 11, marginRight: 6 }}>
            {kindLabel(i.kind)}
          </Typography.Text>
          <Typography.Text code>{i.kind === 'gold' ? 'XAU' : i.code}</Typography.Text>
        </Tag>
      ))}
    </Space>
  )
}
