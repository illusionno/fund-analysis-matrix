import { MessageOutlined, SendOutlined, StopOutlined } from "@ant-design/icons";
import {
  App,
  Button,
  Collapse,
  Drawer,
  Empty,
  Flex,
  FloatButton,
  Input,
  Spin,
  Switch,
  Typography,
} from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { streamAiChat, type ChatTurn } from "../services/chatApi";
import { useConfig } from "../store/configStore";
import type { QuoteSnapshot } from "../types/quote";
import { AI_CONFIG_REQUIRED_MESSAGE } from "../../api/lib/aiConfigMessages";
import mdStyles from "./AiChatMarkdown.module.scss";

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  streaming?: boolean; // 是否流式
  deepThinkUsed?: boolean; // 记录当前开关的状态
};

const TH_OPEN = "<thinking>";
const TH_CLOSE = "</thinking>";
const AN_OPEN = "<answer>";
const AN_CLOSE = "</answer>";

/** 模型可能输出带标签的文本，从模型输出中拆分 <thinking> 与 <answer>，兼容流式未闭合 */
function parseThinkAnswer(raw: string): { thinking: string; answer: string } {
  const i0 = raw.indexOf(TH_OPEN);
  const i1 = raw.indexOf(TH_CLOSE);
  const j0 = raw.indexOf(AN_OPEN);
  const j1 = raw.indexOf(AN_CLOSE);

  let thinking = "";
  let answer = "";

  if (i0 !== -1) {
    const start = i0 + TH_OPEN.length;
    thinking = (i1 !== -1 ? raw.slice(start, i1) : raw.slice(start)).trim();
  }
  if (j0 !== -1) {
    const start = j0 + AN_OPEN.length;
    answer = (j1 !== -1 ? raw.slice(start, j1) : raw.slice(start)).trim();
  } else if (i1 !== -1) {
    const tail = raw.slice(i1 + TH_CLOSE.length).trim();
    if (tail && !tail.startsWith(AN_OPEN)) {
      answer = tail;
    }
  }

  const noTags = i0 === -1 && j0 === -1 && i1 === -1 && j1 === -1;
  if (noTags) {
    answer = raw.trim();
  }
  return { thinking, answer };
}
// 合并思考过程：来自流式 NDJSON 的 r 字段（服务端/模型 reasoning 通道） 和 模型正文d里的 <thinking> 标签
function mergeThinking(apiReasoning: string, taggedThinking: string): string {
  const a = apiReasoning.trim();
  const b = taggedThinking.trim();
  if (a && b) return `${a}\n\n—\n\n${b}`; //
  return a || b;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// 处理外链跳转
const markdownComponents: Components = {
  a({ href, children }) {
    if (!href) return <span>{children}</span>;
    return (
      // 外链跳转
      <Typography.Link href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </Typography.Link>
    );
  },
};

function ChatMarkdown({
  text,
  variant = "answer",
}: {
  text: string;
  variant?: "answer" | "thinking";
}) {
  const cls =
    variant === "thinking"
      ? `${mdStyles.root} ${mdStyles.thinking}`
      : mdStyles.root;
  return (
    <div className={cls}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

interface AiChatModalProps {
  quotes?: QuoteSnapshot[];
}

const AiChatModal = ({ quotes = [] }: AiChatModalProps) => {
  const { message } = App.useApp();
  const [visible, setVisible] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [deepThink, setDeepThink] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** 每次发起/中止请求递增，避免旧请求的 finally 把新请求的 loading 关掉 */
  const streamRequestIdRef = useRef(0);
  const streamBufRef = useRef({ model: "", reasoning: "" }); //流式缓冲区：model 正文增量拼接，reasoning 为 r 增量拼接
  const streamDeepThinkRef = useRef(false); // 流式输出时，是否启用了深度思考

  // 首次加载时，滚动到列表底部
  const scrollToBottom = useCallback(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (visible) scrollToBottom();
  }, [visible, messages, loading, scrollToBottom]);

  // 清理函数：在组件卸载时，中止当前的请求
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const applyStreamChunk = useCallback((assistantId: string) => {
    // model：目前为止后端返回的全部正文（由每次回调的 line.d 拼接而来）。
    // reasoning：目前为止后端返回的全部底层推理过程（由每次回调的 line.r 拼接而来）。
    const { model, reasoning } = streamBufRef.current;
    // 有些模型（如 DeepSeek R1）并不是通过专用的 r 通道发推理，而是在正文里直接输出 <thinking>思考内容...</thinking>最终回答
    // 从模型输出中拆分思考内容和正文
    const { thinking: taggedT, answer } = parseThinkAnswer(model);
    const thinking = streamDeepThinkRef.current
      ? mergeThinking(reasoning, taggedT)
      : undefined;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? {
              ...m,
              content: answer,
              thinking: thinking || undefined,
              streaming: true,
            }
          : m,
      ),
    );
  }, []);
  // 终止流生成
  const finalizeStreamingAssistants = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) =>
        m.role === "assistant" && m.streaming ? { ...m, streaming: false } : m,
      ),
    );
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    streamRequestIdRef.current += 1;
    finalizeStreamingAssistants();
    setLoading(false);
    abortRef.current = null;
  }, [finalizeStreamingAssistants]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    if (!useConfig.getState().isConfigured()) {
      message.warning(AI_CONFIG_REQUIRED_MESSAGE);
      return;
    }

    // 正在生成时再次发送：先中止当前流，再发新的一条
    if (loading) {
      abortRef.current?.abort();
      finalizeStreamingAssistants();
    }

    // 创建一个AbortController实例，用于在请求完成前中止请求
    const ac = new AbortController();
    abortRef.current = ac;
    const requestId = ++streamRequestIdRef.current;

    // 用户发送的消息
    const userMsg: UiMessage = { id: newId(), role: "user", content: text };
    const assistantId = newId();
    // 助手回复的占位消息
    const assistantPlaceholder: UiMessage = {
      id: assistantId, //
      role: "assistant", // user / assistant
      content: "",
      thinking: undefined, //是否开启深度思考
      streaming: true, //是否流式生成
      deepThinkUsed: deepThink,
    };

    setInput("");
    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setLoading(true);
    // 流式缓冲区：model 正文增量拼接，reasoning 为 r 增量拼接
    streamBufRef.current = { model: "", reasoning: "" };
    streamDeepThinkRef.current = deepThink;
    // 组装历史消息，打包成 historyForApi 准备发给后端。
    const historyForApi: ChatTurn[] = [...messages, userMsg].map(
      ({ role, content }) => ({ role, content }),
    );

    try {
      await streamAiChat(
        historyForApi,
        quotes,
        deepThink,
        // 回调函数, 后端返回每一行数据（NDJSON 格式）时都会触发一次。
        (line) => {
          if (line.err) {
            message.error(line.err);
            // 并把刚才创建的 AI 空气泡从列表中删掉。
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            return;
          }
          if (line.d) {
            streamBufRef.current.model += line.d;
            applyStreamChunk(assistantId);
          }
          if (line.r && streamDeepThinkRef.current) {
            streamBufRef.current.reasoning += line.r;
            applyStreamChunk(assistantId);
          }
          if (line.done) {
            applyStreamChunk(assistantId);
            // 把该条消息的 streaming 状态设为 false，此时 UI 会取消“正在思考中…”等动效。
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, streaming: false } : m,
              ),
            );
          }
        },
        ac.signal, //传入中止信号
      );
    } catch (e) {
      // 比如用户关闭了对话框导致组件卸载触发了 abort()，这属于正常的主动打断，不是网络故障
      if ((e as Error).name === "AbortError") {
        if (streamRequestIdRef.current === requestId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, streaming: false } : m,
            ),
          );
        }
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        message.error(msg);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    } finally {
      if (streamRequestIdRef.current === requestId) {
        setLoading(false);
        if (abortRef.current === ac) abortRef.current = null;
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    message.success("已清空对话");
  };

  const footer = (
    <Flex vertical gap={8}>
      <Flex align="center" justify="space-between" wrap="wrap" gap={8}>
        <Flex align="center" gap={8}>
          <Switch
            checked={deepThink}
            onChange={setDeepThink}
            disabled={loading}
          />
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            深度思考
          </Typography.Text>
        </Flex>
      </Flex>
      <Input.TextArea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="请开始你的提问..."
        autoSize={{ minRows: 2, maxRows: 6 }}
        title={
          loading
            ? "生成中可继续输入；再次发送会先停止当前回复并发新消息"
            : undefined
        }
      />
      <Flex justify="flex-end" gap={8} wrap="wrap">
        <Button onClick={() => setInput("")} disabled={loading || !input}>
          清空
        </Button>
        {loading ? (
          <Button icon={<StopOutlined />} onClick={stopGeneration}>
            停止
          </Button>
        ) : null}
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={loading}
          onClick={() => void handleSend()}
        >
          发送
        </Button>
      </Flex>
    </Flex>
  );

  const renderAssistantBody = (m: UiMessage) => {
    const hasThink = Boolean(m.thinking?.trim());
    const showAnswer = m.content.trim().length > 0 || !hasThink;
    const answerText =
      m.content.trim() ||
      (m.streaming ? "正在思考中…" : hasThink ? "" : "（无正文）");

    return (
      <Flex vertical gap={8} style={{ width: "100%" }}>
        {hasThink && m.deepThinkUsed && (
          <Collapse
            key={`${m.id}-${m.streaming ? "stream" : "done"}`}
            size="small"
            defaultActiveKey={m.streaming && m.deepThinkUsed ? ["think"] : []}
            items={[
              {
                key: "think",
                label: m.streaming ? "正在思考中..." : "思考过程",
                children: (
                  <ChatMarkdown text={m.thinking ?? ""} variant="thinking" />
                ),
              },
            ]}
          />
        )}
        {showAnswer &&
          (m.content.trim().length > 0 ? (
            <ChatMarkdown text={m.content} variant="answer" />
          ) : (
            <Typography.Text
              type="secondary"
              style={{ fontSize: 14, whiteSpace: "pre-wrap" }}
            >
              {answerText}
            </Typography.Text>
          ))}
      </Flex>
    );
  };

  return (
    <div>
      <FloatButton
        icon={<MessageOutlined />}
        className="fm-chat-float-btn"
        tooltip={{
          title: "你的基金AI小助手",
          placement: "top",
        }}
        onClick={() => setVisible(true)}
      />
      <Drawer
        title="AI 对话"
        placement="right"
        size="45%"
        onClose={() => {
          abortRef.current?.abort();
          setVisible(false);
        }}
        open={visible}
        className="fm-chat-drawer"
        footer={footer}
        extra={
          <Button
            size="small"
            onClick={clearChat}
            disabled={messages.length === 0}
          >
            清空对话
          </Button>
        }
        styles={{
          body: {
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            overflow: "auto",
          },
        }}
      >
        <Typography.Paragraph type="secondary" className="fm-chat-disclaimer">
          开启深度思考时先推演再作答，思考过程可折叠。模型回复仅供参考，不构成投资建议。
        </Typography.Paragraph>

        {messages.length === 0 && !loading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="开始提问，例如：今日自选里谁涨得最多？黄金和权益怎么搭配更稳妥？"
          />
        ) : (
          <Flex vertical gap={12} style={{ flex: 1 }}>
            {messages.map((m) => (
              <Flex
                key={m.id}
                justify={m.role === "user" ? "flex-end" : "flex-start"}
              >
                <div
                  className={
                    m.role === "user"
                      ? "fm-chat-bubble fm-chat-bubble--user"
                      : "fm-chat-bubble fm-chat-bubble--assistant"
                  }
                >
                  {m.role === "user" ? (
                    <Typography.Text
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontSize: 14,
                      }}
                    >
                      {m.content}
                    </Typography.Text>
                  ) : (
                    renderAssistantBody(m)
                  )}
                </div>
              </Flex>
            ))}
            {loading && messages[messages.length - 1]?.role !== "assistant" && (
              <Flex align="center" gap={8} style={{ paddingLeft: 4 }}>
                <Spin size="small" />
                <Typography.Text type="secondary">连接中…</Typography.Text>
              </Flex>
            )}
            <div ref={listEndRef} />
          </Flex>
        )}
      </Drawer>
    </div>
  );
};

export default AiChatModal;
