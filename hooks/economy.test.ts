import { expect, test } from 'claude-code/testing'
import { balanceOf, dayValue, stake } from './economy'

test('wallet: clamped balance, fractional bets and all in', () => {
  expect(balanceOf(100, -200)).toBe(0)
  expect(balanceOf(100, 50)).toBe(150)
  expect(stake(3, 0.1)).toBe(1)
  expect(stake(0, 1)).toBe(0)
  expect(stake(101, 0.25)).toBe(25)
  expect(stake(101, 0.5)).toBe(50)
  expect(stake(101, 1)).toBe(101)
})

test('кошелёк: v1, миграция предыдущей формы и безопасное чтение чужих записей', () => {
  const empty = { v: 1, net: 0, hand: null }
  expect(dayValue(undefined)).toEqual(empty)
  expect(dayValue({ net: -100, hand: null })).toEqual({ v: 1, net: -100, hand: null })
  expect(dayValue({ v: 1, net: 250, hand: null })).toEqual({ v: 1, net: 250, hand: null })
  for (const value of [null, [], 'old', { net: NaN }, { net: 0.5 }, { v: 2, net: 500 },
    { v: 1, net: 500, hand: {} }, { v: 1, net: 500, hand: { status: 'player', player: [] } }]) {
    expect(dayValue(value)).toEqual(empty)
  }
})
