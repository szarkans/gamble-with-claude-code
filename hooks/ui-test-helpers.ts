import { expect } from 'claude-code/testing'
import type { Mounted } from 'claude-code/testing'
import type { ChipProps } from './chips'
import { balancePixels } from './glyphs'

type Panel = Mounted<'terminal', 'Pane'>
export async function drawnChips(ui: Panel) {
  const client = await ui.find({ key: 'controls' })
  return (client?.props.props as ChipProps).groups.flat()
}
export async function pressChip(ui: Panel, key: string) {
  const chip = (await drawnChips(ui)).find(c => c.key === key)
  expect(chip).toBeDefined()
  if (chip) await ui.key({ key: chip.hotkey, in: 'controls' })
}
export async function expectBalance(ui: Panel, value: string) {
  const text = (await ui.find({ key: 'balance' }))?.text
  expect([balancePixels(value).join('\n'), balancePixels(value, 2).join('\n')]).toContain(text)
}
