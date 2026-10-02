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
  | { kind: 'number'; step: -1 | 1 }
  | { kind: 'spin' | 'roll' | 'deal' | 'hit' | 'stand' | 'double' | 'close' }
export type Chip = {
  key: string; label: string; hotkey: string; selected: boolean; disabled: boolean
  primary: boolean; color: string; intent: Intent
}
export type ChipGroup = { kind: 'tabs' | 'console' | 'bet' | 'debug'; label?: string; chips: Chip[] }
export type ChipProps = { width: number; groups: ChipGroup[]; shortcuts: Chip[] }
export type PlacedChip = Chip & { x: number; y: number; width: number; lines: string[] }
export type PlacedLabel = { key: string; text: string; x: number; y: number; width: number }

export function chips(data: Snapshot, debug: boolean): ChipGroup[] {
  const busy = busyPhase(data.phase), activeHand = !!data.hand && data.hand.status !== 'done'
  const balance = balanceOf(data.earned.total, data.net)
  const chip = (key: string, label: string, hotkey: string, intent: Intent,
    disabled = busy, selected = false, primary = false, color = '#adc0d5'): Chip =>
    ({ key, label, hotkey, intent, disabled, selected, primary, color })
  const tabs = (['slot', 'roulette', 'blackjack'] as const).map((g, i) =>
    chip(`tab-${g}`, ['СЛОТЫ', 'РУЛЕТКА', '21'][i]!, ['z', 'x', 'c'][i]!, { kind: 'game', value: g },
      activeHand, data.game === g))
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
  const groups: ChipGroup[] = [{ kind: 'tabs', chips: tabs }]
  if (data.game === 'roulette') {
    const current = data.rouletteBet, n = current.kind === 'number' ? current.value : data.roulettePick
    const choice = (key: string, label: string, hotkey: string, bet: RouletteBet, color?: string) =>
      chip(key, label, hotkey, { kind: 'roulette', value: bet }, busy,
        current.kind === bet.kind && (!('value' in bet) || 'value' in current && current.value === bet.value), false, color)
    groups.push(
      { kind: 'bet', label: 'ЦВЕТ', chips: [
        choice('red', 'КРАС', 'r', { kind: 'red' }, '#ff718b'), choice('black', 'ЧЁРН', 'b', { kind: 'black' }),
      ] },
      { kind: 'bet', label: 'ЧЁТНОСТЬ', chips: [
        choice('even', 'ЧЁТ', 'e', { kind: 'even' }), choice('odd', 'НЕЧЁТ', 'o', { kind: 'odd' }),
      ] },
      { kind: 'bet', label: 'ПОЛОВИНА', chips: [
        choice('low', '1–18', 'l', { kind: 'low' }), choice('high', '19–36', 'u', { kind: 'high' }),
      ] },
      { kind: 'bet', label: 'ДЮЖИНА', chips: [
        choice('dozen1', '1–12', 'a', { kind: 'dozen', value: 1 }),
        choice('dozen2', '13–24', 'd', { kind: 'dozen', value: 2 }),
        choice('dozen3', '25–36', 'f', { kind: 'dozen', value: 3 }),
      ] },
      { kind: 'bet', label: 'ЧИСЛО', chips: [
        chip('number-prev', '−', 'j', { kind: 'number', step: -1 }),
        choice('number', String(n), 'n', { kind: 'number', value: n }, '#67efac'),
        chip('number-next', '+', 'k', { kind: 'number', step: 1 }),
      ] },
    )
  }
  groups.push({ kind: 'console', chips: [...stakes, ...actions] })
  if (debug) groups.push({ kind: 'debug', label: 'DEBUG', chips: debugChoices(data.game).map(c =>
    chip(`debug-${c.outcome}`, c.label.replace('DEBUG ', ''), c.hotkey, { kind: 'debug', value: c.outcome }, busy || activeHand)) })
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

export function chipLayout(groups: ChipGroup[], columns: number) {
  const width = Math.max(1, Math.min(88, Math.floor(columns))), placed: PlacedChip[] = []
  const labels: PlacedLabel[] = []
  let y = 0
  const sizeOf = (c: Chip, compact = false) => compact ? c.hotkey.length + c.label.length + 1 :
    Math.max(c.primary ? (c.key === 'hit' || c.key === 'stand' || c.key === 'double' ? 12 : 18) : c.key === 'number' ? 8 : 5,
      c.label.length + (c.primary ? 4 : 2))
  const span = (cs: Chip[], compact = false) => cs.reduce((n, c) => n + sizeOf(c, compact), 0) + Math.max(0, cs.length - 1)
  const label = (key: string, text: string, x: number, top: number, room: number) => {
    labels.push({ key, text: text.slice(0, room), x, y: top, width: Math.min(room, text.length) })
  }
  const flow = (cs: Chip[], left: number, top: number, room: number, compact = false) => {
    let x = 0, row = top, rowHeight = 0
    for (const chip of cs) {
      const size = Math.min(room, sizeOf(chip, compact))
      const lines = compact ? [`${chip.hotkey} ${chip.label}`.slice(0, size).padEnd(size)] : chipLines(chip, size)
      if (x && x + size > room) { row += rowHeight; x = 0; rowHeight = 0 }
      placed.push({ ...chip, x: left + x, y: row, width: size, lines })
      rowHeight = Math.max(rowHeight, lines.length)
      x += size + 1
    }
    return row + rowHeight - top
  }
  const split = (left: Chip[], right: Chip[]) => {
    const l = span(left), r = span(right)
    if (l + 2 + r <= width) {
      y += Math.max(flow(left, 0, y, l), flow(right, width - r, y, r))
    } else {
      y += flow(left, 0, y, width)
      y += flow(right, Math.max(0, width - r), y, Math.min(width, r))
    }
  }
  const bets = groups.filter(g => g.kind === 'bet'), gutter = 3
  const half = Math.floor((width - gutter) / 2)
  const labelWidth = Math.max(0, ...bets.map(g => g.label!.length)) + 1
  const paired = bets.every(g => labelWidth + span(g.chips) <= half)
  const betGroup = (g: ChipGroup, left: number, top: number, room: number) => {
    const beside = labelWidth + span(g.chips) <= room
    label(`label-${g.label}`, g.label!, left, top + (beside ? 1 : 0), Math.min(room, labelWidth - 1))
    return (beside ? 0 : 1) + flow(g.chips, left + (beside ? labelWidth : 0), top + (beside ? 0 : 1),
      room - (beside ? labelWidth : 0))
  }
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]!
    if (group.kind === 'tabs') split(group.chips.filter(c => c.key !== 'close'), group.chips.filter(c => c.key === 'close'))
    else if (group.kind === 'console') {
      label('console-rule', '─'.repeat(width), 0, y, width)
      y += 2
      split(group.chips.filter(c => !c.primary), group.chips.filter(c => c.primary))
    } else if (group.kind === 'bet') {
      const next = groups[i + 1]
      if (paired && next?.kind === 'bet') {
        y += Math.max(betGroup(group, 0, y, half), betGroup(next, half + gutter, y, width - half - gutter))
        i++
      } else y += betGroup(group, 0, y, width)
    } else {
      y++
      label('debug-label', group.label!, 0, y, width)
      const left = width > 6 ? 6 : 0
      if (!left) y++
      y += flow(group.chips, left, y, width - left, true)
    }
  }
  return { width, height: y, placed, labels }
}

export const chipAt = (placed: PlacedChip[], x: number, y: number) => placed.find(c =>
  x >= c.x && x < c.x + c.width && y >= c.y && y < c.y + c.lines.length)
