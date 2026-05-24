import axios from 'axios'
import type { MarketIndexSnapshot } from '../types/market'
import { get } from './request'

export async function fetchMarketIndices(): Promise<MarketIndexSnapshot[]> {
  try {
    const { data } = await get<{
      indices?: MarketIndexSnapshot[]
      warning?: string
      error?: string
    }>('/api/market')
    if (data.error) throw new Error(data.error)
    if (data.warning) {
      console.warn('[market]', data.warning)
    }
    return data.indices ?? []
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data && typeof e.response.data === 'object') {
      const d = e.response.data as { error?: string; warning?: string; indices?: MarketIndexSnapshot[] }
      if (Array.isArray(d.indices)) return d.indices
      if (d.warning) {
        console.warn('[market]', d.warning)
        return d.indices ?? []
      }
      if (d.error) throw new Error(d.error)
    }
    throw e
  }
}
