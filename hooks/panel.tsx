import type { Elements } from 'claude-code'
import type { Snapshot } from './host'
import { currentFrame, isDebug, setColumns } from './controller'
import { encode } from './raster'
import { blackjackFrame } from './views/blackjack'
import { rouletteFrame } from './views/roulette'
import { slotFrame } from './views/slot'
import { dashboard, dashboardLayout } from './dashboard'
import { chipLayout, chips } from './chips'

// В 200×50 Claude Code может оставить 37 строк тела; лимит задачи — 38.
export const PANEL_ROWS = 37

export function renderPanel(elements: Elements['terminal'], data: Snapshot, columns: number, activate: (key: string) => Promise<unknown>, availableRows = PANEL_ROWS) {
  const { Box, Button, Client, Raster, Text } = elements
  const { phase: ph, msg: m, game: g, reels,
    rouletteBet: choice, rouletteNumber: number, hand } = data
  const width = Math.max(1, Math.min(88, Math.floor(columns)))
  const groups = chips(data, isDebug())
  const shortcuts = groups.flatMap(g => g.chips)
  const tabs = groups.filter(g => g.kind === 'tabs'), controls = groups.filter(g => g.kind !== 'tabs')
  setColumns(width)
  const picture = currentFrame(width) ?? (g === 'slot' ? slotFrame(width, ph === 'spinning' ? [0, 1, 2] : reels, [ph === 'spinning', ph === 'spinning', ph === 'spinning']) :
    g === 'roulette' ? rouletteFrame(width, number, choice, ph === 'spinning' ? 0 : undefined) :
    blackjackFrame(width, hand, ph === 'dealing' && hand ? { player: hand.player.length, dealer: hand.dealer.length, reveal: false } : undefined))
  // Отладка добавляется после консоли и не отнимает место у обычной панели.
  const controlsRows = chipLayout(controls.filter(g => g.kind !== 'debug'), width).height
  const debugRows = chipLayout(controls, width).height - controlsRows
  const extraRows = Math.min(debugRows, Math.max(0, availableRows - PANEL_ROWS))
  const sceneRows = Math.max(picture.rows, PANEL_ROWS - chipLayout(tabs, width).height - dashboardLayout(data, width).rows - 2 - controlsRows)
  return <Box flexDirection="column" width={width} flexShrink={0}>
    <Client key="navigation" module="./chip-client.tsx" width={width}
      props={{ width, groups: tabs, shortcuts }} />
    {dashboard(elements, data, width)}
    <Text dimColor wrap="truncate-end">
      {width >= 53 ? "Bet today's Claude Code burn. More work, more tokens." : "Today's Claude Code burn"}
    </Text>
    <Box flexDirection="row" justifyContent="center" alignItems="center" width={width} height={sceneRows} flexShrink={0}>
      <Raster key="stage" columns={picture.columns} rows={picture.rows} cells={encode(picture)} />
    </Box>
    <Text bold wrap="truncate-end">{m}</Text>
    <Client key="controls" module="./chip-client.tsx" width={width} height={controlsRows + extraRows}
      props={{ width, groups: controls, shortcuts }} />
    {/* Client получает клавиши после клика; мост держит хоткеи самого диалога с открытия. */}
    <Box key="hotkeys" width={0} height={0} overflow="hidden" flexShrink={0}>
      {shortcuts.map(chip => <Button key={chip.key} plain label={chip.label} hotkey={chip.hotkey}
        onPress={() => activate(chip.key)} />)}
    </Box>
  </Box>
}
