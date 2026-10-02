import { expect, test } from 'claude-code/testing'
import type { Card, Hand } from './blackjack'
import { blackjackPayout, canDouble, deal, dealerShouldHit, dealerStep, doubleDown, hit, natural, score, shuffledDeck } from './blackjack'

const cards = (...ranks: number[]): Card[] => ranks.map(rank => ({ rank, suit: '♠' }))
const hand = (player: number[], dealer: number[], bet = 100): Hand => ({
  player: cards(...player), dealer: cards(...dealer), deck: cards(10, 6, 5), bet, status: 'player', doubled: false,
})

test('21: several aces, face cards, soft totals and natural', () => {
  expect(score(cards(1, 1, 9))).toBe(21)
  expect(score(cards(1, 1, 1, 9))).toBe(12)
  expect(score(cards(1, 6))).toBe(17)
  expect(score(cards(13, 12, 11))).toBe(30)
  expect(natural(cards(1, 13))).toBe(true)
  expect(natural(cards(1, 5, 5))).toBe(false)
})

test('21: dealer stands on hard and soft 17, draws below 17, stops on bust', () => {
  expect(dealerShouldHit(cards(1, 6))).toBe(false)
  expect(dealerShouldHit(cards(10, 7))).toBe(false)
  expect(dealerShouldHit(cards(1, 5))).toBe(true)
  expect(dealerStep(hand([10, 9], [10, 6])).dealer).toEqual(cards(10, 6, 10))
  expect(dealerStep(hand([10, 9], [1, 6])).status).toBe('done')
  expect(dealerStep(hand([10, 10, 5], [6])).dealer).toEqual(cards(6))
})

test('21: wins, pushes, bust, natural 3:2 and integer rounding', () => {
  expect(blackjackPayout(hand([1, 13], [10, 9]))).toBe(250)
  expect(blackjackPayout(hand([1, 13], [1, 10]))).toBe(100)
  expect(blackjackPayout(hand([10, 5, 6], [1, 10]))).toBe(0)
  expect(blackjackPayout(hand([10, 9], [10, 8]))).toBe(200)
  expect(blackjackPayout(hand([10, 8], [10, 8]))).toBe(100)
  expect(blackjackPayout(hand([10, 5], [10, 6, 10]))).toBe(200)
  expect(blackjackPayout(hand([10, 10, 2], [10, 6, 10]))).toBe(0)
  expect(blackjackPayout(hand([1, 13], [10, 9], 3))).toBe(7)
})

test('21: double reserves one more bet, draws once and ends player turn', () => {
  const h = hand([5, 6], [10, 7])
  expect(canDouble(h, 99)).toBe(false)
  expect(canDouble(h, 100)).toBe(true)
  const next = doubleDown(h, 100)
  expect(next.bet).toBe(200)
  expect(next.player).toEqual(cards(5, 6, 10))
  expect(next.status).toBe('dealer')
  expect(next.deck).toHaveLength(h.deck.length - 1)
  expect(canDouble(next, 1000)).toBe(false)
  expect(blackjackPayout(next)).toBe(400)
  expect(() => doubleDown(h, 99)).toThrow('недоступен')
  expect(canDouble(hit(hand([2, 3], [10, 7])), 1000)).toBe(false)
  expect(h.bet).toBe(100)
})

test('21: shuffle produces 52 unique cards; deal alternates; hit ends at 21', () => {
  const deck = shuffledDeck(() => 0.5)
  expect(new Set(deck.map(c => c.rank + c.suit)).size).toBe(52)
  const h = deal(100, cards(5, 10, 6, 7, 10))
  expect(h.player).toEqual(cards(5, 6))
  expect(h.dealer).toEqual(cards(10, 7))
  expect(hit(h).status).toBe('dealer')
  expect(hit({ ...h, status: 'done' })).toEqual({ ...h, status: 'done' })
})
