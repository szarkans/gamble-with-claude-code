import { expect, test } from 'claude-code/testing'
import type { Card } from '../types'
import { deal } from './blackjack'
import { debugDeck } from './debug'
import { encode } from './raster'
import { CARD_FACE, CARD_INK, CARD_RED, blackjackFrame, cardFace, cardLayout } from './views/blackjack'

test('карты: центрирование и перекрытие сохраняют всю руку в доступной ширине', () => {
  for (const columns of [1, 13, 24, 40, 68, 90, 200]) for (const count of [1, 2, 3, 8, 12]) {
    const p = cardLayout(columns, count)
    expect(p.left).toBeGreaterThanOrEqual(0)
    expect(p.left + p.span).toBeLessThanOrEqual(columns)
    expect(Math.abs(p.left - (columns - p.left - p.span))).toBeLessThanOrEqual(1)
  }
})

test('карты: скруглённый контур, крупные масти и контрастная красная/чёрная краска', () => {
  for (const suit of ['♥', '♦', '♠', '♣'] as const) {
    const f = cardFace({ rank: 13, suit })
    expect(f.words[0]).toBe('╭'.charCodeAt(0))
    expect(f.words[(f.columns - 1) * 3]).toBe('╮'.charCodeAt(0))
    expect(f.words[(f.rows - 1) * f.columns * 3]).toBe('╰'.charCodeAt(0))
    let suitPixels = 0
    for (let y = 3; y <= 7; y++) for (let x = 9; x <= 13; x++) {
      const i = (y * f.columns + x) * 3
      if (f.words[i] === 0x2588) {
        suitPixels++
        expect(f.words[i + 1]).toBe(suit === '♥' || suit === '♦' ? CARD_RED : CARD_INK)
        expect(f.words[i + 2]).toBe(CARD_FACE)
      }
    }
    expect(suitPixels).toBeGreaterThan(4)
  }
})

test('рубашка скрывает достоинство, масть и счёт до середины переворота', () => {
  const h = deal(100, debugDeck('win'))
  const other = { ...h, dealer: [h.dealer[0]!, { rank: 1, suit: '♠' } as Card] }
  for (const width of [24, 40, 90]) {
    for (const flip of [0, 0.25, 0.49]) {
      const view = { player: 2, dealer: 2, reveal: true, flip }
      expect(encode(blackjackFrame(width, h, view))).toBe(encode(blackjackFrame(width, other, view)))
    }
    const shown = { player: 2, dealer: 2, reveal: true, flip: 1 }
    expect(encode(blackjackFrame(width, h, shown))).not.toBe(encode(blackjackFrame(width, other, shown)))
    const back = { player: 2, dealer: 2, reveal: false }
    expect(encode(blackjackFrame(width, h, back))).toBe(encode(blackjackFrame(width, other, back)))
    expect(encode(blackjackFrame(width, h, { ...back, dealerSlide: 8 }))).not.toBe(encode(blackjackFrame(width, h, back)))
  }
  expect(blackjackFrame(90, h).rows).toBeLessThan(blackjackFrame(40, h).rows)
})
