import axios from 'axios'
import type { KlinePeriod } from '../types/kline'
import type { QuoteSnapshot } from '../types/quote'
import { post } from './request'

export type KlinePoint = { date: string; value: number }

type KlineApiResponse = { points?: KlinePoint[]; error?: string }

export async function fetchKline(
  kind: QuoteSnapshot['kind'],
  code: string,
  period: KlinePeriod,
): Promise<KlinePoint[]> {
  try {
    const { data } = await post<KlineApiResponse>('/api/kline', {
      kind,
      code,
      period,
    })
    if (data.error) throw new Error(data.error)
    return data.points ?? []
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data && typeof e.response.data === 'object') {
      const d = e.response.data as { error?: string }
      if (d.error) throw new Error(d.error)
    }
    throw e
  }
}
