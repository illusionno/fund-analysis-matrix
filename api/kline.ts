import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchKlineSeries } from './lib/klineSeries'

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
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as {
      kind?: string
      code?: string
      period?: string
    }
    const kind = body.kind as 'fund' | 'stock' | 'gold' | undefined
    const code = body.code ?? ''
    const periodRaw = body.period ?? 'month'
    const period =
      periodRaw === 'week' || periodRaw === 'month' || periodRaw === 'year' ? periodRaw : 'month'
    if (kind !== 'fund' && kind !== 'stock' && kind !== 'gold') {
      res.status(400).json({ error: 'kind 须为 fund | stock | gold' })
      return
    }
    const points = await fetchKlineSeries(kind, code, period)
    res.status(200).json({ points })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ error: msg })
  }
}
