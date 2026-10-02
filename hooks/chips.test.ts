import { expect, test } from 'claude-code/testing'
import type { Snapshot } from './host'
import { chipAt, chipLayout, chips } from './chips'
import { dashboardLayout } from './dashboard'
import { balancePixels, numberPixels, numberWidth } from './glyphs'
import { frame } from './raster'

const data: Snapshot = {
  earned: { total: 6930000, date: '2026-10-02', midnight: 0 }, net: 0, frac: 0.1,
  reels: [0, 1, 2], phase: 'idle', msg: '', game: 'slot',
  rouletteBet: { kind: 'red' }, rouletteNumber: 0, roulettePick: 0, hand: null,
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
  expect(wide.stats).toEqual(['TOKENS', 'burned    6.93M', 'casino    +0', 'bet       693.0K'])
  expect(wide.digits[0]!.length + wide.statWidth + 3).toBeLessThanOrEqual(wide.room)
  const compact = dashboardLayout(data, 24)
  expect(compact.sideBySide).toBe(false)
  expect(compact.digits.every(line => line.length <= compact.room)).toBe(true)
  const broke = dashboardLayout({ ...data, net: -data.earned.total }, 88)
  expect(broke.value).toBe('0')
  expect(broke.broke).toBe(true)
  expect(broke.stats).toContain('ALL OUT. Cache miss.')
  expect(broke.stats.some(line => line.includes('bet'))).toBe(false)
  expect(broke.stats.join(' ')).not.toContain(data.earned.date)
})

test('жетоны: выбор, приглушение и уникальные клавиши каждой игры', () => {
  for (const game of ['slot', 'roulette', 'blackjack'] as const) {
    const ready = chips({ ...data, game }, true).flatMap(g => g.chips)
    expect(new Set(ready.map(c => c.hotkey)).size).toBe(ready.length)
    expect(ready.filter(c => c.selected).map(c => c.key)).toEqual(
      game === 'roulette' ? ['tab-roulette', 'red', 'frac-1'] : [`tab-${game}`, 'frac-1'])
    const busy = chips({ ...data, game, phase: 'effect' }, true).flatMap(g => g.chips)
    expect(busy.filter(c => !c.disabled).map(c => c.key)).toEqual(['tab-slot', 'tab-roulette', 'tab-blackjack', 'close'])
    const broke = chips({ ...data, game, net: -data.earned.total }, false).flatMap(g => g.chips)
    expect(broke.find(c => c.hotkey === 's')?.disabled).toBe(true)
    expect(broke.filter(c => c.key.startsWith('frac-')).every(c => c.disabled)).toBe(true)
    expect(broke.some(c => c.key.startsWith('debug-'))).toBe(false)
  }
})

test('пульт: вкладки сверху, выход справа; ставка слева и действия справа на одной высоте', () => {
  const hand: NonNullable<Snapshot['hand']> = {
    player: [{ rank: 5, suit: '♠' }, { rank: 6, suit: '♥' }],
    dealer: [{ rank: 10, suit: '♦' }, { rank: 7, suit: '♣' }],
    deck: [], bet: 100, doubled: false, status: 'player',
  }
  for (const width of [64, 85, 88]) for (const game of ['slot', 'roulette', 'blackjack'] as const) {
    for (const h of game === 'blackjack' ? [null, hand] : [null]) {
      const layout = chipLayout(chips({ ...data, game, hand: h, phase: h ? 'playing' : 'idle' }, true), width)
      const stakes = layout.placed.filter(c => c.intent.kind === 'fraction')
      const actions = layout.placed.filter(c => c.primary)
      const tabs = layout.placed.filter(c => c.intent.kind === 'game')
      const exit = layout.placed.find(c => c.key === 'close')!
      expect(tabs.map(c => c.x)).toEqual([0, 8, 19])
      expect(tabs.every(c => c.y === 0)).toBe(true)
      expect(exit.x + exit.width).toBe(width)
      expect(exit.y).toBe(0)
      expect(stakes[0]!.x).toBe(0)
      expect(new Set([...stakes, ...actions].map(c => c.y)).size).toBe(1)
      expect(actions[0]!.x).toBeGreaterThan(stakes.at(-1)!.x + stakes.at(-1)!.width)
      expect(actions.at(-1)!.x + actions.at(-1)!.width).toBe(width)
      expect(actions[0]!.width).toBeGreaterThan(stakes[0]!.width)
      if (h) expect(actions.map(c => c.key)).toEqual(['hit', 'stand', 'double'])
      const rule = layout.labels.find(l => l.key === 'console-rule')!
      expect(rule.y + 2).toBe(stakes[0]!.y)
      const debug = layout.placed.filter(c => c.intent.kind === 'debug')
      expect(debug.every(c => c.lines.length === 1 && c.y > actions[0]!.y + 2)).toBe(true)
    }
  }
})

