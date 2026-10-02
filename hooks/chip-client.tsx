import type { ClientModule } from 'claude-code'
import { chipAt, chipLayout } from './chips'
import type { ChipProps } from './chips'

const Chips: ClientModule<ChipProps> = (props, surface) => {
  const { Box, Text } = surface.elements
  const layout = chipLayout(props.groups, Math.min(props.width, surface.columns || props.width))
  surface.onKey(e => {
    if (e.ctrl || e.meta) return
    const chip = layout.placed.find(c => c.hotkey === e.key.toLowerCase())
    if (chip && !chip.disabled) surface.post({ control: chip.key })
  })
  surface.onPointer(e => {
    if (e.type !== 'down' || e.button !== 'left' || e.ctrl || e.alt || e.shift) return
    const chip = chipAt(layout.placed, e.x, e.y)
    if (chip && !chip.disabled) surface.post({ control: chip.key })
  })
  return <Box width={layout.width} height={layout.height}>
    {layout.placed.map(chip => <Box key={chip.key} position="absolute" left={chip.x} top={chip.y}
      width={chip.width} height={chip.lines.length}>
      <Text color={chip.selected || chip.primary ? '#ffd166' : chip.color} dimColor={chip.disabled}
        bold={chip.selected || chip.primary} wrap="truncate-end">{chip.lines.join('\n')}</Text>
    </Box>)}
  </Box>
}
export default Chips
