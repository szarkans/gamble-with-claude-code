import { expect } from 'claude-code/testing'
import type { Mounted } from 'claude-code/testing'
import type { RenderNode } from 'claude-code'
import type { ChipProps } from './chips'
import { balancePixels } from './glyphs'

type Panel = Mounted<'terminal', 'Pane'>

// Измеряем дерево hook + реальные деревья Client, а не формулу компоновщика.
export async function renderedLayout(ui: Panel) {
  const rowsOf = async (node: RenderNode): Promise<number> => {
    if (typeof node === 'string') return node.split('\n').length
    if (node.type === 'Client') return typeof node.props.height === 'number' ? node.props.height : rowsOf(await ui.drawn({ in: node.props.key }))
    if (node.type === 'Raster') return node.props.rows
    if (node.type === 'Text') return (node.children ?? []).filter(c => typeof c === 'string').join('').split('\n').length
    if (node.type !== 'Box') throw new Error(`Неизмеренный элемент: ${node.type}`)
    const p = node.props
    if (p.height === 0 || p.display === 'none') return 0
    const children = node.children ?? []
    const flow = children.filter(c => typeof c === 'string' || c.type !== 'Box' || c.props.position !== 'absolute')
    const sizes = await Promise.all(flow.map(rowsOf))
    const column = p.flexDirection === 'column'
    const gap = (column ? p.rowGap : p.columnGap) ?? p.gap ?? 0
    const content = column ? sizes.reduce((sum, n) => sum + n, 0) + gap * Math.max(0, sizes.length - 1) : Math.max(0, ...sizes)
    const absolute = await Promise.all(children.filter(c => typeof c !== 'string' && c.type === 'Box' && c.props.position === 'absolute')
      .map(async c => typeof c !== 'string' && c.type === 'Box' ? (c.props.top ?? 0) + await rowsOf(c) : 0))
    const padding = (p.paddingTop ?? p.paddingY ?? p.padding ?? 0) + (p.paddingBottom ?? p.paddingY ?? p.padding ?? 0)
    return Math.max(typeof p.height === 'number' ? p.height : 0,
      Math.max(content, ...absolute) + padding + (p.borderStyle ? 2 : 0))
  }
  const tree = await ui.drawn()
  const children = 'children' in tree ? tree.children ?? [] : []
  let controlsTop = 0
  for (const child of children) {
    if (typeof child !== 'string' && child.type === 'Client' && child.props.key === 'controls') break
    controlsTop += await rowsOf(child)
  }
  return { rows: await rowsOf(tree), controlsTop }
}
export async function drawnChips(ui: Panel) {
  const clients = await Promise.all(['navigation', 'controls'].map(key => ui.find({ key })))
  return clients.flatMap(client => (client?.props.props as ChipProps).groups.flatMap(g => g.chips))
}
export async function pressChip(ui: Panel, key: string) {
  const chip = (await drawnChips(ui)).find(c => c.key === key)
  expect(chip).toBeDefined()
  if (chip) await ui.key({ key: chip.hotkey, in: chip.intent.kind === 'game' || chip.key === 'close' ? 'navigation' : 'controls' })
}
export async function expectBalance(ui: Panel, value: string) {
  const text = (await ui.find({ key: 'balance' }))?.text
  expect([balancePixels(value).join('\n'), balancePixels(value, 2).join('\n')]).toContain(text)
}
