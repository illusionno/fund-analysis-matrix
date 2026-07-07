import {
  CheckCircleFilled,
  CloseCircleFilled,
  EyeInvisibleOutlined,
  EyeOutlined,
  LoadingOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Drawer,
  Flex,
  Input,
  Space,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";
import { useConfig } from "../store/configStore";

type ConnectionStatus = "idle" | "testing" | "ok" | "fail";

interface ConfigDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ConfigDrawer({ open, onClose }: ConfigDrawerProps) {
  const { message } = App.useApp();
  const store = useConfig();

  const [apiKey, setApiKey] = useState(store.apiKey);
  const [apiBase, setApiBase] = useState(store.apiBase);
  const [model, setModel] = useState(store.model);
  const [connStatus, setConnStatus] = useState<ConnectionStatus>("idle");
  const [connError, setConnError] = useState("");

  /** 点开抽屉时用 store 最新值初始化本地 state */
  const handleOpen = () => {
    setApiKey(store.apiKey);
    setApiBase(store.apiBase);
    setModel(store.model);
    setConnStatus("idle");
    setConnError("");
  };

  const handleSave = () => {
    store.setAll({
      apiKey: apiKey.trim(),
      apiBase: apiBase.trim(),
      model: model.trim(),
    });
    message.success("配置已保存到浏览器本地");
    onClose();
  };

  const handleTest = async () => {
    const key = apiKey.trim();
    if (!key) {
      message.warning("请先填写 API Key");
      return;
    }
    setConnStatus("testing");
    setConnError("");
    try {
      const res = await fetch("/api/config-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: key,
          apiBase: apiBase.trim() || undefined,
          model: model.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setConnStatus("ok");
        message.success("连接成功");
      } else {
        setConnStatus("fail");
        setConnError(data.error ?? "未知错误");
      }
    } catch (e) {
      setConnStatus("fail");
      setConnError(e instanceof Error ? e.message : String(e));
    }
  };

  const hasSaved =
    apiKey.trim() === store.apiKey &&
    apiBase.trim() === store.apiBase &&
    model.trim() === store.model;

  const statusDot = (() => {
    if (connStatus === "testing") return <LoadingOutlined style={{ color: "#d4a574" }} />;
    if (connStatus === "ok") return <CheckCircleFilled style={{ color: "#609b71" }} />;
    if (connStatus === "fail") return <CloseCircleFilled style={{ color: "#cf1322" }} />;
    if (store.isConfigured()) return <CheckCircleFilled style={{ color: "#609b71" }} />;
    return <CloseCircleFilled style={{ color: "#d4a574" }} />;
  })();

  const statusText = (() => {
    if (connStatus === "testing") return "正在测试连接…";
    if (connStatus === "ok") return "连接正常";
    if (connStatus === "fail") return connError || "连接失败";
    if (store.isConfigured()) return "已配置（未测试）";
    return "未配置 API Key — AI 功能不可用";
  })();

  const statusColor = (() => {
    if (connStatus === "fail") return "#cf1322";
    if (connStatus === "ok" || store.isConfigured()) return "#609b71";
    return "#d4a574";
  })();

  return (
    <Drawer
      title={
        <Space>
          <SettingOutlined />
          <span>API 配置</span>
        </Space>
      }
      placement="right"
      width={420}
      onClose={onClose}
      open={open}
      afterOpenChange={(v) => { if (v) handleOpen(); }}
      className="fm-config-drawer"
      styles={{
        body: { padding: "20px 24px" },
      }}
      footer={
        <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
          <Space size={4} align="center">
            {statusDot}
            <Typography.Text style={{ fontSize: 12, color: statusColor }}>
              {statusText}
            </Typography.Text>
          </Space>
          <Space>
            <Button onClick={handleTest} loading={connStatus === "testing"}>
              测试连接
            </Button>
            <Button type="primary" onClick={handleSave} disabled={hasSaved}>
              保存配置
            </Button>
          </Space>
        </Flex>
      }
      extra={
        hasSaved ? (
          <Tag color="default" style={{ borderRadius: 999 }}>
            已保存
          </Tag>
        ) : (
          <Tag color="gold" style={{ borderRadius: 999 }}>
            未保存
          </Tag>
        )
      }
    >
      <Flex vertical gap={20}>
        {/* API Key */}
        <Flex vertical gap={6}>
          <Typography.Text
            strong
            style={{ fontSize: 13, letterSpacing: "0.02em" }}
          >
            API Key
          </Typography.Text>
          <Input.Password
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setConnStatus("idle");
            }}
            placeholder="sk-…"
            autoComplete="off"
            iconRender={(visible) =>
              visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
            }
            styles={{
              input: {
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 13,
              },
            }}
          />
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            保存在浏览器本地，不会上传到服务器
          </Typography.Text>
        </Flex>

        {/* API Base URL */}
        <Flex vertical gap={6}>
          <Typography.Text
            strong
            style={{ fontSize: 13, letterSpacing: "0.02em" }}
          >
            API Base URL
          </Typography.Text>
          <Input
            value={apiBase}
            onChange={(e) => {
              setApiBase(e.target.value);
              setConnStatus("idle");
            }}
            placeholder="https://api.openai.com/v1"
            autoComplete="off"
            styles={{
              input: {
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 13,
              },
            }}
          />
        </Flex>

        {/* Model */}
        <Flex vertical gap={6}>
          <Typography.Text
            strong
            style={{ fontSize: 13, letterSpacing: "0.02em" }}
          >
            模型
          </Typography.Text>
          <Input
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setConnStatus("idle");
            }}
            placeholder="deepseek-v4-pro"
            autoComplete="off"
            styles={{
              input: {
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 13,
              },
            }}
          />
        </Flex>
      </Flex>
    </Drawer>
  );
}
