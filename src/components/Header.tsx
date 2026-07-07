import {
  LineChartOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined,
} from "@ant-design/icons";
import { Button, Space, Switch, Tag, Tooltip, Typography } from "antd";
import icon from "../assets/icon.png";
import { useConfig } from "../store/configStore";

interface HeaderProps {
  isDark: boolean;
  onThemeChange: (dark: boolean) => void;
  onConfigClick: () => void;
}

export function Header({ isDark, onThemeChange, onConfigClick }: HeaderProps) {
  const configured = useConfig((s) => s.isConfigured());

  return (
    <header className="fm-header">
      <Space align="center" size="middle">
        <div className="fm-logo">
          <img
            className="fm-logo__img"
            src={icon}
            alt="Fund Matrix"
            decoding="async"
          />
        </div>
        <div>
          <Typography.Title level={4} style={{ margin: 0, fontWeight: 700 }}>
            <span className="fm-header__title-accent">Fund Analysis </span>Matrix
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            基金 · A 股 · 黄金 · 每日行情与 AI 复盘
          </Typography.Text>
        </div>
      </Space>

      <Space wrap align="center">
        <Tag icon={<LineChartOutlined />} color="gold">
          LIVE · fundgz / 东财
        </Tag>
        <Tooltip title={configured ? "AI 已配置" : "未配置 AI — 点击设置"} placement="bottom">
          <Button
            type="text"
            onClick={onConfigClick}
            className={`fm-header__config-btn${configured ? " is-configured" : ""}`}
            aria-label="API 配置"
          >
            <span className="fm-header__config-icon-wrap">
              <SettingOutlined />
              <span className="fm-header__config-dot" />
            </span>
          </Button>
        </Tooltip>
        <Space align="center">
          <Switch
            checked={isDark}
            onChange={onThemeChange}
            checkedChildren={<SunOutlined aria-hidden />}
            unCheckedChildren={<MoonOutlined aria-hidden />}
          />
        </Space>
      </Space>
    </header>
  );
}
