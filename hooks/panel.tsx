import type { Elements } from 'claude-code'
import type { Snapshot } from './host'
import { busyPhase } from './host'
import type { RouletteBet } from './roulette'
import type { Game } from '../types'
import { balanceOf, stake } from './economy'
import { currentFrame, isDebug, setColumns } from './controller'
import { debugChoices } from './debug'
import type { DebugOutcome } from './debug'
import { encode } from './raster'
import { fmt } from './slot'
import { blackjackControls, blackjackFrame } from './views/blackjack'
import { rouletteControls, rouletteFrame } from './views/roulette'
import { slotControls, slotFrame } from './views/slot'

export type Actions = {
  chooseGame: (game: Game) => void; chooseFraction: (fraction: number) => void
  chooseRoulette: (bet: RouletteBet) => void; spin: () => void; roll: () => void
  deal: () => void; hit: () => void; stand: () => void; double: () => void; close: () => void
  debug: (outcome: DebugOutcome) => void
}
export function renderPanel(elements: Elements['terminal'], data: Snapshot, columns: number, actions: Actions) {
  const { Box, Button, Raster, Text } = elements
  const { earned: er, net: n, frac: f, phase: ph, msg: m, game: g, reels,
    rouletteBet: choice, rouletteNumber: number, hand } = data
  const balance = balanceOf(er.total, n), busy = busyPhase(ph)
  const width = Math.max(1, Math.min(512, Math.floor(columns)))
  setColumns(width)
  const picture = currentFrame(width) ?? (g === 'slot' ? slotFrame(width, ph === 'spinning' ? [0, 1, 2] : reels, [ph === 'spinning', ph === 'spinning', ph === 'spinning']) :
    g === 'roulette' ? rouletteFrame(width, number, choice, ph === 'spinning' ? 0 : undefined) :
    blackjackFrame(width, hand, ph === 'dealing' && hand ? { player: hand.player.length, dealer: hand.dealer.length, reveal: false } : undefined))
  const tab = (value: Game, label: string, hotkey: string) => <Button key={`tab-${value}`} label={label + ` [${hotkey}]`}
    hotkey={hotkey} variant={g === value ? 'primary' : undefined} dimColor={busy || !!hand && hand.status !== 'done'}
    onPress={() => actions.chooseGame(value)} />
  const fraction = (value: number, label: string, hotkey: string) => <Button key={`frac-${hotkey}`} label={label + ` [${hotkey}]`}
    hotkey={hotkey} variant={f === value ? 'primary' : undefined} dimColor={busy}
    onPress={() => actions.chooseFraction(value)} />
  return <Box flexDirection="column" width={width}>
    <Box flexDirection="row" flexWrap="wrap" gap={1}>
      {tab('slot', 'Слоты', 'z')}{tab('roulette', 'Рулетка', 'x')}{tab('blackjack', '21', 'c')}
      <Button key="close" label="Закрыть [q]" hotkey="q" role="dismiss" onPress={actions.close} />
    </Box>
    <Box flexDirection="column">
      <Text bold>ФИШКИ: {fmt(balance)}</Text>
      <Text dimColor>Сегодня сожжено {fmt(er.total)} · {n >= 0 ? '+' : '−'}{fmt(Math.abs(n))} в казино · {er.date}</Text>
      <Text>Следующая ставка: {fmt(stake(balance, f))}{hand && hand.status !== 'done' ? ` · в руке ${fmt(hand.bet)}` : ''}</Text>
    </Box>
    <Box flexDirection="row" justifyContent="center" width={width}>
      <Raster key="stage" columns={picture.columns} rows={picture.rows} cells={encode(picture)} />
    </Box>
    <Text bold>{m}</Text>
    <Box flexDirection="row" flexWrap="wrap" gap={1}>
      {fraction(0.1, '10%', '1')}{fraction(0.25, '25%', '2')}{fraction(0.5, '50%', '3')}{fraction(1, 'ALL IN', '4')}
    </Box>
    {g === 'slot' ? slotControls(elements, actions.spin, busy) :
      g === 'roulette' ? rouletteControls(elements, choice, actions.chooseRoulette, actions.roll, busy) :
      blackjackControls(elements, hand, balance, busy, actions)}
    {isDebug() && <Box flexDirection="row" flexWrap="wrap" gap={1}>
      {debugChoices(g).map(choice => <Button key={`debug-${choice.outcome}`} label={`${choice.label} [${choice.hotkey}]`}
        hotkey={choice.hotkey} dimColor={busy} onPress={() => actions.debug(choice.outcome)} />)}
    </Box>}
    <Text dimColor>Виртуальные фишки, вывода нет.</Text>
  </Box>
}
