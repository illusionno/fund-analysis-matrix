import axios from 'axios'
import type { MarketIndexSnapshot } from '../types/market'
import { get } from './request'

export async function fetchMarketIndices(): Promise<MarketIndexSnapshot[]> {
  try {
    const { data } = await get<{ indices?: MarketIndexSnapshot[]; error?: string }>('/api/market')
    if (data.error) throw new Error(data.error)
    return data.indices ?? []
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data && typeof e.response.data === 'object') {
      const d = e.response.data as { error?: string }
      if (d.error) throw new Error(d.error)
    }
    throw e
  }
}
