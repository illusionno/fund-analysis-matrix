import {
  AppstoreOutlined,
  BarChartOutlined,
  LinkOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, List, Space, Spin, Tag, Typography, Tabs, Tooltip } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AI_CONFIG_REQUIRED_MESSAGE } from "../../api/lib/aiConfigMessages";
import { fetchAiReview, fetchAiMarketAnalysis } from "../services/reviewApi";
import { useConfig } from "../store/configStore";
import type { MarketIndexSnapshot } from "../types/market";
import type { QuoteSnapshot } from "../types/quote";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mdStyles from "./AiChatMarkdown.module.scss";

/** 模型常把整篇报告包在 ```markdown ... ``` 内，会被当成代码块从而原样显示 #、** */
function unwrapOuterMarkdownFence(raw: string): string {
  let t = raw.trim().replace(/\r\n/g, "\n");
  for (let pass = 0; pass < 2; pass++) {
    const lines = t.split("\n");
    if (lines.length < 3) break;
    const first = lines[0].trim();
    const last = lines[lines.length - 1].trim();
    if (!first.startsWith("```") || last !== "```") break;
    t = lines.slice(1, -1).join("\n").trim();
  }
  return t;
}

const marketMarkdownComponents: Components = {
  a({ href, children }) {
    if (!href) return <span>{children}</span>;
    return (
      <Typography.Link href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </Typography.Link>
    );
  },
};

type ReviewSource = { title?: string; url?: string };

type ReviewItem = {
  code?: string;
  kind?: string;
  name?: string;
  todayBrief?: string;
  weekBrief?: string;
  todayDetail?: string;
  weekDetail?: string;
  /** 模型返回的普适性投资小建议（非买卖指令） */
  investTip?: string;
  /** 兼容旧版接口 */
  todayReason?: string;
  weekReason?: string;
  sources?: unknown;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function parseItems(result: unknown): ReviewItem[] {
  if (!isRecord(result)) return [];
  const items = result.items;
  if (!Array.isArray(items)) return [];
  return items.filter(isRecord) as ReviewItem[];
}

function summaryText(result: unknown): string | null {
  if (!isRecord(result)) return null;
  const s = result.summary;
  return typeof s === "string" ? s : null;
}

function portfolioTipsList(result: unknown): string[] {
  if (!isRecord(result)) return [];
  const raw = result.portfolioTips;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );
}

function marketBriefText(result: unknown): string | null {
  if (!isRecord(result)) return null;
  const s = result.marketBrief;
  return typeof s === "string" && s.trim().length > 0 ? s.trim() : null;
}

function fallbackMarketBrief(
  marketIndices: MarketIndexSnapshot[] | undefined,
): string | null {
  if (!marketIndices || marketIndices.length === 0) return null;
  const sorted = [...marketIndices].sort((a, b) => b.changePctDay - a.changePctDay);
  const leader = sorted[0];
  const lagger = sorted[sorted.length - 1];
  const avg =
    marketIndices.reduce((sum, it) => sum + it.changePctDay, 0) / marketIndices.length;
  const tone = avg >= 0 ? "偏强" : "偏弱";
  if (leader.id === lagger.id) {
    return `今日大盘整体${tone}，${leader.name}${leader.changePctDay >= 0 ? "上涨" : "下跌"}${Math.abs(leader.changePctDay).toFixed(2)}%，结构分化不明显。`;
  }
  return `今日大盘整体${tone}，${leader.name}相对领涨、${lagger.name}相对偏弱，市场呈现一定结构分化。`;
}

function firstBrief(text: string | undefined, max = 72): string {
  if (!text) return "—";
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const i = cut.lastIndexOf("。");
  if (i > 12) return cut.slice(0, i + 1);
  return `${cut}…`;
}

