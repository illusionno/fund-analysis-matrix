import axios from 'axios'
import type { MarketIndexSnapshot } from '../types/market'
import type { QuoteSnapshot } from '../types/quote'
import { post } from './request'
export type ReviewResponse = {
  result?: unknown
  disclaimer?: string
  error?: string
}

export async function fetchAiReview(
  quotes: QuoteSnapshot[],
  marketIndices?: MarketIndexSnapshot[],
): Promise<ReviewResponse> {
  try {
    const { data } = await post<ReviewResponse>('/api/review', {
      quotes,
      marketIndices,
    })
    return data
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data && typeof e.response.data === 'object') {
      return e.response.data as ReviewResponse
    }
    if (axios.isAxiosError(e)) {
      const status = e.response?.status
      const detail =
        typeof e.response?.data === 'object' &&
        e.response.data !== null &&
        'error' in e.response.data &&
        typeof (e.response.data as { error?: unknown }).error === 'string'
          ? (e.response.data as { error: string }).error
          : e.message
      return {
        error: status ? `请求失败 (${status}): ${detail}` : detail,
      }
    }
    throw e
  }
}

export async function fetchAiMarketAnalysis(
  marketIndices?: MarketIndexSnapshot[],
): Promise<ReviewResponse> {
  try {
    const { data } = await post<ReviewResponse>('/api/marketAnalysis', {
      marketIndices,
    })
    return data
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data && typeof e.response.data === 'object') {
      return e.response.data as ReviewResponse
    }
    if (axios.isAxiosError(e)) {
      const status = e.response?.status
      const detail =
        typeof e.response?.data === 'object' &&
        e.response.data !== null &&
        'error' in e.response.data &&
        typeof (e.response.data as { error?: unknown }).error === 'string'
          ? (e.response.data as { error: string }).error
          : e.message
      return {
        error: status ? `请求失败 (${status}): ${detail}` : detail,
      }
    }
    throw e
  }
}
