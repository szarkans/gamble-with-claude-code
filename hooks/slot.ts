// Чистая логика слота: символы, выплаты, отрисовка в ячейки Raster.

// Битмапы 5×5, каждый пиксель рисуется двумя клетками в ширину (клетки терминала высокие).
export const SYMBOLS = [
  { name: '7', fg: 0xff2d55, bg: 0x2a0012, bmp: ['#####', '   # ', '  #  ', ' #   ', ' #   '] },
  { name: '$', fg: 0x39ff88, bg: 0x002a14, bmp: [' ####', '# #  ', ' ### ', '  # #', '#### '] },
  { name: 'LGTM', fg: 0x33d6ff, bg: 0x001c2a, bmp: ['    #', '   # ', '#  # ', ' ##  ', '  #  '] },
  { name: '429', fg: 0xffcc00, bg: 0x2a2200, bmp: ['  #  ', '  #  ', '  #  ', '     ', '  #  '] },
  { name: 'rm -rf', fg: 0xff7a00, bg: 0x2a1000, bmp: ['#   #', ' # # ', '  #  ', ' # # ', '#   #'] },
] as const

// Три одинаковых: множитель выплаты (возвращается ставка × N). Пара в первых двух: ×1.5.
export const TRIPLE = [20, 10, 5, 3, 50]

export function payout(reels: readonly number[], bet: number): number {
  const [a, b, c] = reels
  if (a === b && b === c) return Math.floor(bet * TRIPLE[a])
  if (a === b || b === c) return Math.floor(bet * 1.5)
  return 0
}

export function spinResult(rand: () => number): number[] {
  return [0, 1, 2].map(() => Math.floor(rand() * SYMBOLS.length))
}

export const REEL_W = 12
export const GAP = 2
export const COLS = REEL_W * 3 + GAP * 2
export const ROWS = 5
const DEFAULT = 0x01000000

function dim(c: number, k: number): number {
  return (((c >> 16) & 255) * k) << 16 | (((c >> 8) & 255) * k) << 8 | ((c & 255) * k)
}

// reels[i] = индекс символа или -1 (крутится: shown[i] — что мелькает).
// glow — цвет фона щелей на победной вспышке, или DEFAULT.
export function cells(shown: readonly number[], spinning: readonly boolean[], glow = DEFAULT): string {
  const words = new Uint32Array(COLS * ROWS * 3)
  let i = 0
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const reel = Math.floor(x / (REEL_W + GAP))
      const rx = x - reel * (REEL_W + GAP)
      let cp = 0x20, fg = DEFAULT, bg = glow
      if (rx < REEL_W) {
        const s = SYMBOLS[shown[reel]]
        const k = spinning[reel] ? 0.45 : 1
        bg = spinning[reel] ? dim(s.bg, 1) : s.bg
        const px = Math.floor((rx - 1) / 2)
        if (rx >= 1 && px < 5 && s.bmp[y][px] === '#') {
          cp = 0x2588
          fg = Math.round(k * 100) === 100 ? s.fg : dim(s.fg, k)
        }
      }
      words[i++] = cp
      words[i++] = fg
      words[i++] = bg
    }
  }
  return new Uint8Array(words.buffer).toBase64()
}

export function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(Math.floor(n))
}
