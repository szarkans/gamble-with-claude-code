import type { Game, RouletteBet } from '../types'
import type { Snapshot } from './host'
import { busyPhase } from './host'
import { balanceOf } from './economy'
import { canDouble } from './blackjack'
import { debugChoices } from './debug'
import type { DebugOutcome } from './debug'

export type Intent =
  | { kind: 'game'; value: Game } | { kind: 'fraction'; value: number }
  | { kind: 'roulette'; value: RouletteBet } | { kind: 'debug'; value: DebugOutcome }
  | { kind: 'spin' | 'roll' | 'deal' | 'hit' | 'stand' | 'double' | 'close' }
export type Chip = {
  key: string; label: string; hotkey: string; selected: boolean; disabled: boolean
  primary: boolean; color: string; intent: Intent
}
export type ChipProps = { width: number; groups: Chip[][] }
export type PlacedChip = Chip & { x: number; y: number; width: number; lines: string[] }

export function chips(data: Snapshot, debug: boolean): Chip[][] {
  const busy = busyPhase(data.phase), activeHand = !!data.hand && data.hand.status !== 'done'
  const balance = balanceOf(data.earned.total, data.net)
  const chip = (key: string, label: string, hotkey: string, intent: Intent,
    disabled = busy, selected = false, primary = false, color = '#adc0d5'): Chip =>
    ({ key, label, hotkey, intent, disabled, selected, primary, color })
  const tabs = (['slot', 'roulette', 'blackjack'] as const).map((g, i) =>
    chip(`tab-${g}`, ['СЛОТЫ', 'РУЛЕТКА', '21'][i]!, ['z', 'x', 'c'][i]!, { kind: 'game', value: g },
      busy || activeHand, data.game === g))
  tabs.push(chip('close', 'ВЫХОД', 'q', { kind: 'close' }, false))
  const stakes = [0.1, 0.25, 0.5, 1].map((f, i) =>
    chip(`frac-${i + 1}`, ['10%', '25%', '50%', 'ALL'][i]!, String(i + 1), { kind: 'fraction', value: f },
      busy || activeHand || balance === 0, data.frac === f))
  const noBet = busy || activeHand || balance === 0
  const playing = data.game === 'blackjack' && data.hand?.status === 'player'
  const actions = playing ? [
    chip('hit', 'ЕЩЁ', 'h', { kind: 'hit' }, busy, false, true),
    chip('stand', 'ХВАТИТ', 's', { kind: 'stand' }, busy, false, true),
    chip('double', 'DOUBLE', 'd', { kind: 'double' }, busy || !canDouble(data.hand!, balance), false, true),
  ] : [data.game === 'slot' ? chip('spin', 'SPIN', 's', { kind: 'spin' }, noBet, false, true) :
    data.game === 'roulette' ? chip('roll', 'КРУТИТЬ', 's', { kind: 'roll' }, noBet, false, true) :
      chip('deal', 'РАЗДАТЬ', 's', { kind: 'deal' }, noBet, false, true)]
  const groups = [tabs, [...stakes, ...actions]]
  if (data.game === 'roulette') {
    const current = data.rouletteBet, n = current.kind === 'number' ? current.value : 0
    const choice = (key: string, label: string, hotkey: string, bet: RouletteBet, color?: string) =>
      chip(key, label, hotkey, { kind: 'roulette', value: bet }, busy,
        current.kind === bet.kind && (!('value' in bet) || 'value' in current && current.value === bet.value), false, color)
    groups.push([
      choice('red', 'КРАС', 'r', { kind: 'red' }, '#ff718b'), choice('black', 'ЧЁРН', 'b', { kind: 'black' }),
      choice('even', 'ЧЁТ', 'e', { kind: 'even' }), choice('odd', 'НЕЧЁТ', 'o', { kind: 'odd' }),
      choice('low', '1–18', 'l', { kind: 'low' }), choice('high', '19–36', 'u', { kind: 'high' }),
      choice('dozen1', '1–12', 'a', { kind: 'dozen', value: 1 }),
      choice('dozen2', '13–24', 'd', { kind: 'dozen', value: 2 }),
      choice('dozen3', '25–36', 'f', { kind: 'dozen', value: 3 }),
      choice('number', `№${n}`, 'n', { kind: 'number', value: n }, '#67efac'),
      chip('number-prev', '−', 'j', { kind: 'roulette', value: { kind: 'number', value: (n + 36) % 37 } }),
      chip('number-next', '+', 'k', { kind: 'roulette', value: { kind: 'number', value: (n + 1) % 37 } }),
    ])
  }
  if (debug) groups.push(debugChoices(data.game).map(c =>
    chip(`debug-${c.outcome}`, c.label.replace('DEBUG ', ''), c.hotkey, { kind: 'debug', value: c.outcome }, busy || activeHand)))
  return groups
}

function chipLines(chip: Chip, width: number): string[] {
  if (width < 3) return [chip.hotkey.padEnd(width)]
  const inner = width - 2, label = chip.label.slice(0, inner)
  const center = (s: string, fill: string) => {
    const left = Math.floor((inner - s.length) / 2)
    return fill.repeat(left) + s + fill.repeat(inner - left - s.length)
  }
  const border = chip.selected ? ['┏', '━', '┓', '┃', '┗', '┛'] :
    chip.primary ? ['╔', '═', '╗', '║', '╚', '╝'] : ['╭', '─', '╮', '│', '╰', '╯']
  return [border[0]! + border[1]!.repeat(inner) + border[2]!,
    border[3]! + center(label, ' ') + border[3]!,
    border[4]! + center(chip.hotkey, border[1]!) + border[5]!]
}

export function chipLayout(groups: Chip[][], columns: number) {
  const width = Math.max(1, Math.min(88, Math.floor(columns))), placed: PlacedChip[] = []
  let y = 0
  for (const group of groups) {
    let x = 0, rowHeight = 0
    for (const chip of group) {
      const size = Math.min(width, Math.max(chip.primary ? 12 : 5, chip.label.length + (chip.primary ? 4 : 2)))
      const lines = chipLines(chip, size)
      if (x && x + size > width) { y += rowHeight; x = 0; rowHeight = 0 }
      placed.push({ ...chip, x, y, width: size, lines })
      rowHeight = Math.max(rowHeight, lines.length)
      x += size + 1
    }
    y += rowHeight
  }
  return { width, height: y, placed }
}

export const chipAt = (placed: PlacedChip[], x: number, y: number) => placed.find(c =>
  x >= c.x && x < c.x + c.width && y >= c.y && y < c.y + c.lines.length)
