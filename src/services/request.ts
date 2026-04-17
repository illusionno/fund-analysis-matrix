import axios from 'axios'

export const get = <T = unknown>(url: string, params?: object) =>
  axios.get<T>(url, { params })

export const post = <T = unknown>(url: string, data?: unknown) => axios.post<T>(url, data)

export const postWithUrlParams = <T = unknown>(url: string, params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.append(key, String(value))
  }
  const q = search.toString()
  const fullUrl = q ? `${url}?${q}` : url
  return axios.post<T>(fullUrl, null)
}

export const put = <T = unknown>(url: string, data?: unknown) => axios.put<T>(url, data)

export const del = <T = unknown>(url: string, params?: object) =>
  axios.delete<T>(url, { data: params })