test('рулетка: пять групп, две колонки, число между минусом и плюсом над пультом', () => {
  for (const width of [68, 85, 88]) {
    const groups = chips({ ...data, game: 'roulette', roulettePick: 17 }, false)
    const layout = chipLayout(groups.filter(g => g.kind !== 'tabs'), width)
    const at = (key: string) => layout.placed.find(c => c.key === key)!
    expect(layout.labels.filter(l => l.key.startsWith('label-')).map(l => l.text))
      .toEqual(['COLOR', 'PARITY', 'RANGE', 'DOZEN', 'NUMBER'])
    expect(at('red').y).toBe(at('black').y)
    expect(at('even').y).toBe(at('red').y)
    expect(at('odd').x).toBeGreaterThan(at('black').x + at('black').width)
    expect(at('low').y).toBe(at('red').y + 3)
    expect(at('high').y).toBe(at('low').y)
    expect(at('dozen1').y).toBe(at('low').y)
    expect(at('dozen3').y).toBe(at('low').y)
    expect(at('number').y).toBe(at('low').y + 3)
    expect(at('number-prev').y).toBe(at('number').y)
    expect(at('number-next').y).toBe(at('number').y)
    expect(at('number-prev').x + at('number-prev').width).toBeLessThan(at('number').x)
    expect(at('number').x + at('number').width).toBeLessThan(at('number-next').x)
    expect(at('number').lines[1]).toContain('17')
    expect(at('red').selected).toBe(true)
    expect(at('number').selected).toBe(false)
    expect(at('frac-1').y).toBeGreaterThan(at('number').y + 2)
  }
  const narrow = chipLayout(chips({ ...data, game: 'roulette' }, false), 24)
  const red = narrow.placed.find(c => c.key === 'red')!, even = narrow.placed.find(c => c.key === 'even')!
  expect(even.y).toBeGreaterThan(red.y + 2)
})

test('раскладка: жетоны в границах, без перекрытий, клавиша на жетоне', () => {
  const hand: NonNullable<Snapshot['hand']> = {
    player: [{ rank: 5, suit: '♠' }, { rank: 6, suit: '♥' }],
    dealer: [{ rank: 10, suit: '♦' }, { rank: 7, suit: '♣' }],
    deck: [], bet: 100, doubled: false, status: 'player',
  }
  for (const width of [1, 2, 5, 12, 24, 40, 60, 64, 68, 85, 86, 87, 88, 89, 90, 200]) {
    for (const game of ['slot', 'roulette', 'blackjack'] as const) for (const h of game === 'blackjack' ? [null, hand] : [null]) {
      const layout = chipLayout(chips({ ...data, game, hand: h, phase: h ? 'playing' : 'idle' }, true), width)
      expect(layout.width).toBe(Math.min(width, 88))
      for (const c of layout.placed) {
        expect(c.x + c.width).toBeLessThanOrEqual(layout.width)
        expect(c.lines.every(line => line.length === c.width)).toBe(true)
        if (width >= 24) expect(c.lines.some(line => line.includes(c.label))).toBe(true)
        expect(c.y + c.lines.length).toBeLessThanOrEqual(layout.height)
        expect(c.lines.at(-1)).toContain(c.hotkey)
        expect(chipAt(layout.placed, c.x, c.y)?.key).toBe(c.key)
        expect(chipAt(layout.placed, c.x + c.width - 1, c.y + c.lines.length - 1)?.key).toBe(c.key)
        const others = layout.placed.filter(other => other.key !== c.key)
        expect(others.some(other => c.x < other.x + other.width && other.x < c.x + c.width &&
          c.y < other.y + other.lines.length && other.y < c.y + c.lines.length)).toBe(false)
        expect(layout.labels.some(l => c.x < l.x + l.width && l.x < c.x + c.width &&
          c.y <= l.y && l.y < c.y + c.lines.length)).toBe(false)
      }
      expect(layout.labels.every(l => l.x + l.width <= layout.width && l.y < layout.height)).toBe(true)
      expect(chipAt(layout.placed, -1, 0)).toBeUndefined()
      expect(chipAt(layout.placed, layout.width, 0)).toBeUndefined()
      expect(chipAt(layout.placed, 0, layout.height)).toBeUndefined()
    }
  }
  const layout = chipLayout(chips({ ...data, game: 'roulette' }, false), 88)
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
  expect(dashboardLayout(playing, 88).stats).toContain('in hand   6.93M')
  const controls = chips(playing, true).flatMap(g => g.chips)
  expect(controls.filter(c => !c.disabled).map(c => c.key)).toEqual(['close', 'hit', 'stand'])
  expect(controls.find(c => c.key === 'double')?.disabled).toBe(true)
})
