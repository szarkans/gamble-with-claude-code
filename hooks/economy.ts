import type { Card, Hand } from './blackjack'
import { SUITS } from './blackjack'

// Результат и незаконченная рука сохраняются одной записью; утром другой ключ.
export type Day = { v: 1; net: number; hand: Hand | null }
export const balanceOf = (total: number, net: number) => Math.max(0, Math.floor(total + net))
export const stake = (balance: number, fraction: number) =>
  balance <= 0 ? 0 : fraction >= 1 ? balance : Math.max(1, Math.floor(balance * fraction))

export function dayValue(value: unknown): Day {
  const empty: Day = { v: 1, net: 0, hand: null }
  if (!value || typeof value !== 'object') return empty
  const data = value as Partial<Day>
  // Предыдущая форма отличается лишь отсутствием версии: миграция без потери кошелька.
  if (data.v !== undefined && data.v !== 1 || !Number.isSafeInteger(data.net)) return empty
  if (data.hand !== null && data.hand !== undefined && !validHand(data.hand)) return empty
  return { v: 1, net: data.net!, hand: data.hand?.status === 'done' ? null : data.hand ?? null }
}

function validHand(value: unknown): value is Hand {
  if (!value || typeof value !== 'object') return false
  const h = value as Partial<Hand>
  const cards = (value: unknown): value is Card[] => Array.isArray(value) && value.every(c =>
    c && typeof c === 'object' && Number.isInteger(c.rank) && c.rank >= 1 && c.rank <= 13 && SUITS.includes(c.suit))
  return cards(h.player) && h.player.length >= 2 && cards(h.dealer) && h.dealer.length >= 2 && cards(h.deck) &&
    Number.isSafeInteger(h.bet) && h.bet! > 0 && typeof h.doubled === 'boolean' &&
    (h.status === 'player' || h.status === 'dealer' || h.status === 'done')
}
