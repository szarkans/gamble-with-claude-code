import type { Elements } from 'claude-code'
import type { Snapshot } from './host'
import { currentFrame, isDebug, setColumns } from './controller'
import { encode } from './raster'
import { blackjackFrame } from './views/blackjack'
import { rouletteFrame } from './views/roulette'
import { slotFrame } from './views/slot'
import { dashboard } from './dashboard'
import { chips } from './chips'

export function renderPanel(elements: Elements['terminal'], data: Snapshot, columns: number, activate: (key: string) => Promise<unknown>) {
  const { Box, Button, Client, Raster, Text } = elements
  const { phase: ph, msg: m, game: g, reels,
    rouletteBet: choice, rouletteNumber: number, hand } = data
  const width = Math.max(1, Math.min(88, Math.floor(columns)))
  const groups = chips(data, isDebug())
  const shortcuts = groups.flatMap(g => g.chips)
  setColumns(width)
  const picture = currentFrame(width) ?? (g === 'slot' ? slotFrame(width, ph === 'spinning' ? [0, 1, 2] : reels, [ph === 'spinning', ph === 'spinning', ph === 'spinning']) :
    g === 'roulette' ? rouletteFrame(width, number, choice, ph === 'spinning' ? 0 : undefined) :
    blackjackFrame(width, hand, ph === 'dealing' && hand ? { player: hand.player.length, dealer: hand.dealer.length, reveal: false } : undefined))
  return <Box flexDirection="column" width={width}>
    <Client key="navigation" module="./chip-client.tsx" width={width}
      props={{ width, groups: groups.filter(g => g.kind === 'tabs'), shortcuts }} />
    {dashboard(elements, data, width)}
    <Box flexDirection="row" justifyContent="center" width={width}>
      <Raster key="stage" columns={picture.columns} rows={picture.rows} cells={encode(picture)} />
    </Box>
    <Text bold wrap="truncate-end">{m}</Text>
    <Client key="controls" module="./chip-client.tsx" width={width}
      props={{ width, groups: groups.filter(g => g.kind !== 'tabs'), shortcuts }} />
    {/* Client получает клавиши после клика; мост держит хоткеи самого диалога с открытия. */}
    <Box key="hotkeys" width={0} height={0} overflow="hidden" flexShrink={0}>
      {shortcuts.map(chip => <Button key={chip.key} plain label={chip.label} hotkey={chip.hotkey}
        onPress={() => activate(chip.key)} />)}
    </Box>
  </Box>
}
