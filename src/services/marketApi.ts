import axios from 'axios'
import type { MarketIndexSnapshot } from '../types/market'
import { get } from './request'

export type MarketResult = {
  indices: MarketIndexSnapshot[]
  warning?: string
}

export async function fetchMarketIndices(): Promise<MarketResult> {
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
    return { indices: data.indices ?? [], warning: data.warning }
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data && typeof e.response.data === 'object') {
      const d = e.response.data as { error?: string; warning?: string; indices?: MarketIndexSnapshot[] }
      if (Array.isArray(d.indices)) return { indices: d.indices, warning: d.warning }
      if (d.error) throw new Error(d.error)
    }
    throw e
  }
}
