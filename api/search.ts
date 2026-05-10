import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const { keyword } = req.query
  if (!keyword || typeof keyword !== 'string') {
    res.status(400).json({ error: 'keyword is required' })
    return
  }

  try {
    const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(keyword)}`
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 FundMatrix/1.0" },
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    res.status(200).json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ error: msg })
  }
}
