// Европейское колесо: зеро проигрывает всем внешним ставкам.
export const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26] as const
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
import type { RouletteBet } from '../types'
export type { RouletteBet } from '../types'

export function color(n: number): 'red' | 'black' | 'green' {
  return n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black'
}

export function roulettePayout(n: number, choice: RouletteBet, bet: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 36 || bet <= 0) return 0
  if (choice.kind === 'number') return choice.value === n ? bet * 36 : 0
  if (n === 0) return 0
  if (choice.kind === 'dozen') return Math.ceil(n / 12) === choice.value ? bet * 3 : 0
  const wins = {
    red: color(n) === 'red', black: color(n) === 'black',
    even: n % 2 === 0, odd: n % 2 === 1, low: n <= 18, high: n >= 19,
  }
  return wins[choice.kind] ? bet * 2 : 0
}

export function rouletteResult(rand: () => number): number {
  return Math.floor(rand() * 37)
}

export const ROULETTE_MS = 2800
// Непрерывная координата ленты: два оборота и кубическое торможение.
export function wheelPosition(n: number, elapsed: number): number {
  const p = Math.min(1, Math.max(0, elapsed / ROULETTE_MS))
  const target = WHEEL.indexOf(n as typeof WHEEL[number])
  return (74 + target) * (1 - (1 - p) ** 3)
}

export const wheelIndex = (n: number, elapsed: number) => Math.floor(wheelPosition(n, elapsed)) % 37

export function betLabel(choice: RouletteBet): string {
  if (choice.kind === 'number') return `Number ${choice.value} · 35:1`
  if (choice.kind === 'dozen') return `${(choice.value - 1) * 12 + 1}–${choice.value * 12} · 2:1`
  return { red: 'Red', black: 'Black', even: 'Even', odd: 'Odd', low: '1–18', high: '19–36' }[choice.kind] + ' · 1:1'
}
