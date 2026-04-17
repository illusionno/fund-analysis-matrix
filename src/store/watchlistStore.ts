import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type InstrumentKind = 'fund' | 'stock' | 'gold'

export interface WatchItem {
  id: string
  kind: InstrumentKind
  code: string
}

const MAX_ITEMS = 20

type State = {
  items: WatchItem[]
  addFund: (code: string) => void
  addStock: (code: string) => void
  addGold: () => void
  remove: (id: string) => void
  clear: () => void
}

export const useWatchlist = create<State>()(
  persist(
    (set, get) => ({
      items: [],
      addFund(code) {
        const c = code.replace(/\D/g, '')
        if (c.length !== 6) return
        const id = `fund-${c}`
        const { items } = get()
        if (items.length >= MAX_ITEMS) return
        if (items.some((i) => i.id === id)) return
        set({ items: [...items, { id, kind: 'fund', code: c }] })
      },
      addStock(code) {
        const c = code.replace(/\D/g, '')
        if (c.length !== 6) return
        const id = `stock-${c}`
        const { items } = get()
        if (items.length >= MAX_ITEMS) return
        if (items.some((i) => i.id === id)) return
        set({ items: [...items, { id, kind: 'stock', code: c }] })
      },
      addGold() {
        const id = 'gold-XAU'
        const { items } = get()
        if (items.some((i) => i.id === id)) return
        if (items.length >= MAX_ITEMS) return
        set({ items: [...items, { id, kind: 'gold', code: 'XAU' }] })
      },
      remove(id) {
        set({ items: get().items.filter((i) => i.id !== id) })
      },
      clear() {
        set({ items: [] })
      },
    }),
    { name: 'fund-matrix-watchlist' },
  ),
)
