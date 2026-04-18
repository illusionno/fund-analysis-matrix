//  ** 查询基金/股票/黄金的实时估值 **

// 引入了 Vercel Node 运行时的请求与响应类型定义。
import type { VercelRequest, VercelResponse } from '@vercel/node'
// 引入了核心业务逻辑函数 resolveQuotes 以及入参类型 QuoteItemInput。
// 作用：将“HTTP 层处理”与“业务逻辑”分离。这个文件只管接收请求、返回响应；真正的抓取、计算都在 quoteCore.ts 里。
import { type QuoteItemInput, resolveQuotes } from './lib/quoteCore.js'

// 这是 Vercel Serverless Function 的标准写法。每次有请求打到 /api/quote 时，Vercel 就会唤起（或复用）一个 Node 实例来执行这个 handler 函数。
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置跨域头 (CORS) 与预检请求 (OPTIONS)
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
      items?: QuoteItemInput[]
    }
    const items = body.items ?? []
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'items 不能为空' })
      return
    }
    if (items.length > 30) {
      res.status(400).json({ error: '单次最多 30 个标的' })
      return
    }
    // 把经过校验的 items 数组，扔给 lib/quoteCore.ts 里的 resolveQuotes 函数。
    // resolveQuotes函数会在 Node 端去并发请求东方财富/天天基金，把脏数据洗干净，返回一个标准化的 quotes 数组。
    const quotes = await resolveQuotes(items)
    // 拿到结果后，以 200 状态码返回给前端 {"quotes": [...]}。
    res.status(200).json({ quotes })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ error: msg })
  }
}
