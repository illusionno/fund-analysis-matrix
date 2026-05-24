
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { MarketIndexSnapshot } from './lib/marketCore'
import { parseJsonBody } from './lib/parseBody'
import { formatFetchError } from './lib/fetchWithTimeout'
import { REVIEW_DISCLAIMER, runAiMarketAnalysis } from './lib/reviewCore'

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

  const key = process.env.OPENAI_API_KEY
  if (!key) {
    res.status(503).json({
      error: '未配置 OPENAI_API_KEY',
      disclaimer: REVIEW_DISCLAIMER,
    })
    return
  }

  try {
    const body = parseJsonBody(req) as {
      marketIndices?: MarketIndexSnapshot[]
    }
    const marketIndices = Array.isArray(body.marketIndices) ? body.marketIndices : undefined
    const hasMarket = Array.isArray(marketIndices) && marketIndices.length > 0

    if (!hasMarket) {
      res.status(400).json({ error: 'marketIndices 不能为空', disclaimer: REVIEW_DISCLAIMER })
      return
    }

    const out = await runAiMarketAnalysis(marketIndices, {
      apiKey: key,
      base: process.env.OPENAI_API_BASE,
      model: process.env.OPENAI_MODEL,
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