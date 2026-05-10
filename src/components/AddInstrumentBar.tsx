import { DeleteOutlined, PlusOutlined, StockOutlined } from "@ant-design/icons";
import { AutoComplete, Button, Card, Input, Segmented, Space, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import type { InstrumentKind } from "../store/watchlistStore";
import { useWatchlist } from "../store/watchlistStore";
import { WatchlistStrip } from "./WatchlistStrip";
import { fetchSearch } from "../services/searchApi";
import type { QuoteSnapshot } from "../types/quote";

interface AddInstrumentBarProps {
  quotes?: QuoteSnapshot[];
}

export function AddInstrumentBar({ quotes = [] }: AddInstrumentBarProps) {
  const [kind, setKind] = useState<InstrumentKind>("fund");
  const [code, setCode] = useState("");
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 切换类型时清空输入和选项
  useEffect(() => {
    setCode("");
    setOptions([]);
  }, [kind]);

  const addFund = useWatchlist((s) => s.addFund);
  const addStock = useWatchlist((s) => s.addStock);
  const addGold = useWatchlist((s) => s.addGold); 
  const clear = useWatchlist((s) => s.clear);
  const items = useWatchlist((s) => s.items);

  const handleSearch = (value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!value) {
      setOptions([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      const results = await fetchSearch(value);
      const filtered = results.filter(r => {
        if (kind === "fund") return r.CATEGORYDESC === "基金";
        return r.CATEGORYDESC !== "基金";
      });
      setOptions(filtered.map(r => ({
        value: r.CODE,
        label: `${r.CODE} - ${r.NAME} (${r.CATEGORYDESC})`
      })));
    }, 300);
  };

  const submit = () => {
    if (!code) return;
    if (kind === "fund") addFund(code);
    else addStock(code);
    setCode("");
    setOptions([]);
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
          <Button type="default" onClick={() => addGold()} className="fm-watch-gold-btn">
            黄金（518880 ETF 代理）
          </Button>
        </Space>

        <Space wrap style={{ width: "100%" }} align="end">
          <div style={{ flex: "1 1 300px", minWidth: 360 }}>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, display: "block", marginBottom: 4 }}
            >
              {kind === "fund" ? "基金代码" : "股票代码"} / 名称
            </Typography.Text>
            <AutoComplete
              value={code}
              options={options}
              onSelect={(val) => {
                setCode(val);
                setOptions([]);
              }}
              onSearch={handleSearch}
              onChange={setCode}
              style={{ width: "100%" }}
              placeholder={kind === "fund" ? "如 005827 或 易方达" : "如 600519 或 茅台"}
              allowClear
              filterOption={false}
            >
              <Input onPressEnter={submit} />
            </AutoComplete>
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

        <Space wrap className="fm-watch-shortcuts">
          <Typography.Text
            type="secondary"
            style={{ fontSize: 12, display: "block", marginBottom: 4 }}
          >
            快捷
          </Typography.Text>
          <Button size="small" onClick={() => addFund("005827")}>
            +005827
          </Button>
          <Button size="small" onClick={() => addFund("012544")}>
            +012544
          </Button>
          <Button
            size="small"
            icon={<StockOutlined />}
            onClick={() => addStock("600519")}
          >
            +600519
          </Button>
          <Button size="small" onClick={() => addGold()}>
            +黄金
          </Button>
        </Space>
      </Space>
      <h2 className="fm-section-title">当前自选</h2>
      <WatchlistStrip quotes={quotes} />
    </Card>
  );
}
