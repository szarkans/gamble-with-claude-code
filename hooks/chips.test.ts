import { expect, test } from 'claude-code/testing'
import type { Snapshot } from './host'
import { chipAt, chipLayout, chips } from './chips'
import { dashboardLayout } from './dashboard'
import { balancePixels, numberPixels, numberWidth } from './glyphs'
import { frame } from './raster'

const data: Snapshot = {
  earned: { total: 6930000, date: '2026-10-02', midnight: 0 }, net: 0, frac: 0.1,
  reels: [0, 1, 2], phase: 'idle', msg: '', game: 'slot',
  rouletteBet: { kind: 'red' }, rouletteNumber: 0, hand: null,
}

test('табло: цифры совпадают с пиксельным шрифтом рулетки в обоих масштабах', () => {
  for (const scale of [1, 2]) {
    const f = frame(numberWidth(1234567890, scale), 5)
    numberPixels(f, 0, 0, 1234567890, 0xffffff, scale)
    const lines = Array.from({ length: 5 }, (_, y) => Array.from({ length: f.columns }, (_, x) =>
      String.fromCharCode(f.words[(y * f.columns + x) * 3]!)).join(''))
    expect(balancePixels('1234567890', scale)).toEqual(lines)
  }
  expect(balancePixels('6.93M')).toHaveLength(5)
  expect(balancePixels('10.0K')[4]).toContain('█')
})

test('табло: статистика рядом, компактный вид, банкрот без нулевой ставки', () => {
  const wide = dashboardLayout(data, 88)
  expect(wide.sideBySide).toBe(true)
  expect(wide.stats).toEqual(['ФИШКИ', 'сожжено   6.93M', 'в казино  +0', 'ставка    693.0K'])
  expect(wide.digits[0]!.length + wide.statWidth + 3).toBeLessThanOrEqual(wide.room)
  const compact = dashboardLayout(data, 24)
  expect(compact.sideBySide).toBe(false)
  expect(compact.digits.every(line => line.length <= compact.room)).toBe(true)
  const broke = dashboardLayout({ ...data, net: -data.earned.total }, 88)
  expect(broke.value).toBe('0')
  expect(broke.broke).toBe(true)
  expect(broke.stats).toContain('ALL OUT. Кэш пуст.')
  expect(broke.stats.some(line => line.includes('ставка'))).toBe(false)
  expect(broke.stats.join(' ')).not.toContain(data.earned.date)
})

test('жетоны: выбор, приглушение и уникальные клавиши каждой игры', () => {
  for (const game of ['slot', 'roulette', 'blackjack'] as const) {
    const ready = chips({ ...data, game }, true).flat()
    expect(new Set(ready.map(c => c.hotkey)).size).toBe(ready.length)
    expect(ready.filter(c => c.selected).map(c => c.key)).toEqual(
      game === 'roulette' ? ['tab-roulette', 'frac-1', 'red'] : [`tab-${game}`, 'frac-1'])
    const busy = chips({ ...data, game, phase: 'effect' }, true).flat()
    expect(busy.filter(c => !c.disabled).map(c => c.key)).toEqual(['close'])
    const broke = chips({ ...data, game, net: -data.earned.total }, false).flat()
    expect(broke.find(c => c.hotkey === 's')?.disabled).toBe(true)
    expect(broke.filter(c => c.key.startsWith('frac-')).every(c => c.disabled)).toBe(true)
    expect(broke.some(c => c.key.startsWith('debug-'))).toBe(false)
  }
})

test('раскладка: жетоны в границах, без перекрытий, клавиша на жетоне', () => {
  for (const width of [1, 2, 5, 12, 24, 40, 60, 88, 200]) {
    for (const game of ['slot', 'roulette', 'blackjack'] as const) {
      const layout = chipLayout(chips({ ...data, game }, true), width)
      expect(layout.width).toBe(Math.min(width, 88))
      for (const c of layout.placed) {
        expect(c.x + c.width).toBeLessThanOrEqual(layout.width)
        expect(c.lines.every(line => line.length === c.width)).toBe(true)
        expect(c.y + c.lines.length).toBeLessThanOrEqual(layout.height)
        expect(c.lines.at(-1)).toContain(c.hotkey)
        expect(chipAt(layout.placed, c.x, c.y)?.key).toBe(c.key)
        expect(chipAt(layout.placed, c.x + c.width - 1, c.y + c.lines.length - 1)?.key).toBe(c.key)
      }
      expect(chipAt(layout.placed, -1, 0)).toBeUndefined()
      expect(chipAt(layout.placed, layout.width, 0)).toBeUndefined()
      expect(chipAt(layout.placed, 0, layout.height)).toBeUndefined()
    }
  }
  const layout = chipLayout(chips({ ...data, game: 'roulette' }, false), 88)
  const table = layout.placed.filter(c => c.intent.kind === 'roulette')
  expect(new Set(table.map(c => c.y)).size).toBe(1)
  expect(layout.placed.find(c => c.key === 'frac-1')?.lines[0]).toBe('┏━━━┓')
  expect(layout.placed.find(c => c.key === 'frac-2')?.lines[0]).toBe('╭───╮')
  expect(layout.placed.find(c => c.key === 'roll')?.lines[0]).toContain('╔')
})

test('21: зарезервированный ALL не объявляет банкротство; ЕЩЁ и ХВАТИТ доступны', () => {
  const hand: NonNullable<Snapshot['hand']> = {
    player: [{ rank: 5, suit: '♠' }, { rank: 6, suit: '♥' }],
    dealer: [{ rank: 10, suit: '♦' }, { rank: 7, suit: '♣' }],
    deck: [{ rank: 10, suit: '♠' }], bet: data.earned.total, doubled: false, status: 'player',
  }
  const playing = { ...data, game: 'blackjack' as const, net: -data.earned.total, hand, phase: 'playing' as const }
  expect(dashboardLayout(playing, 88).broke).toBe(false)
  expect(dashboardLayout(playing, 88).stats).toContain('в руке    6.93M')
  const controls = chips(playing, true).flat()
  expect(controls.filter(c => !c.disabled).map(c => c.key)).toEqual(['close', 'hit', 'stand'])
  expect(controls.find(c => c.key === 'double')?.disabled).toBe(true)
})
