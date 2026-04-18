import { DeleteOutlined, PlusOutlined, StockOutlined } from "@ant-design/icons";
import { Button, Card, Input, Segmented, Space, Typography } from "antd";
import { useState } from "react";
import type { InstrumentKind } from "../store/watchlistStore";
import { useWatchlist } from "../store/watchlistStore";
import { WatchlistStrip } from "./WatchlistStrip";
export function AddInstrumentBar() {
  const [kind, setKind] = useState<InstrumentKind>("fund");
  const [code, setCode] = useState("");
  const addFund = useWatchlist((s) => s.addFund);
  const addStock = useWatchlist((s) => s.addStock);
  const addGold = useWatchlist((s) => s.addGold); 
  const clear = useWatchlist((s) => s.clear);
  const items = useWatchlist((s) => s.items);

  const submit = () => {
    if (kind === "fund") addFund(code);
    else addStock(code);
    setCode("");
  };

  return (
    <Card
      size="small"
      title="添加自选"
      variant="borderless"
      className="fm-card"
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space wrap align="center">
          <Segmented<InstrumentKind>
            options={[
              { label: "基金", value: "fund" },
              { label: "股票", value: "stock" },
            ]}
            value={kind}
            onChange={setKind}
          />
          <Button type="default" onClick={() => addGold()}>
            黄金（518880 ETF 代理）
          </Button>
        </Space>

        <Space wrap style={{ width: "100%" }} align="end">
          <div style={{ flex: "1 1 200px", minWidth: 160 }}>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, display: "block", marginBottom: 4 }}
            >
              {kind === "fund" ? "基金代码" : "股票代码"}
            </Typography.Text>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onPressEnter={submit}
              placeholder={kind === "fund" ? "如 005827" : "如 600519"}
              allowClear
            />
          </div>

          <Button
            className="fm-primary-btn"
            icon={<PlusOutlined />}
            onClick={submit}
          >
            添加
          </Button>
          <Button
            
            className="fm-clear-btn"
            icon={<DeleteOutlined />}
            disabled={items.length === 0}
            onClick={() => clear()}
          >
            清空
          </Button>
        </Space>

        <Space wrap>
          <Typography.Text
            type="secondary"
            style={{ fontSize: 12, display: "block", marginBottom: 4 }}
          >
            快捷
          </Typography.Text>
          <Button size="small" onClick={() => addFund("005827")}>
            005827
          </Button>
          <Button size="small" onClick={() => addFund("012544")}>
            012544
          </Button>
          <Button
            size="small"
            icon={<StockOutlined />}
            onClick={() => addStock("600519")}
          >
            600519
          </Button>
          <Button size="small" onClick={() => addGold()}>
            黄金
          </Button>
        </Space>
      </Space>
      <h2 className="fm-section-title">当前自选</h2>
      <WatchlistStrip />
    </Card>
  );
}
