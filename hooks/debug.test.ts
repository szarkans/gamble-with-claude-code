import { expect, test } from 'claude-code/testing'
import { blackjackPayout, deal, dealerStep, hit, natural, score } from './blackjack'
import { debugDeck, debugEnabled, debugKey, debugRoulette, debugSlot } from './debug'
import { roulettePayout } from './roulette'
import type { RouletteBet } from './roulette'
import { payout } from './slot'

test('отладка: только GWCC_DEBUG=1 и отдельные ключи кошелька', () => {
  for (const value of [undefined, '', '0', 'true', 'yes', ' 1']) expect(debugEnabled(value)).toBe(false)
  expect(debugEnabled('1')).toBe(true)
  expect(debugKey('2026-10-02', false)).toBe('day:2026-10-02')
  expect(debugKey('2026-10-02', true)).toBe('debug:day:2026-10-02')
})

test('отладка: слот даёт джекпот, обычный выигрыш и проигрыш', () => {
  expect(payout(debugSlot('special'), 100)).toBe(5000)
  expect(payout(debugSlot('win'), 100)).toBe(500)
  expect(payout(debugSlot('lose'), 100)).toBe(0)
})

test('отладка: рулетка выигрывает или проигрывает при любой выбранной ставке', () => {
  const choices: RouletteBet[] = ['red', 'black', 'even', 'odd', 'low', 'high'].map(kind => ({ kind } as RouletteBet))
  for (const value of [1, 2, 3] as const) choices.push({ kind: 'dozen', value })
  for (let value = 0; value <= 36; value++) choices.push({ kind: 'number', value })
  for (const choice of choices) {
    expect(roulettePayout(debugRoulette(choice, 'win'), choice, 100)).toBeGreaterThan(100)
    expect(roulettePayout(debugRoulette(choice, 'lose'), choice, 100)).toBe(0)
  }
})

test('отладка: естественный блэкджек, обычная победа и перебор из полной колоды', () => {
  for (const scenario of ['special', 'win', 'lose'] as const) {
    const deck = debugDeck(scenario)
    expect(deck).toHaveLength(52)
    expect(new Set(deck.map(c => c.rank + c.suit)).size).toBe(52)
    let h = deal(100, deck)
    if (scenario === 'special') expect(natural(h.player)).toBe(true)
    if (scenario === 'win') expect(natural(h.player)).toBe(false)
    if (scenario === 'lose') { h = hit(h); expect(score(h.player)).toBeGreaterThan(21) }
    h = dealerStep(h)
    expect(h.status).toBe('done')
    expect(blackjackPayout(h)).toBe(scenario === 'special' ? 250 : scenario === 'win' ? 200 : 0)
  }
})
