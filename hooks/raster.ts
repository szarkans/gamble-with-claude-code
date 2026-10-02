// Один кадр: глиф и два цвета на клетку. Цвета явные, тема терминала не мешает.
export const BG = 0x101827
export const FG = 0xf1f5f9
export const MUTED = 0xadc0d5
export const GOLD = 0xffd166
export const RED = 0xff718b
export const GREEN = 0x67efac
export type Frame = { columns: number; rows: number; words: Uint32Array }

export function frame(columns: number, rows = 18, bg = BG): Frame {
  const words = new Uint32Array(columns * rows * 3)
  for (let i = 0; i < words.length; i += 3) {
    words[i] = 32
    words[i + 1] = FG
    words[i + 2] = bg
  }
  return { columns, rows, words }
}

export function put(f: Frame, x: number, y: number, glyph: string, fg = FG, bg?: number) {
  x = Math.floor(x); y = Math.floor(y)
  if (x < 0 || x >= f.columns || y < 0 || y >= f.rows) return
  const i = (y * f.columns + x) * 3
  f.words[i] = glyph.charCodeAt(0)
  f.words[i + 1] = fg
  if (bg !== undefined) f.words[i + 2] = bg
}

export function text(f: Frame, x: number, y: number, value: string, fg = FG, bg?: number) {
  Array.from(value).forEach((c, i) => put(f, x + i, y, c, fg, bg))
}

export function center(f: Frame, y: number, value: string, fg = FG, bg?: number) {
  text(f, Math.max(0, Math.floor((f.columns - value.length) / 2)), y, value, fg, bg)
}

export function stamp(target: Frame, source: Frame, x: number, y: number) {
  for (let sy = 0; sy < source.rows; sy++) for (let sx = 0; sx < source.columns; sx++) {
    const i = (sy * source.columns + sx) * 3
    put(target, sx + x, sy + y, String.fromCharCode(source.words[i]!), source.words[i + 1]!, source.words[i + 2]!)
  }
}

export function encode(f: Frame): string {
  // Формат API — little-endian, независимо от порядка байтов машины.
  const bytes = new Uint8Array(f.words.length * 4)
  const view = new DataView(bytes.buffer)
  f.words.forEach((word, i) => view.setUint32(i * 4, word, true))
  return bytes.toBase64()
}

export function decode(columns: number, rows: number, cells: string): Frame {
  const bytes = Uint8Array.fromBase64(cells)
  const view = new DataView(bytes.buffer)
  const f = frame(columns, rows)
  f.words.forEach((_, i) => { f.words[i] = view.getUint32(i * 4, true) })
  return f
}
