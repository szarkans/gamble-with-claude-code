import { expect, test } from 'claude-code/testing'
import type { Effect } from './effects'
import { FRAME_MS, banner, effectCount, effectDuration, effectFrame, strength } from './effects'
import { decode, encode, frame } from './raster'
import { slotFrame } from './views/slot'
import { rouletteFrame } from './views/roulette'
import { blackjackFrame } from './views/blackjack'

test('effects: deterministic rand, preserved source, exact final frame and stronger jackpot', () => {
  const base = slotFrame(64, [0, 0, 0]), original = encode(base)
  const win: Effect = { banner: 'WIN', won: 50, bet: 100 }
  const jackpot: Effect = { banner: 'JACKPOT', won: 4900, bet: 100 }
  expect(encode(effectFrame(base, win, 160, () => 0.5))).toBe(encode(effectFrame(base, win, 160, () => 0.5)))
  expect(encode(base)).toBe(original)
  expect(strength(jackpot)).toBeGreaterThan(strength(win))
  expect(effectDuration(jackpot)).toBeGreaterThan(effectDuration(win))
  expect(strength(jackpot)).toBeGreaterThan(strength({ banner: 'WIN', won: 400, bet: 100 }))
  expect(effectDuration(jackpot)).toBeGreaterThan(effectDuration({ banner: 'WIN', won: 400, bet: 100 }))
  expect(encode(effectFrame(base, win, effectDuration(win), () => 0))).toBe(original)
  expect(FRAME_MS).toBeGreaterThanOrEqual(1000 / 120)
})

test('effects: loss lasts under a second; banners occupy five rows', () => {
  expect(effectDuration({ banner: 'BUST', won: -100, bet: 100 })).toBeLessThanOrEqual(1000)
  for (const name of ['WIN', 'JACKPOT', 'BLACKJACK', 'BUST'] as const) {
    const f = frame(64)
    banner(f, name, 2)
    for (let y = 2; y < 7; y++) {
      expect(Array.from(f.words.slice(y * 64 * 3, (y + 1) * 64 * 3)).includes(0x2588)).toBe(true)
    }
  }
})

test('frames: compact widths, valid BMP glyphs and little-endian triplets', () => {
  for (const width of [1, 18, 32, 40, 64, 68, 90, 200]) for (const base of [
    slotFrame(width, [4, 4, 4]), rouletteFrame(width, 36, { kind: 'number', value: 36 }), blackjackFrame(width, null),
  ]) {
    for (const f of [base, effectFrame(base, { banner: 'BLACKJACK', won: 150, bet: 100 }, 280, () => 0.99)]) {
      const packed = encode(f)
      expect(Uint8Array.fromBase64(packed).length).toBe(width * f.rows * 12)
      expect(Array.from(decode(width, f.rows, packed).words)).toEqual(Array.from(f.words))
      for (let i = 0; i < f.words.length; i += 3) {
        expect(f.words[i]).toBeGreaterThanOrEqual(32)
        expect(f.words[i]).toBeLessThanOrEqual(0xffff)
      }
    }
  }
})

test('победа видна несколько секунд; счётчик докручивается и держит точную сумму', () => {
  for (const e of [
    { banner: 'WIN', won: 400, bet: 100 }, { banner: 'JACKPOT', won: 4900, bet: 100 },
    { banner: 'BLACKJACK', won: 150, bet: 100 },
  ] as const) {
    const duration = effectDuration(e)
    expect(duration).toBeGreaterThanOrEqual(2600)
    expect(effectCount(e, 0)).toBe(0)
    let before = 0
    for (let t = 0; t <= duration; t += FRAME_MS) {
      const count = effectCount(e, t)
      expect(count).toBeGreaterThanOrEqual(before)
      expect(count).toBeLessThanOrEqual(e.won)
      before = count
    }
    expect(effectCount(e, duration - 800)).toBe(e.won)
    expect(effectCount(e, duration - FRAME_MS)).toBe(e.won)
    const base = slotFrame(90, [2, 2, 2])
    expect(encode(effectFrame(base, e, 1600, () => 0.2))).not.toBe(encode(base))
    expect(encode(effectFrame(base, e, duration - 400, () => 0.2))).not.toBe(encode(base))
  }
})

test('салют остаётся виден по сторонам баннера до конца победного эффекта', () => {
  const base = slotFrame(90, [4, 4, 4]), e: Effect = { banner: 'JACKPOT', won: 4900, bet: 100 }
  for (const t of [400, 1600, effectDuration(e) - 400]) {
    let i = 0
    const f = effectFrame(base, e, t, () => (++i * 0.61803398875) % 1)
    const particles = Array.from(f.words).filter((word, i) => i % 3 === 0 && [0xb7, 0x2726, 0x24, 0x2a].includes(word))
    expect(particles.length).toBeGreaterThan(8)
  }
})
