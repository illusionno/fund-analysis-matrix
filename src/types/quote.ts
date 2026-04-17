export type QuoteItemInput = { kind: 'fund' | 'stock' | 'gold'; code: string }

export type QuoteSnapshot = {
  id: string
  kind: 'fund' | 'stock' | 'gold'
  code: string
  name: string
  price: number
  changePctDay: number
  changePctWeek: number | null
  asOf: string
}
