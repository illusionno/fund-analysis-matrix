/** 带超时的 fetch，避免 Vercel 上上游挂起导致整函数超时后只返回 500 */

export class UpstreamTimeoutError extends Error {
    constructor(label: string, timeoutMs: number) {
      super(`${label}请求超时（${timeoutMs}ms）`)
      this.name = "UpstreamTimeoutError"
    }
  }
  
  export function formatFetchError(e: unknown, label: string): string {
    if (e instanceof UpstreamTimeoutError) {
      return e.message
    }
    if (e instanceof Error) {
      const cause =
        e.cause instanceof Error
          ? e.cause.message
          : typeof e.cause === "string"
            ? e.cause
            : ""
      if (cause && cause !== e.message) {
        return `${label}网络异常: ${e.message} (${cause})`
      }
      return `${label}网络异常: ${e.message}`
    }
    return `${label}请求失败: ${String(e)}`
  }
  
  export async function fetchWithTimeout(
    url: string,
    init: RequestInit = {},
    timeoutMs = 8000,
    timeoutLabel = "上游",
  ): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { ...init, signal: controller.signal })
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new UpstreamTimeoutError(timeoutLabel, timeoutMs)
      }
      throw e
    } finally {
      clearTimeout(timer)
    }
  }
  
  export async function fetchTextWithTimeout(
    url: string,
    init: RequestInit = {},
    timeoutMs = 8000,
    timeoutLabel = "上游",
  ): Promise<string> {
    const r = await fetchWithTimeout(url, init, timeoutMs, timeoutLabel)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.text()
  }
  