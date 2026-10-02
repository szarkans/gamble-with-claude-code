import { COLS, ROWS, SYMBOLS, cells } from '../slot'
import { GOLD, MUTED, center, decode, frame, stamp } from '../raster'

export function slotFrame(columns: number, reels: readonly number[], spinning = [false, false, false]) {
  const f = frame(columns, 14)
  center(f, 1, 'SLOT / AGENT APPROVED', GOLD)
  if (columns >= COLS) stamp(f, decode(COLS, ROWS, cells(reels, spinning)), Math.floor((columns - COLS) / 2), 5)
  else {
    center(f, 5, '+-----+-----+-----+', GOLD)
    center(f, 6, '| ' + reels.map((n, i) => spinning[i] ? ' ? ' : SYMBOLS[n]!.name.padStart(3).slice(0, 3)).join(' | ') + ' |')
    center(f, 7, '+-----+-----+-----+', GOLD)
  }
  center(f, 12, spinning.some(Boolean) ? 'Генерирую уверенность…' : 'Три символа. Ни одного теста.', MUTED)
  return f
}
