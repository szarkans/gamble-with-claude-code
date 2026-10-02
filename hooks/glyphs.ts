import { put } from './raster'
import type { Frame } from './raster'

const DIGITS = [
  ['###', '# #', '# #', '# #', '###'], [' # ', '## ', ' # ', ' # ', '###'],
  ['###', '  #', '###', '#  ', '###'], ['###', '  #', '###', '  #', '###'],
  ['# #', '# #', '###', '  #', '  #'], ['###', '#  ', '###', '  #', '###'],
  ['###', '#  ', '###', '# #', '###'], ['###', '  #', ' # ', ' # ', ' # '],
  ['###', '# #', '###', '# #', '###'], ['###', '# #', '###', '  #', '###'],
]

const SUFFIXES: Record<string, readonly string[]> = {
  '.': [' ', ' ', ' ', ' ', '#'],
  K: ['# #', '## ', '#  ', '## ', '# #'],
  M: ['#   #', '## ##', '# # #', '#   #', '#   #'],
  B: ['## ', '# #', '## ', '# #', '## '],
}

// Те же пять пиксельных строк, что у чисел рулетки, плюс суффиксы баланса.
export function balancePixels(value: string, scale = 1): string[] {
  const glyphs = Array.from(value, c => SUFFIXES[c] ?? DIGITS[Number(c)]!)
  return Array.from({ length: 5 }, (_, y) => glyphs.map(rows =>
    Array.from(rows[y]!, c => (c === '#' ? '█' : ' ').repeat(scale)).join('')).join(' '.repeat(scale)))
}

export function pixels(f: Frame, x: number, y: number, rows: readonly string[], fg: number, scale = 1) {
  rows.forEach((row, dy) => Array.from(row).forEach((c, dx) => {
    if (c === '#') for (let k = 0; k < scale; k++) put(f, x + dx * scale + k, y + dy, '█', fg)
  }))
}

export function numberPixels(f: Frame, x: number, y: number, n: number, fg: number, scale = 1) {
  Array.from(String(n)).forEach((d, i) => pixels(f, x + i * 4 * scale, y, DIGITS[Number(d)]!, fg, scale))
}

export const numberWidth = (n: number, scale = 1) => (String(n).length * 4 - 1) * scale
