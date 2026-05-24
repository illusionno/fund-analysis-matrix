import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { MarketIndexSnapshot } from './lib/marketCore.js'
import { parseJsonBody } from './lib/parseBody.js'
import type { QuoteSnapshot } from './lib/quoteCore.js'
import { formatFetchError } from './lib/fetchWithTimeout.js'
import { REVIEW_DISCLAIMER, runAiReview } from './lib/reviewCore.js'

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
      quotes?: QuoteSnapshot[]
      marketIndices?: MarketIndexSnapshot[]
    }
    const quotes = body.quotes ?? []
    const marketIndices = Array.isArray(body.marketIndices) ? body.marketIndices : undefined
    const hasQuotes = Array.isArray(quotes) && quotes.length > 0
    const hasMarket = Array.isArray(marketIndices) && marketIndices.length > 0
    if (!hasQuotes && !hasMarket) {
      res.status(400).json({ error: 'quotes 与 marketIndices 不能同时为空', disclaimer: REVIEW_DISCLAIMER })
      return
    }

    const out = await runAiReview(quotes, marketIndices, {
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
    console.error('[api/review]', e)
    res.status(502).json({
      error: formatFetchError(e, 'AI 复盘'),
      disclaimer: REVIEW_DISCLAIMER,
    })
  }
}
