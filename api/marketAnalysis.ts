import type { VercelRequest, VercelResponse } from '@vercel/node'
import { resolveMarketIndices } from './lib/marketCore.js'
import { parseJsonBody } from './lib/parseBody.js'
import { formatFetchError } from './lib/fetchWithTimeout.js'
import { REVIEW_DISCLAIMER, runAiMarketAnalysis } from './lib/reviewCore.js'
import { AI_CONFIG_REQUIRED_MESSAGE } from './lib/aiConfigMessages.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const body = parseJsonBody(req) as {
      _apiKey?: string
      _apiBase?: string
      _model?: string
    }

    const key = body._apiKey?.trim() || process.env.OPENAI_API_KEY
    if (!key) {
      res.status(503).json({
        error: AI_CONFIG_REQUIRED_MESSAGE,
        disclaimer: REVIEW_DISCLAIMER,
      })
      return
    }

    // 服务端自己拉取最新大盘数据，不再依赖前端传入
    const { indices, warning } = await resolveMarketIndices()

    if (indices.length === 0) {
      res.status(502).json({
        error: '大盘指数数据源暂时不可用（东方财富接口连接失败），请稍后重试。',
        disclaimer: REVIEW_DISCLAIMER,
      })
      return
    }

    const out = await runAiMarketAnalysis(indices, warning, {
      apiKey: key,
      base: body._apiBase?.trim() || process.env.OPENAI_API_BASE,
      model: body._model?.trim() || process.env.OPENAI_MODEL,
    })

    if ('error' in out) {
      res.status(502).json({ error: out.error, disclaimer: REVIEW_DISCLAIMER })
      return
    }

    res.status(200).json({
      result: out.result,
      disclaimer: REVIEW_DISCLAIMER,
    })
  } catch (e) {
    console.error('[api/marketAnalysis]', e)
    res.status(502).json({
      error: formatFetchError(e, '大盘 AI 分析'),
      disclaimer: REVIEW_DISCLAIMER,
    })
  }
}