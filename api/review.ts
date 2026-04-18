import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { QuoteSnapshot } from './lib/quoteCore'
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
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as {
      quotes?: QuoteSnapshot[]
    }
    const quotes = body.quotes ?? []
    if (!Array.isArray(quotes) || quotes.length === 0) {
      res.status(400).json({ error: 'quotes 不能为空', disclaimer: REVIEW_DISCLAIMER })
      return
    }

    const out = await runAiReview(quotes, {
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
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ error: msg, disclaimer: REVIEW_DISCLAIMER })
  }
}
