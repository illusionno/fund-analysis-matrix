import { LinkOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Alert, Button, Card, List, Space, Spin, Tag, Typography } from "antd";
import { useState } from "react";
import { fetchAiReview } from "../services/reviewApi";
import type { QuoteSnapshot } from "../types/quote";

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

interface AiReviewSectionProps {
  quotes: QuoteSnapshot[];
}

export function AiReviewSection({ quotes }: AiReviewSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  const run = async () => {
    if (quotes.length === 0) return;
    setLoading(true);
    setError(null);
    setDisclaimer(null);
    setResult(null);
    try {
      const data = await fetchAiReview(quotes);
      if (data.error) {
        setError(data.error);
        setDisclaimer(data.disclaimer ?? null);
        return;
      }
      setResult(data.result ?? null);
      setDisclaimer(data.disclaimer ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const items = parseItems(result);
  const summary = summaryText(result);
  const portfolioTips = portfolioTipsList(result);
  const globalSources = rootSources(result);

  return (
    <Card
      size="small"
      variant="borderless"
      className="fm-review"
      title={
        <Space>
          <ThunderboltOutlined style={{ color: "#7c3aed" }} />
          <span>AI 复盘</span>
          <Tag color="purple">今日 + 近一周 · 含投资小建议</Tag>
        </Space>
      }
      extra={
        <Button
          className="fm-review-btn"
          loading={loading}
          disabled={quotes.length === 0}
          onClick={() => void run()}
        >
          生成复盘
        </Button>
      }
    >
      <Spin spinning={loading} tip="分析中…">
        {error ? (
          <Alert
            type="warning"
            showIcon
            message={error}
            style={{ marginBottom: 12 }}
          />
        ) : null}

        {!loading && summary ? (
          <div style={{ marginBottom: 16 }}>
            <Typography.Paragraph
              style={{
                marginBottom: globalSources.length ? 8 : 0,
                borderLeft: "3px solid #7c3aed",
                paddingLeft: 12,
              }}
            >
              {summary}
            </Typography.Paragraph>
            {portfolioTips.length > 0 ? (
              <div>
                <div className="fm-review-tag">投资小建议</div>
                <ul
                  style={{
                    margin: "8px 0 0",
                    paddingLeft: 18,
                    marginBottom: 0,
                  }}
                >
                  {portfolioTips.map((t, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <SourcesBlock sources={globalSources} />
          </div>
        ) : null}
        {!loading && !summary && portfolioTips.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <Alert
              type="info"
              showIcon
              message="组合层面小建议"
              description={
                <ul
                  style={{
                    margin: "8px 0 0",
                    paddingLeft: 18,
                    marginBottom: 0,
                  }}
                >
                  {portfolioTips.map((t, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {t}
                    </li>
                  ))}
                </ul>
              }
            />
            <SourcesBlock sources={globalSources} />
          </div>
        ) : null}
        {!loading &&
        !summary &&
        portfolioTips.length === 0 &&
        globalSources.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <SourcesBlock sources={globalSources} />
          </div>
        ) : null}

        {!loading && items.length > 0 ? (
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
                    <Typography.Text style={{ color: "#2563eb" }} strong>
                      一周{" "}
                    </Typography.Text>
                    <span className="fm-review-text">{weekDetail}</span>
                  </Typography.Paragraph>
                  {investTip ? (
                    <div>
                      <div className="fm-review-tag">投资小建议</div>
                      <div className="fm-review-text mt-8">{investTip}</div>
                    </div>
                  ) : null}
                  <SourcesBlock sources={sources} />
                </List.Item>
              );
            }}
          />
        ) : null}

        {!loading && result && items.length === 0 && !summary ? (
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
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}

        {disclaimer ? (
          <Typography.Paragraph
            type="secondary"
            style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}
          >
            {disclaimer}
          </Typography.Paragraph>
        ) : null}
      </Spin>
    </Card>
  );
}
