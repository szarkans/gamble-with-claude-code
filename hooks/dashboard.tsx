import type { Elements } from 'claude-code'
import type { Snapshot } from './host'
import { busyPhase } from './host'
import { balanceOf, stake } from './economy'
import { balancePixels } from './glyphs'
import { fmt } from './slot'

export function dashboardLayout(data: Snapshot, width: number) {
  const balance = balanceOf(data.earned.total, data.net)
  const hand = data.hand && data.hand.status !== 'done' ? data.hand : null
  const broke = balance === 0 && !hand && !busyPhase(data.phase)
  const room = Math.max(1, width - 4)
  const stats = [
    'TOKENS',
    `burned    ${fmt(data.earned.total)}`,
    `casino    ${data.net >= 0 ? '+' : '−'}${fmt(Math.abs(data.net))}`,
    hand ? `in hand   ${fmt(hand.bet)}` : balance > 0 ? `bet       ${fmt(stake(balance, data.frac))}` : '',
    broke ? 'ALL OUT. Cache miss.' : '',
  ].filter(Boolean)
  let value = fmt(balance)
  // Очень узкий терминал: сохраняем суффикс и убираем дробную часть.
  if (balancePixels(value)[0]!.length > room) value = value.replace(/\.\d+/, '')
  const statWidth = Math.max(...stats.map(s => s.length))
  const sideBySide = balancePixels(value)[0]!.length + statWidth + 3 <= room
  const digitRoom = sideBySide ? room - statWidth - 3 : room
  const scale = balancePixels(value, 2)[0]!.length <= digitRoom ? 2 : 1
  const digits = balancePixels(value, scale)
  const rows = width < 6 ? 1 : 2 + (sideBySide ? Math.max(digits.length, stats.length) : digits.length + stats.length)
  return { balance, value, broke, sideBySide, digits, stats, statWidth, room, rows }
}

export function dashboard({ Box, Text }: Elements['terminal'], data: Snapshot, width: number) {
  const layout = dashboardLayout(data, width)
  const digits = <Box key="balance" width={Math.min(layout.room, layout.digits[0]!.length)} flexShrink={0}>
    <Text color={layout.broke ? '#ff718b' : '#ffd166'} wrap="truncate-end">{layout.digits.join('\n')}</Text>
  </Box>
  const stats = <Box key="statistics" width={layout.sideBySide ? layout.statWidth : layout.room} flexDirection="column" flexShrink={0}>
    {layout.stats.map((line, i) => <Text bold={i === 0} dimColor={i !== 0} wrap="truncate-end">{line}</Text>)}
  </Box>
  // При ширине меньше рамки остаётся только короткое табло.
  if (width < 6) return <Box key="scoreboard" width={width}><Text wrap="truncate-end">{layout.value}</Text></Box>
  return <Box key="scoreboard" width={width} borderStyle="double" borderColor="#adc0d5" paddingX={1}
    flexDirection={layout.sideBySide ? 'row' : 'column'} gap={layout.sideBySide ? 3 : 0} overflow="hidden">
    {digits}{stats}
  </Box>
}
