import axios from 'axios'
import type { QuoteSnapshot } from '../types/quote'
import { post } from './request'
export type ReviewResponse = {
  result?: unknown
  disclaimer?: string
  error?: string
}

export async function fetchAiReview(quotes: QuoteSnapshot[]): Promise<ReviewResponse> {
  try {
    const { data } = await post<ReviewResponse>('/api/review', { quotes })
    return data
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data && typeof e.response.data === 'object') {
      return e.response.data as ReviewResponse
    }
    throw e
  }
}
