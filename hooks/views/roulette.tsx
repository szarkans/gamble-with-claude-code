import type { Elements } from 'claude-code'
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

export function rouletteControls({ Box, Button, Text }: Elements['terminal'], choice: RouletteBet,
  choose: (bet: RouletteBet) => void, roll: () => void, busy: boolean) {
  const btn = (key: string, label: string, hotkey: string, bet: RouletteBet) =>
    <Button key={key} label={label + ` [${hotkey}]`} hotkey={hotkey} dimColor={busy}
      variant={choice.kind === bet.kind && (!('value' in bet) || 'value' in choice && choice.value === bet.value) ? 'primary' : undefined}
      onPress={() => choose(bet)} />
  const n = choice.kind === 'number' ? choice.value : 0
  return <Box flexDirection="column">
    <Box flexDirection="row" flexWrap="wrap" gap={1}>
      {btn('red', 'R красное', 'r', { kind: 'red' })}{btn('black', 'B чёрное', 'b', { kind: 'black' })}
      {btn('even', 'Чёт', 'e', { kind: 'even' })}{btn('odd', 'Нечет', 'o', { kind: 'odd' })}
      {btn('low', '1–18', 'l', { kind: 'low' })}{btn('high', '19–36', 'u', { kind: 'high' })}
    </Box>
    <Box flexDirection="row" flexWrap="wrap" gap={1}>
      {btn('dozen1', '1–12', 'a', { kind: 'dozen', value: 1 })}
      {btn('dozen2', '13–24', 'd', { kind: 'dozen', value: 2 })}
      {btn('dozen3', '25–36', 'f', { kind: 'dozen', value: 3 })}
      {btn('number', `Число ${n}`, 'n', { kind: 'number', value: n })}
      <Button key="number-prev" label="− число [j]" hotkey="j" dimColor={busy} onPress={() => choose({ kind: 'number', value: (n + 36) % 37 })} />
      <Button key="number-next" label="+ число [k]" hotkey="k" dimColor={busy} onPress={() => choose({ kind: 'number', value: (n + 1) % 37 })} />
    </Box>
    <Button key="roll" label="КРУТИТЬ [s]" hotkey="s" variant="primary" dimColor={busy} onPress={roll} />
    <Text dimColor>Зеро проигрывает внешним ставкам. Выбрана: {betLabel(choice)}</Text>
  </Box>
}
