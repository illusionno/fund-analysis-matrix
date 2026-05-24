import type { QuoteSnapshot } from './quoteCore'
import type { MarketIndexSnapshot } from './marketCore'
import { fetchWithTimeout, formatFetchError } from './fetchWithTimeout'

export const REVIEW_DISCLAIMER =
  '以上内容由大模型根据涨跌数据推测生成，不构成投资建议。市场有风险，决策请独立判断。'

export type ReviewOptions = {
  apiKey: string
  base?: string
  model?: string
}

type ChatCompletionResult =
  | { content: string }
  | { error: string; status: number; network?: boolean }

const LLM_FETCH_MS = 25000

function resolveFallbackModel(base: string, model: string): string | undefined {
  const normalizedBase = base.toLowerCase()
  const normalizedModel = model.toLowerCase()
  if (!normalizedBase.includes('dashscope.aliyuncs.com')) return undefined
  if (!normalizedModel.includes('qwen') || normalizedModel === 'qwen-turbo') return undefined
  return 'qwen-turbo'
}

async function requestChatCompletion(
  base: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<ChatCompletionResult> {
  let openaiRes: Response
  try {
    openaiRes = await fetchWithTimeout(
      `${base}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      LLM_FETCH_MS,
      '大模型服务',
    )
  } catch (e) {
    console.error('[reviewCore] chat/completions network error:', e)
    return {
      error: formatFetchError(e, '大模型服务'),
      status: 0,
      network: true,
    }
  }

  if (!openaiRes.ok) {
    const errorText = await openaiRes.text()
    return { error: errorText, status: openaiRes.status }
  }

  const raw = (await openaiRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return { content: raw.choices?.[0]?.message?.content ?? '' }
}

export async function runAiMarketAnalysis(
  marketIndices: MarketIndexSnapshot[] | undefined,
  opts: ReviewOptions,
): Promise<{ result: string } | { error: string }> {
  const base = opts.base?.replace(/\/$/, '') ?? 'https://api.openai.com/v1'
  const model = opts.model ?? 'gpt-4o-mini'

  const marketLines = (marketIndices ?? []).map(
    (m) =>
      `- ${m.name}（${m.id}）点位 ${m.price.toFixed(2)}，今日涨跌 ${m.changePctDay.toFixed(2)}%，时间 ${m.asOf}`,
  )

  const date = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

  const userPrompt = `你是一位资深宏观经济与A股策略分析师，请对${date}的A股市场板块涨跌情况进行全面分析，要求包含以下内容：

1. 大盘指数概况（上证、深成指、创业板指、科创50等主要指数的涨跌幅及全天成交额走势）；
2. 涨幅居前的3-5个板块方向，及各自的驱动逻辑（需引用当日具体事件或机构观点）；
3. 跌幅居前的3-5个板块方向，及下挫的核心原因分析；
4. 板块轮动的核心矛盾与资金特征（量能变化、风格偏好、行业性价比变化等）；
5. 提取1-2家国内头部券商（如中信建投、光大、银河等）的最新策略观点，与当日盘面相互印证；
6. 给出后市展望与主要风险提示。

请以专业、客观、数据翔实的风格输出，分析中需标注有据可查的具体数据（如成交额、涨跌幅、具体个股等），避免主观臆测。分析仅供市场复盘参考，文末需标注"本文不构成投资建议"。

这是今日大盘的基础数据：
${marketLines.join('\n')}

请直接输出 Markdown 格式的分析报告（不要使用 \`\`\` 代码块包裹全文；不要用 HTML 标签）。`;

  const requestBody = {
    model,
    temperature: 0.5,
    messages: [{ role: 'user', content: userPrompt }],
  }

  let completion = await requestChatCompletion(base, opts.apiKey, requestBody)
  if ('error' in completion && completion.status === 429) {
    const fallbackModel = resolveFallbackModel(base, model)
    if (fallbackModel) {
      completion = await requestChatCompletion(base, opts.apiKey, {
        ...requestBody,
        model: fallbackModel,
      })
    }
  }

  if ('error' in completion) {
    if (completion.network) {
      return { error: completion.error }
    }
    if (completion.status === 429) {
      return { error: `模型请求触发限流，请稍后重试或改用更轻量模型。上游返回: ${completion.status} ${completion.error}` }
    }
    return { error: `模型请求失败: ${completion.status} ${completion.error}` }
  }

  return { result: completion.content }
}

export async function runAiReview(
  quotes: QuoteSnapshot[],
  marketIndices: MarketIndexSnapshot[] | undefined,
  opts: ReviewOptions,
): Promise<{ result: unknown } | { error: string }> {
  const base = opts.base?.replace(/\/$/, '') ?? 'https://api.openai.com/v1'
  const model = opts.model ?? 'gpt-4o-mini'

  const lines = quotes.map(
    (q) =>
      `- [${q.kind}] ${q.name}（${q.code}）现价/净值 ${q.price}，今日涨跌 ${q.changePctDay.toFixed(2)}%，近一周涨跌 ${q.changePctWeek != null ? `${q.changePctWeek.toFixed(2)}%` : '暂无（基金估值接口未提供周线）'}，时间 ${q.asOf}`,
  )

  const marketLines = (marketIndices ?? []).map(
    (m) =>
      `- ${m.name}（${m.id}）点位 ${m.price.toFixed(2)}，今日涨跌 ${m.changePctDay.toFixed(2)}%，时间 ${m.asOf}`,
  )

  const hasQuotes = quotes.length > 0
  const hasMarket = marketLines.length > 0

  const userPrompt = hasQuotes
    ? `你是熟悉 A 股、公募基金与黄金资产的资深分析师。仅根据下列行情摘要（无实时新闻与盘口），用中文输出 JSON（不要 markdown），结构如下：
{"items":[{"code":"代码","kind":"fund|stock|gold","name":"名称","todayBrief":"今日：极短摘要（约24字内，点明涨跌方向与力度体感）","weekBrief":"近一周：极短摘要（约24字内）","todayDetail":"详细复盘（见下方篇幅要求）","weekDetail":"详细复盘（见下方篇幅要求）","investTip":"投资小建议（见下方 investTip 要求）","sources":[{"title":"来源标题","url":"https://完整可访问链接"}]}],"summary":"全市场/全列表总览（见下方篇幅要求）","marketBrief":"结合传入的大盘数据，给出今天大盘/板块整体涨跌的一句话简明原因和总结（约40字内）","portfolioTips":["组合层面小建议第1条","第2条","第3条（共2-4条）"],"sources":[{"title":"市场整体相关来源标题","url":"https://..."}]}

【详细程度 — 必须遵守】
- todayDetail：针对该标的单独写，不少于 120 汉字（约 6–10 句）。依次尽量覆盖（无依据则明确写「仅凭涨跌无法判断」并略写）：①当日涨跌与波动强度的解读；②可能相关的板块/风格/指数环境（fund 可联系股票/债券仓位与行业暴露的一般性逻辑）；③资金与情绪面的合理推测；④与近一周走势的衔接（若数据不足则说明）；⑤短期需关注的风险或催化（概括性、勿捏造具体新闻标题）。
- weekDetail：同样不少于 120 汉字（约 6–10 句）。覆盖：一周涨跌节奏（先抑后扬/单边等）、可能的中期驱动与反复原因、波动加大或收窄的解读；基金若缺周线数据，须明确说明「接口未提供周线」，再结合当日与常识做谨慎推断，仍须达到上述字数。
- summary：面向用户总览，不少于 80 汉字（约 3–5 句）：整体强弱、结构分化（若多标的）、共性逻辑与一句风险提示。

【投资小建议 — investTip 与 portfolioTips】
- investTip（每个标的 1 条）：50–100 汉字。只写**普适性**理财与风控习惯（如分散、定投纪律、再平衡、勿追高、设止损心理线、黄金/权益配比常识等），语气克制；**禁止**给出具体买卖时点、目标价、杠杆倍数或「必涨必跌」类断言；句末可带「仅供参考」。
- portfolioTips：字符串数组，**2–4 条**，面向用户当前整份自选列表的组合层面（相关性、集中度、股/基/黄金搭配思路等），同样不得构成具体交易指令；若仅 1 个标的则写 2 条通用原则即可。

【表述规范】
- 严格区分行情事实与推断：推断统一用「可能」「或受」「不排除」等措辞；禁止编造具体新闻事件名称、公告标题或精确日期政策。
- 股票/gold：可结合常见宏观与商品逻辑做推演；基金：侧重净值波动与底层资产类别的常识性解释，避免断言具体持仓调仓。

【sources】
仅填写真实存在、可公开访问的权威页面（交易所、巨潮、东方财富资讯、央行/证监会官网等）；无法核实则 []，禁止编造域名或路径。

行情：
${lines.join('\n')}
${hasMarket ? `\n这是今日大盘的基础数据：\n${marketLines.join('\n')}` : ''}`
    : `你是熟悉 A 股市场风格与指数结构的资深分析师。仅根据下列大盘指数数据（无实时新闻与盘口），用中文输出 JSON（不要 markdown），结构如下：
{"marketBrief":"给出今天大盘/板块整体涨跌的一句话简明原因和总结（约40字内，必须包含“领涨方向”或“领跌方向”）","marketDetail":"100字内补充说明，强调结构分化与风险提示","sources":[{"title":"来源标题","url":"https://完整可访问链接"}]}

要求：
- 严格基于指数涨跌做推断，使用“可能”“或受”等措辞，禁止编造具体新闻。
- 若指数分化明显，必须点出相对强弱方向（如成长/权重风格）。
- sources 无法核实时可返回 []。

这是今日大盘的基础数据：
${marketLines.join('\n')}`

  const requestBody = {
    model,
    temperature: 0.5,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: '只输出合法 JSON 对象，不要使用 markdown 代码块。',
      },
      { role: 'user', content: userPrompt },
    ],
  }

  let completion = await requestChatCompletion(base, opts.apiKey, requestBody)
  if ('error' in completion && completion.status === 429) {
    const fallbackModel = resolveFallbackModel(base, model)
    if (fallbackModel) {
      completion = await requestChatCompletion(base, opts.apiKey, {
        ...requestBody,
        model: fallbackModel,
      })
    }
  }

  if ('error' in completion) {
    if (completion.network) {
      return { error: completion.error }
    }
    if (completion.status === 429) {
      return { error: `模型请求触发限流，请稍后重试或改用更轻量模型。上游返回: ${completion.status} ${completion.error}` }
    }
    return { error: `模型请求失败: ${completion.status} ${completion.error}` }
  }

  const text = completion.content || '{}'
  try {
    const result = JSON.parse(text) as unknown
    return { result }
  } catch {
    return { error: '模型返回非 JSON' }
  }
}
