import type { RouletteBet } from '../roulette'
import { WHEEL, betLabel, color } from '../roulette'
import { FG, GOLD, GREEN, MUTED, RED, center, frame, put } from '../raster'
import { numberPixels, numberWidth } from '../glyphs'

const tint = (n: number) => color(n) === 'red' ? RED : color(n) === 'green' ? GREEN : 0xffffff
export const POCKET_BG = { red: 0xb32442, black: 0x182231, green: 0x007449 }
const POCKET_LIT = { red: 0xca294e, black: 0x344969, green: 0x00804f }
export const POCKET_WIDTH = 11, POCKET_PITCH = 12

// Центр выбранной ячейки всегда совпадает с маркером; дробная позиция двигает всю ленту.
export function ribbonLayout(columns: number, position: number) {
  const marker = Math.floor(columns / 2), radius = Math.ceil(columns / POCKET_PITCH / 2) + 1
  const middle = Math.floor(position)
  return Array.from({ length: radius * 2 + 1 }, (_, i) => {
    const index = middle + i - radius
    return { number: WHEEL[((index % 37) + 37) % 37]!, index,
      x: Math.round(marker + (index - position) * POCKET_PITCH) - Math.floor(POCKET_WIDTH / 2) }
  })
}

export function rouletteFrame(columns: number, result: number, choice: RouletteBet, position?: number, pulse = 0) {
  const f = frame(columns)
  center(f, 0, 'EUROPEAN ROULETTE / 0–36', GOLD)
  const selected = position ?? WHEEL.indexOf(result as typeof WHEEL[number])
  const marker = Math.floor(columns / 2)
  put(f, marker, 1, '▼', GOLD)
  for (const cell of ribbonLayout(columns, selected)) {
    const active = position === undefined && cell.index === selected
    const lit = active && Math.floor(pulse / 180) % 2 === 0
    const bg = lit ? POCKET_LIT[color(cell.number)] : POCKET_BG[color(cell.number)], border = active ? (lit ? GOLD : FG) : MUTED
    for (let y = 2; y <= 8; y++) for (let dx = 0; dx < POCKET_WIDTH; dx++) {
      const edge = y === 2 || y === 8
      const glyph = edge ? (dx === 0 ? (y === 2 ? '╭' : '╰') : dx === POCKET_WIDTH - 1 ? (y === 2 ? '╮' : '╯') : '─') :
        dx === 0 || dx === POCKET_WIDTH - 1 ? '│' : ' '
      put(f, cell.x + dx, y, glyph, border, bg)
    }
    numberPixels(f, cell.x + Math.floor((POCKET_WIDTH - numberWidth(cell.number)) / 2), 3, cell.number, FG)
  }
  put(f, marker, 9, '▲', GOLD)
  const shown = position === undefined ? result : WHEEL[((Math.round(position) % 37) + 37) % 37]!
  numberPixels(f, Math.floor((columns - numberWidth(shown, 2)) / 2), 10, shown, tint(shown), 2)
  if (position === undefined) {
    center(f, 15, `${result} · ${color(result) === 'red' ? 'КРАСНОЕ' : color(result) === 'black' ? 'ЧЁРНОЕ' : 'ZERO'}`, tint(result))
  } else center(f, 15, 'Шарик ищет виноватый кэш…', MUTED)
  center(f, 17, betLabel(choice), GOLD)
  return f
}
