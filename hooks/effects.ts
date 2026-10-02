import { BG, FG, GOLD, RED, center, frame, put, stamp, text } from './raster'
import type { Frame } from './raster'
import { numberPixels, numberWidth } from './glyphs'

// API принимает до 120 blit/с и показывает около 60. Нам хватает 25 кадров/с.
export const FRAME_MS = 40
export type Banner = 'WIN' | 'JACKPOT' | 'BLACKJACK' | 'BUST' | 'LOSE'
export type Effect = { banner: Banner; won: number; bet: number }
const FONT: Record<string, string[]> = {
  W: ['# #', '# #', '# #', '###', '# #'], I: ['###', ' # ', ' # ', ' # ', '###'],
  N: ['# #', '###', '###', '###', '# #'], J: ['  #', '  #', '  #', '# #', '###'],
  A: [' # ', '# #', '###', '# #', '# #'], C: ['###', '#  ', '#  ', '#  ', '###'],
  K: ['# #', '## ', '#  ', '## ', '# #'], P: ['## ', '# #', '## ', '#  ', '#  '],
  O: ['###', '# #', '# #', '# #', '###'], T: ['###', ' # ', ' # ', ' # ', ' # '],
  B: ['## ', '# #', '## ', '# #', '## '], L: ['#  ', '#  ', '#  ', '#  ', '###'],
  U: ['# #', '# #', '# #', '# #', '###'], S: ['###', '#  ', '###', '  #', '###'],
  E: ['###', '#  ', '###', '#  ', '###'],
}

export function banner(f: Frame, label: Banner, y: number, fg = GOLD, bg = BG) {
  const width = label.length * 4 - 1
  if (width > f.columns) { center(f, y + 2, label, fg, bg); return }
  const left = Math.floor((f.columns - width) / 2)
  Array.from(label).forEach((letter, i) => {
    FONT[letter]!.forEach((row, dy) => Array.from(row).forEach((c, dx) => {
      put(f, left + i * 4 + dx, y + dy, c === '#' ? '█' : ' ', fg, bg)
    }))
  })
}

export const strength = (e: Effect) => Math.min(3, Math.max(
  e.banner === 'JACKPOT' ? 3 : e.banner === 'BLACKJACK' ? 2 : 1,
  Math.ceil(Math.log2(1 + Math.max(0, e.won) / Math.max(1, e.bet)) / 2)))
export const effectDuration = (e: Effect) => e.won <= 0 ? 720 : 2000 + strength(e) * 600
export function effectCount(e: Effect, elapsed: number) {
  const p = Math.min(1, Math.max(0, elapsed / (effectDuration(e) - (e.won > 0 ? 800 : 160))))
  return Math.floor(Math.abs(e.won) * (1 - (1 - p) ** 3))
}

export function effectFrame(base: Frame, e: Effect, elapsed: number, rand: () => number): Frame {
  if (elapsed >= effectDuration(e)) return base
  const tick = Math.floor(elapsed / FRAME_MS), level = strength(e)
  const win = e.won > 0
  const pulse = win && (elapsed < 1000 ? tick % 9 < 4 : tick % 18 < 3)
  const bg = pulse ? 0x4d421b : BG
  const out = frame(base.columns, base.rows, bg)
  const shake = elapsed < (win ? 800 + level * 160 : 200) ? (tick % 2 ? 1 : -1) * (level === 3 ? 3 : 2) : 0
  stamp(out, base, shake, elapsed < 640 && win ? tick % 3 - 1 : 0)
  if (win) {
    // Цветов немного: палитра Raster ограничена 1024 парами.
    for (let i = 2; i < out.words.length; i += 3) if (out.words[i] === BG || out.words[i] === 0x01000000) out.words[i] = bg
    for (let i = 0; i < 32 * level; i++) {
      const x = Math.floor(rand() * out.columns)
      const origin = rand() * out.rows
      const y = (origin + tick * (i % 2 ? 0.3 : -0.4) + out.rows * 8) % out.rows
      put(out, x, y, ['*', '+', '·', '✦', '$'][i % 5]!, [GOLD, 0x67efac, 0x80dfff][i % 3]!)
    }
  } else {
    for (let i = 1; i < out.words.length; i += 3) {
      out.words[i] = MUTED_LOSS
      out.words[i + 1] = 0x090d15
    }
    if (elapsed < 240) for (let i = 0; i < 14; i++) {
      put(out, rand() * out.columns, rand() * out.rows, ['/', '#', '?'][i % 3]!, RED)
    }
  }
  // Баннер и счётчик остаются читаемыми поверх салюта.
  const clear = (top: number, rows: number, width: number) => {
    const room = Math.min(out.columns, width + 4), x = Math.floor((out.columns - room) / 2)
    for (let y = top; y < top + rows; y++) text(out, x, y, ' '.repeat(room), FG, bg)
  }
  const bannerWidth = e.banner.length * 4 - 1
  clear(2, 6, bannerWidth <= out.columns ? bannerWidth : e.banner.length)
  banner(out, e.banner, 2, win ? GOLD : RED, bg)
  const count = effectCount(e, elapsed)
  const label = `${win ? '+' : '−'}${count} токенов`
  clear(8, 1, label.length)
  center(out, 8, label, win ? GOLD : RED, bg)
  if (win) {
    const scale = numberWidth(count, 2) <= out.columns ? 2 : 1
    clear(9, 5, numberWidth(count, scale))
    if (numberWidth(count, scale) <= out.columns) numberPixels(out, Math.floor((out.columns - numberWidth(count, scale)) / 2), 9, count, GOLD, scale)
  }
  return out
}
const MUTED_LOSS = 0x7890ab