function parseSources(raw: unknown): ReviewSource[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((x) => ({
      title: typeof x.title === "string" ? x.title : undefined,
      url: typeof x.url === "string" ? x.url : undefined,
    }))
    .filter((s) => s.title && s.url && /^https?:\/\//i.test(s.url));
}

function rootSources(result: unknown): ReviewSource[] {
  if (!isRecord(result)) return [];
  return parseSources(result.sources);
}

function itemBriefDetail(it: ReviewItem) {
  const todayBrief = it.todayBrief ?? firstBrief(it.todayReason);
  const weekBrief = it.weekBrief ?? firstBrief(it.weekReason);
  const todayDetail = it.todayDetail ?? it.todayReason ?? "—";
  const weekDetail = it.weekDetail ?? it.weekReason ?? "—";
  const investTip =
    typeof it.investTip === "string" && it.investTip.trim()
      ? it.investTip.trim()
      : null;
  const sources = parseSources(it.sources);
  return { todayBrief, weekBrief, todayDetail, weekDetail, investTip, sources };
}

function SourcesBlock({ sources }: { sources: ReviewSource[] }) {
  if (sources.length === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        新闻与参考来源
      </Typography.Text>
      <ul style={{ margin: "6px 0 0", paddingLeft: 18, listStyle: "disc" }}>
        {sources.map((s, i) => (
          <li key={`${s.url}-${i}`} style={{ marginBottom: 4 }}>
            <Typography.Link
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <LinkOutlined style={{ marginRight: 4 }} />
              {s.title}
            </Typography.Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

type AiReviewSectionProps = {
  quotes: QuoteSnapshot[];
  marketIndices?: MarketIndexSnapshot[];
  onMarketBriefChange?: (text: string | null) => void;
  onOpenConfig?: () => void;
};

export function AiReviewSection({
  quotes,
  marketIndices,
  onMarketBriefChange,
  onOpenConfig,
}: AiReviewSectionProps) {
  const [activeTab, setActiveTab] = useState<"market" | "portfolio">("market");
  
  // Portfolio Review State
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [errorPortfolio, setErrorPortfolio] = useState<string | null>(null);
  const [disclaimerPortfolio, setDisclaimerPortfolio] = useState<string | null>(null);
  const [resultPortfolio, setResultPortfolio] = useState<unknown>(null);
  const lastAutoRunKeyPortfolioRef = useRef<string>("");
  
  // Market Analysis State
  const [loadingMarket, setLoadingMarket] = useState(false);
  const [errorMarket, setErrorMarket] = useState<string | null>(null);
  const [disclaimerMarket, setDisclaimerMarket] = useState<string | null>(null);
  const [resultMarket, setResultMarket] = useState<string | null>(null);

  const aiConfigured = useConfig((s) => s.isConfigured());

  const hasQuotes = quotes.length > 0;
  const hasMarket = (marketIndices?.length ?? 0) > 0;

  const runPortfolio = useCallback(async () => {
    if (!aiConfigured) {
      setErrorPortfolio(AI_CONFIG_REQUIRED_MESSAGE);
      return;
    }
    if (!hasQuotes && !hasMarket) return;
    setLoadingPortfolio(true);
    setErrorPortfolio(null);
    setDisclaimerPortfolio(null);
    setResultPortfolio(null);
    onMarketBriefChange?.(null);
    try {
      const data = await fetchAiReview(quotes, marketIndices);
      if (data.error) {
        setErrorPortfolio(data.error);
        setDisclaimerPortfolio(data.disclaimer ?? null);
        onMarketBriefChange?.(null);
        return;
      }
      setResultPortfolio(data.result ?? null);
      onMarketBriefChange?.(
        marketBriefText(data.result) ?? fallbackMarketBrief(marketIndices),
      );
      setDisclaimerPortfolio(data.disclaimer ?? null);
    } catch (e) {
      setErrorPortfolio(e instanceof Error ? e.message : String(e));
      onMarketBriefChange?.(null);
    } finally {
      setLoadingPortfolio(false);
    }
  }, [aiConfigured, hasQuotes, hasMarket, marketIndices, onMarketBriefChange, quotes]);

  /** 大盘 AI 分析：API 内部自行拉取指数数据，前端只需触发调用 */
  const runMarket = useCallback(async () => {
    if (!aiConfigured) {
      setErrorMarket(AI_CONFIG_REQUIRED_MESSAGE);
      return;
    }
    setLoadingMarket(true);
    setErrorMarket(null);
    setDisclaimerMarket(null);
    setResultMarket(null);
    try {
      const data = await fetchAiMarketAnalysis();
      if (data.error) {
        setErrorMarket(data.error);
        setDisclaimerMarket(data.disclaimer ?? null);
        return;
      }
      setResultMarket(typeof data.result === 'string' ? data.result : null);
      setDisclaimerMarket(data.disclaimer ?? null);
    } catch (e) {
      setErrorMarket(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMarket(false);
    }
  }, [aiConfigured]);

  const items = parseItems(resultPortfolio);
  const summary = summaryText(resultPortfolio);
  const portfolioTips = portfolioTipsList(resultPortfolio);
  const globalSources = rootSources(resultPortfolio);

  const marketMarkdownText = useMemo(
    () => (resultMarket ? unwrapOuterMarkdownFence(resultMarket) : ""),
    [resultMarket],
  );
  
  const autoRunKeyPortfolio = useMemo(() => {
    const q = quotes
      .map((x) => `${x.id}:${x.changePctDay}:${x.changePctWeek ?? "n"}:${x.asOf}`)
      .join("|");
    const m = (marketIndices ?? [])
      .map((x) => `${x.id}:${x.changePctDay}:${x.asOf}`)
      .join("|");
    return `${q}__${m}`;
  }, [marketIndices, quotes]);

  // 当自选列表或大盘数据加载完毕后，自动触发自选复盘的生成
  useEffect(() => {
    if (!aiConfigured) return;
    if (!hasQuotes && !hasMarket) return;
    if (autoRunKeyPortfolio === lastAutoRunKeyPortfolioRef.current) return;
    lastAutoRunKeyPortfolioRef.current = autoRunKeyPortfolio;
    void runPortfolio();
  }, [aiConfigured, autoRunKeyPortfolio, hasQuotes, hasMarket, runPortfolio]);

  // 挂载后自动触发大盘 AI 分析（API 内部自行拉取数据）
  useEffect(() => {
    if (!aiConfigured) return;
    void runMarket();
  }, [aiConfigured, runMarket]);

  const configRequiredAlert = !aiConfigured ? (
    <Alert
      type="info"
      showIcon
      message="需要配置 AI 才能使用复盘功能"
      description={AI_CONFIG_REQUIRED_MESSAGE}
      style={{ marginBottom: 12 }}
      action={
        onOpenConfig ? (
          <Button size="small" type="primary" onClick={onOpenConfig}>
            去配置
          </Button>
        ) : undefined
      }
    />
  ) : null;

  const renderPortfolioTab = () => (
    <Spin spinning={loadingPortfolio} tip="分析中…">
      {configRequiredAlert}
      {errorPortfolio ? (
        <Alert
          type="warning"
          showIcon
          message={errorPortfolio}
          style={{ marginBottom: 12 }}
        />
      ) : null}

      {!loadingPortfolio && summary ? (
        <div className="fm-review-summary">
          <Typography.Paragraph
            className="fm-review-summary__text"
          >
            {summary}
          </Typography.Paragraph>
          {portfolioTips.length > 0 ? (
            <div>
              <div className="fm-review-tag">投资小建议</div>
              <ul className="fm-review-tips-ul">
                {portfolioTips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <SourcesBlock sources={globalSources} />
        </div>
      ) : null}
      {!loadingPortfolio && !summary && portfolioTips.length > 0 ? (
        <div className="fm-review-callout">
          <div className="fm-advice">组合层面小建议</div>
          <ul className="fm-review-tips-ul">
            {portfolioTips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
          <SourcesBlock sources={globalSources} />
        </div>
      ) : null}
      {!loadingPortfolio &&
      !summary &&
      portfolioTips.length === 0 &&
      globalSources.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <SourcesBlock sources={globalSources} />
        </div>
      ) : null}

      {!loadingPortfolio && items.length > 0 ? (
        <List
          itemLayout="vertical"
          dataSource={items}
          renderItem={(it, idx) => {
            const { todayDetail, weekDetail, investTip, sources } =
              itemBriefDetail(it);
            return (
              <List.Item
                key={`${it.code ?? idx}-${it.kind ?? ""}`}
                className="fm-review-list-item"
              >
                <Typography.Title
                  level={5}
                  style={{
                    marginTop: 0,
                    marginBottom: 12,
                  }}
                >
                  {it.name ?? it.code}{" "}
                  <Typography.Text type="secondary" code>
                    {it.kind ?? "—"}
                  </Typography.Text>
                </Typography.Title>
                <Typography.Paragraph style={{ marginBottom: 8 }}>
                  <Typography.Text type="danger" strong>
                    今日{" "}
                  </Typography.Text>
                  <span className="fm-review-text">{todayDetail}</span>
                </Typography.Paragraph>
                <Typography.Paragraph
                  style={{ marginBottom: investTip ? 12 : 0 }}
                >
                  <Typography.Text className="fm-week-heading" strong>
                    一周{" "}
                  </Typography.Text>
                  <span className="fm-review-text">{weekDetail}</span>
                </Typography.Paragraph>
                {investTip ? (
                  <div>
                    <div className="fm-review-tag">
                      投资小建议
                    </div>
                    <div className="fm-review-text mt-8">{investTip}</div>
                  </div>
                ) : null}
                <SourcesBlock sources={sources} />
              </List.Item>
            );
          }}
        />
      ) : null}

      {!loadingPortfolio && resultPortfolio && items.length === 0 && !summary ? (
        <pre
          style={{
            maxHeight: 260,
            overflow: "auto",
            padding: 12,
            borderRadius: 8,
            background: "rgba(15,23,42,0.45)",
            fontSize: 12,
          }}
        >
          {JSON.stringify(resultPortfolio, null, 2)}
        </pre>
      ) : null}

      {disclaimerPortfolio ? (
        <Typography.Paragraph
          type="secondary"
          style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}
        >
          {disclaimerPortfolio}
        </Typography.Paragraph>
      ) : null}
    </Spin>
  );

  const renderMarketTab = () => (
    <Spin spinning={loadingMarket} tip="生成大盘分析中…">
      {configRequiredAlert}
      {!hasMarket && !loadingMarket && !resultMarket ? (
        <Alert
          type="info"
          showIcon
          message="大盘指数数据暂不可用"
          description="东方财富行情接口当前无法连接（可能限流或网络波动），请稍后刷新页面重试。基金自选复盘不受影响。"
          style={{ marginBottom: 12 }}
          action={
            <Button size="small" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          }
        />
      ) : null}

      {errorMarket ? (
        <Alert
          type="warning"
          showIcon
          message={errorMarket}
          style={{ marginBottom: 12 }}
        />
      ) : null}

      {!loadingMarket && resultMarket ? (
        <div className={`${mdStyles.root} ${mdStyles.market}`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={marketMarkdownComponents}
          >
            {marketMarkdownText}
          </ReactMarkdown>
        </div>
      ) : null}

      {disclaimerMarket ? (
        <Typography.Paragraph
          type="secondary"
          style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}
        >
          {disclaimerMarket}
        </Typography.Paragraph>
      ) : null}
    </Spin>
  );

  return (
    <Card
      size="small"
      variant="borderless"
      className="fm-review"
      title={
        <Space className="fm-card-title-row">
          <ThunderboltOutlined className="fm-accent-icon" aria-hidden />
          <span className="fm-card-title">AI 复盘</span>
          <Tag color="gold" className="fm-card-hint-tag">
            今日 + 近一周 · 含投资小建议
          </Tag>
        </Space>
      }
      extra={
        <Tooltip
          title={
            activeTab === "market"
              ? ""
              : !hasQuotes && !hasMarket
                ? "请先添加自选标的或等待大盘数据加载"
                : ""
          }
        >
          <Button
            className="fm-review-btn"
            loading={activeTab === "market" ? loadingMarket : loadingPortfolio}
            disabled={activeTab === "market" ? false : (!hasQuotes && !hasMarket)}
            onClick={() => {
              if (activeTab === "market") void runMarket();
              else void runPortfolio();
            }}
          >
            重新生成
          </Button>
        </Tooltip>
      }
    >
      <Tabs
        className="fm-review-tabs"
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as "market" | "portfolio")}
        tabBarGutter={0}
        items={[
          {
            key: "market",
            label: (
              <span className="fm-review-tab-label">
                <BarChartOutlined className="fm-review-tab-label__icon" aria-hidden />
                <span className="fm-review-tab-label__text">今日板块分析</span>
              </span>
            ),
            children: renderMarketTab(),
          },
          {
            key: "portfolio",
            label: (
              <span className="fm-review-tab-label">
                <AppstoreOutlined className="fm-review-tab-label__icon" aria-hidden />
                <span className="fm-review-tab-label__text">我的自选复盘</span>
              </span>
            ),
            children: renderPortfolioTab(),
          },
        ]}
      />
    </Card>
  );
}
