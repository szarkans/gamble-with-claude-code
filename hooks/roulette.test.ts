import { expect, test } from 'claude-code/testing'
import { ROULETTE_MS, WHEEL, roulettePayout, rouletteResult, wheelIndex, wheelPosition } from './roulette'
import { POCKET_BG, POCKET_WIDTH, ribbonLayout, rouletteFrame } from './views/roulette'
import { encode } from './raster'
import type { RouletteBet } from './roulette'

test('roulette: zero loses all outside bets; exact number pays 35:1 plus stake', () => {
  const outside: RouletteBet[] = ['red', 'black', 'even', 'odd', 'low', 'high'].map(kind => ({ kind } as RouletteBet))
  outside.push({ kind: 'dozen', value: 1 }, { kind: 'dozen', value: 2 }, { kind: 'dozen', value: 3 })
  for (const bet of outside) expect(roulettePayout(0, bet, 100)).toBe(0)
  expect(roulettePayout(0, { kind: 'number', value: 0 }, 100)).toBe(3600)
  expect(roulettePayout(36, { kind: 'number', value: 36 }, 100)).toBe(3600)
  expect(roulettePayout(35, { kind: 'number', value: 36 }, 100)).toBe(0)
})

test('лента: непрерывный ход, замедление и точная остановка всех 37 карманов', () => {
  for (const n of WHEEL) {
    const samples = Array.from({ length: 8 }, (_, i) => wheelPosition(n, i * ROULETTE_MS / 7))
    const steps = samples.slice(1).map((p, i) => p - samples[i]!)
    steps.forEach((d, i) => {
      expect(d).toBeGreaterThanOrEqual(0)
      if (i > 0) expect(d).toBeLessThan(steps[i - 1]!)
    })
    for (const width of [18, 40, 90, 200]) {
      const final = ribbonLayout(width, wheelPosition(n, ROULETTE_MS))
      const middle = final.find(c => c.x + Math.floor(POCKET_WIDTH / 2) === Math.floor(width / 2))
      expect(middle?.number).toBe(n)
      expect(final.map(c => c.index)).toEqual(final.map((c, i) => final[0]!.index + i))
    }
  }
  const a = ribbonLayout(90, 10.2), b = ribbonLayout(90, 10.7)
  expect(a.map(c => c.number)).toEqual(b.map(c => c.number))
  a.forEach((c, i) => expect(c.x - b[i]!.x).toBe(6))
})

test('рулетка: цветные крупные ячейки, фиксированный маркер и пульс результата', () => {
  const a = rouletteFrame(90, 0, { kind: 'red' }, 0), b = rouletteFrame(90, 0, { kind: 'red' }, 0.5)
  expect(a.words[(1 * 90 + 45) * 3]).toBe('▼'.charCodeAt(0))
  expect(b.words[(1 * 90 + 45) * 3]).toBe('▼'.charCodeAt(0))
  const backgrounds = new Set(Array.from(a.words).filter((_, i) => i % 3 === 2))
  for (const bg of Object.values(POCKET_BG)) expect(backgrounds.has(bg)).toBe(true)
  for (let y = 3; y < 8; y++) expect(Array.from(a.words.slice(y * 90 * 3, (y + 1) * 90 * 3)).includes(0x2588)).toBe(true)
  expect(encode(a)).not.toBe(encode(b))
  expect(encode(rouletteFrame(90, 32, { kind: 'red' }, undefined, 0))).not.toBe(
    encode(rouletteFrame(90, 32, { kind: 'red' }, undefined, 180)))
})

test('roulette: colour, parity, ranges and dozen boundaries', () => {
  expect(roulettePayout(32, { kind: 'red' }, 7)).toBe(14)
  expect(roulettePayout(32, { kind: 'black' }, 7)).toBe(0)
  expect(roulettePayout(15, { kind: 'black' }, 7)).toBe(14)
  expect(roulettePayout(36, { kind: 'even' }, 7)).toBe(14)
  expect(roulettePayout(1, { kind: 'odd' }, 7)).toBe(14)
  expect(roulettePayout(18, { kind: 'low' }, 7)).toBe(14)
  expect(roulettePayout(19, { kind: 'low' }, 7)).toBe(0)
  expect(roulettePayout(19, { kind: 'high' }, 7)).toBe(14)
  for (const value of [1, 2, 3] as const) {
    const bet = { kind: 'dozen' as const, value }
    expect(roulettePayout(value * 12, bet, 7)).toBe(21)
    expect(roulettePayout((value - 1) * 12 + 1, bet, 7)).toBe(21)
    expect(Array.from({ length: 37 }, (_, n) => roulettePayout(n, bet, 1)).filter(Boolean)).toHaveLength(12)
  }
  for (const kind of ['red', 'black', 'even', 'odd', 'low', 'high'] as const) {
    expect(Array.from({ length: 37 }, (_, n) => roulettePayout(n, { kind }, 1)).filter(Boolean)).toHaveLength(18)
  }
})

test('roulette: wheel has all 37 pockets; animation lands on each result', () => {
  expect(new Set(WHEEL).size).toBe(37)
  expect(rouletteResult(() => 0)).toBe(0)
  expect(rouletteResult(() => 0.99999)).toBe(36)
  for (const n of WHEEL) expect(WHEEL[wheelIndex(n, ROULETTE_MS)]).toBe(n)
  expect(wheelIndex(0, 0)).toBe(0)
})
