import {
  LineChartOutlined,
  MoonOutlined,
  SunOutlined,
} from "@ant-design/icons";
import { Space, Switch, Tag, Typography } from "antd";
import FundIcon from "../assets/icon.svg?react";
interface HeaderProps {
  isDark: boolean;
  onThemeChange: (dark: boolean) => void;
}

export function Header({ isDark, onThemeChange }: HeaderProps) {
  return (
    <header className="fm-header">
      <Space align="center" size="middle">
        <div className="fm-logo">
          <FundIcon width={28} height={28} />
        </div>
        <div>
          <Typography.Title level={4} style={{ margin: 0, fontWeight: 700 }}>
            <span style={{ color: "#3b82f6" }}>Fund Analysis </span>Matrix
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            基金 · A 股 · 黄金 · 每日行情与 AI 复盘
          </Typography.Text>
        </div>
      </Space>

      <Space wrap align="center">
        <Tag icon={<LineChartOutlined />} color="processing">
          LIVE · fundgz / 东财
        </Tag>
        <Space align="center">
          {isDark ? <MoonOutlined /> : <SunOutlined />}
          <Switch
            checked={isDark}
            onChange={onThemeChange}
            checkedChildren="暗色"
            unCheckedChildren="亮色"
          />
        </Space>
      </Space>
    </header>
  );
}
