import axios from 'axios'
import type { QuoteItemInput, QuoteSnapshot } from '../types/quote'
import { post } from './request'

export async function fetchQuotes(items: QuoteItemInput[]): Promise<QuoteSnapshot[]> {
  try {
    const { data } = await post<{ quotes?: QuoteSnapshot[]; error?: string }>('/api/quote', {
      items,
    })

    if (data.error) throw new Error(data.error)
    return data.quotes ?? []
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data && typeof e.response.data === 'object') {
      const d = e.response.data as { error?: string }
      if (d.error) throw new Error(d.error)
    }
    throw e
  }
}
