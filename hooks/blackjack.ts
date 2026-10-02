// Одна колода на руку. Дилер стоит и на мягких 17; split и страховки нет.
export const SUITS = ['♠', '♥', '♦', '♣'] as const
import type { Card, Hand } from '../types'
export type { Card, Hand } from '../types'

export function score(cards: readonly Card[]): number {
  let total = 0, aces = 0
  for (const card of cards) {
    total += card.rank === 1 ? 11 : Math.min(card.rank, 10)
    if (card.rank === 1) aces++
  }
  while (total > 21 && aces-- > 0) total -= 10
  return total
}

export const natural = (cards: readonly Card[]) => cards.length === 2 && score(cards) === 21
export const dealerShouldHit = (cards: readonly Card[]) => score(cards) < 17
export const canDouble = (hand: Hand, balance: number) =>
  hand.status === 'player' && hand.player.length === 2 && !hand.doubled && balance >= hand.bet

export function shuffledDeck(rand: () => number): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (let rank = 1; rank <= 13; rank++) deck.push({ rank, suit })
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j]!, deck[i]!]
  }
  return deck
}

export function deal(bet: number, deck: readonly Card[]): Hand {
  if (deck.length < 4) throw new Error('Deck is empty')
  return {
    player: [deck[0]!, deck[2]!], dealer: [deck[1]!, deck[3]!], deck: deck.slice(4),
    bet, doubled: false, status: 'player',
  }
}

export function hit(hand: Hand): Hand {
  if (hand.status !== 'player') return hand
  const card = hand.deck[0]
  if (!card) throw new Error('Deck is empty')
  const player = [...hand.player, card]
  return { ...hand, player, deck: hand.deck.slice(1), status: score(player) >= 21 ? 'dealer' : 'player' }
}

export function doubleDown(hand: Hand, balance: number): Hand {
  if (!canDouble(hand, balance)) throw new Error('Double unavailable')
  const drawn = hit(hand)
  return { ...drawn, bet: hand.bet * 2, doubled: true, status: 'dealer' }
}

export function dealerStep(hand: Hand): Hand {
  if (!dealerShouldHit(hand.dealer) || score(hand.player) > 21 || natural(hand.player) || natural(hand.dealer)) {
    return { ...hand, status: 'done' }
  }
  const card = hand.deck[0]
  if (!card) throw new Error('Deck is empty')
  return { ...hand, dealer: [...hand.dealer, card], deck: hand.deck.slice(1), status: 'dealer' }
}

export function blackjackPayout(hand: Hand): number {
  const p = score(hand.player), d = score(hand.dealer)
  if (p > 21) return 0
  if (natural(hand.dealer)) return natural(hand.player) ? hand.bet : 0
  if (natural(hand.player) && !hand.doubled) return Math.floor(hand.bet * 2.5)
  if (d > 21 || p > d) return hand.bet * 2
  return p === d ? hand.bet : 0
}

export function rankLabel(card: Card): string {
  return ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' } as Record<number, string>)[card.rank] ?? String(card.rank)
}
