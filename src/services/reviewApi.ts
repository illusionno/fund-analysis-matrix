import axios from 'axios'
import type { MarketIndexSnapshot } from '../types/market'
import type { QuoteSnapshot } from '../types/quote'
import { post } from './request'
export type ReviewResponse = {
  result?: unknown
  disclaimer?: string
  error?: string
}

function getConfigOverrides() {
  try {
    const raw = localStorage.getItem("fund-matrix-ai-config");
    if (!raw) return {};
    const j = JSON.parse(raw) as {
      state?: { apiKey?: string; apiBase?: string; model?: string };
    };
    const s = j.state ?? {};
    return {
      _apiKey: s.apiKey?.trim() || undefined,
      _apiBase: s.apiBase?.trim() || undefined,
      _model: s.model?.trim() || undefined,
    };
  } catch {
    return {};
  }
}

export async function fetchAiReview(
  quotes: QuoteSnapshot[],
  marketIndices?: MarketIndexSnapshot[],
): Promise<ReviewResponse> {
  try {
    const { data } = await post<ReviewResponse>('/api/review', {
      quotes,
      marketIndices,
      ...getConfigOverrides(),
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

/** 大盘 AI 分析：API 内部自行拉取最新指数数据，前端无需传入 */
export async function fetchAiMarketAnalysis(): Promise<ReviewResponse> {
  try {
    const { data } = await post<ReviewResponse>('/api/marketAnalysis', {
      ...getConfigOverrides(),
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
