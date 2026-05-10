import { get } from './request'

export type SearchResultItem = {
  CODE: string
  NAME: string
  CATEGORYDESC: string
}

export async function fetchSearch(keyword: string): Promise<SearchResultItem[]> {
  try {
    const { data } = await get<{ Datas?: SearchResultItem[]; error?: string }>('/api/search', {
      keyword,
    })

    if (data.error) throw new Error(data.error)
    return data.Datas ?? []
  } catch (e) {
    console.error('Search failed:', e)
    return []
  }
}
