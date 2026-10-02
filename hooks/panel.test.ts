import { drawnChips, expectBalance, pressChip } from './ui-test-helpers'
import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderPropsOf } from 'claude-code'
import type { Hand } from '../types'
import { fmt } from './slot'

const PLUGIN = 'gambling-with-claude-code'
const props = (bodyColumns: number): RenderPropsOf['Pane'] => ({
  title: 'TOKEN GAMBLE', isFocused: true, bodyColumns, placement: 'inline',
  scroll: { offset: 0, bodyRows: 50 }, view: {},
})
const COMMAND = { command: 'casino', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 80 } }
const memory = (on: On, entries: Record<string, unknown> = {}, debug?: string) => {
  mock.env(on, debug === undefined ? {} : { GWCC_DEBUG: debug })
  on('store.get', (_, e) => ({ value: entries[e.key] }))
  on('store.set', (_, e) => { entries[e.key] = JSON.parse(JSON.stringify(e.value)); return { value: undefined } })
  return entries
}
const TODAY = { total: 1000, date: '2026-10-02', midnight: 100000 }

const inputFixture = (on: On, entries: Record<string, unknown> = {}, debug?: string) => {
  const ledger = memory(on, entries, debug), clock = mock.clock(on)
  on('ui.open', (_, e) => {
    expect(e).toMatchObject({ focus: true, closeOnEscape: true, holdToasts: true, columns: 88, rows: 40 })
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.blit', () => ({ value: {} }))
  on('audio.play', () => ({ deny: 'Без звука в тесте' }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(TODAY), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  return { ledger, clock }
}

test('ошибка счётчика: команда сообщает отказ и не открывает пустое казино', async ($, on) => {
  memory(on)
  mock.clock(on)
  let opened = false
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'fixture', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('ui.open', () => { opened = true; return { value: { isPlaced: true } } })
  const result = await $.command.run(COMMAND)
  expect(result.text).toContain('Казино не открылось')
  expect(opened).toBe(false)
})

test('панель: три вкладки, общая ставка, уникальные хоткеи и компактный Raster', async ($, on) => {
  const ledger = memory(on)
  mock.clock(on)
  on('ui.open', (_, e) => {
    expect(e).toMatchObject({ focus: true, closeOnEscape: true, holdToasts: true })
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.blit', () => ({ value: {} }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(TODAY), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('audio.play', () => ({ deny: 'Без звука в тесте' }))
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props(64) })
  await expectBalance(ui, '1.0K')
  expect(await ui.find({ key: 'debug-special', in: 'controls' })).toBeUndefined()
  expect(await ui.find({ key: 'debug-win', in: 'controls' })).toBeUndefined()
  expect(await ui.find({ key: 'debug-lose', in: 'controls' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Все кнопки кликаются' })).toBeUndefined()
  await pressChip(ui, 'frac-2')
  expect((await ui.find({ key: 'statistics' }))?.text).toContain('ставка    250')
  await pressChip(ui, 'tab-roulette')
  expect(await ui.find({ key: 'roll', in: 'controls' })).toBeDefined()
  await pressChip(ui, 'number-prev')
  expect((await ui.find({ key: 'number', in: 'controls' }))?.text).toContain('36')
  await pressChip(ui, 'number-next')
  expect((await ui.find({ key: 'number', in: 'controls' }))?.text).toContain('0')
  for (const game of ['slot', 'roulette', 'blackjack']) {
    await pressChip(ui, `tab-${game}`)
    const keys = (await drawnChips(ui)).map(c => c.hotkey)
    expect(new Set(keys).size).toBe(keys.length)
  }
  for (const width of [24, 40, 68, 90, 200]) {
    await ui.redraw(props(width))
    expect((await ui.find({ key: 'stage' }))?.props.columns).toBe(Math.min(88, width))
  }
  await pressChip(ui, 'close')
  await ui.unmount()
})

for (const scenario of [
  { game: 'slot', outcome: 'special', hotkey: 't', delta: 49000 },
  { game: 'slot', outcome: 'win', hotkey: 'y', delta: 4000 },
  { game: 'slot', outcome: 'lose', hotkey: 'v', delta: -1000 },
  { game: 'roulette', outcome: 'win', hotkey: 't', delta: 1000 },
  { game: 'roulette', outcome: 'lose', hotkey: 'v', delta: -1000 },
  { game: 'blackjack', outcome: 'special', hotkey: 't', delta: 1500 },
  { game: 'blackjack', outcome: 'win', hotkey: 'y', delta: 1000 },
  { game: 'blackjack', outcome: 'lose', hotkey: 'v', delta: -1000 },
] as const) test(`GWCC_DEBUG=1: ${scenario.game}/${scenario.outcome}, анимация и изоляция кошелька`, async ($, on) => {
  const real = { net: 250, hand: null }
  const ledger = memory(on, { 'day:2026-10-02': real }, '1')
  const clock = mock.clock(on), blits: string[] = []
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.blit', (_, e) => { if ('cells' in e) blits.push(e.cells); return { value: {} } })
  on('audio.play', () => ({ deny: 'Без звука в тесте' }))
  // Отладка воспроизводится даже если сегодня не было потрачено ни одного токена.
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify({ ...TODAY, total: 0 }), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  expect((await $.command.run(COMMAND)).text).toContain('Казино открыто')
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props(90) })
  await expectBalance(ui, '10.0K')
  await pressChip(ui, `tab-${scenario.game}`)
  const key = `debug-${scenario.outcome}`
  expect((await drawnChips(ui)).find(c => c.key === key)?.hotkey).toBe(scenario.hotkey)
  const keys = (await drawnChips(ui)).map(c => c.hotkey)
  expect(new Set(keys).size).toBe(keys.length)
  await pressChip(ui, key)
  const pending = JSON.stringify(ledger['debug:day:2026-10-02'])
  await pressChip(ui, key)
  expect(JSON.stringify(ledger['debug:day:2026-10-02'])).toBe(pending)
  await clock.advance(8000)
  expect(ledger['debug:day:2026-10-02']).toEqual({ v: 1, net: scenario.delta, hand: null })
  expect(ledger['day:2026-10-02']).toEqual(real)
  await expectBalance(ui, `${fmt(10000 + scenario.delta)}`)
  expect(blits.length).toBeGreaterThan(40)
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('GWCC_DEBUG=0: отладка скрыта и восстановлен обычный кошелёк', async ($, on) => {
  memory(on, { 'day:2026-10-02': { net: 250, hand: null }, 'debug:day:2026-10-02': { net: 49000, hand: null } }, '0')
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(TODAY), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props(90) })
  await expectBalance(ui, '1.3K')
  expect(await ui.find({ key: 'debug-special', in: 'controls' })).toBeUndefined()
  expect(await ui.find({ key: 'debug-win', in: 'controls' })).toBeUndefined()
  expect(await ui.find({ key: 'debug-lose', in: 'controls' })).toBeUndefined()
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('отладка: проигрыш ALL IN не мешает повторить следующий эффект', async ($, on) => {
  const ledger = memory(on, {}, '1')
  const clock = mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.blit', () => ({ value: {} }))
  on('audio.play', () => ({ deny: 'Без звука в тесте' }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(TODAY), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props(90) })
  await pressChip(ui, 'frac-4')
  await pressChip(ui, 'debug-lose')
  await clock.advance(3000)
  await expectBalance(ui, '0')
  await pressChip(ui, 'debug-special')
  await clock.advance(6000)
  expect(ledger['debug:day:2026-10-02']).toEqual({ v: 1, net: 490000, hand: null })
  expect(ledger['day:2026-10-02']).toBeUndefined()
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('кошелёк: восстановление из store, повторное открытие и новый день', async ($, on) => {
  const ledger = memory(on, { 'day:2026-10-02': { net: 250, hand: null } })
  const clock = mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.blit', () => ({ value: {} }))
  let today = TODAY
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(today), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props(64) })
  await expectBalance(ui, '1.3K')
  await $.command.run(COMMAND)
  await expectBalance(ui, '1.3K')
  today = { total: 7, date: '2026-10-03', midnight: 200000 }
  await clock.advance(100000)
  await expectBalance(ui, '7')
  expect(ledger['day:2026-10-02']).toMatchObject({ net: 250 })
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('полночь во время хода дилера: выплата остаётся во вчерашнем кошельке', async ($, on) => {
  const hand: Hand = {
    player: [{ rank: 10, suit: '♠' }, { rank: 9, suit: '♥' }],
    dealer: [{ rank: 10, suit: '♦' }, { rank: 6, suit: '♣' }],
    deck: [{ rank: 10, suit: '♠' }], bet: 100, doubled: false, status: 'player',
  }
  const ledger = memory(on, { 'day:2026-10-02': { net: -100, hand } })
  const clock = mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.blit', () => ({ value: {} }))
  on('audio.play', () => ({ deny: 'Без звука в тесте' }))
  on('process.run', () => ({ value: {
    exitCode: 0, stdout: JSON.stringify(clock.now() < 400 ? { ...TODAY, midnight: 400 } :
      { total: 5, date: '2026-10-03', midnight: 100000 }), stderr: '', isStdoutTruncated: false, isStderrTruncated: false,
  } }))
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props(40) })
  await pressChip(ui, 'stand')
  await clock.advance(6000)
  expect(ledger['day:2026-10-02']).toEqual({ v: 1, net: 100, hand: null })
  await expectBalance(ui, '5')
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('раздача из панели и отказ double без второй ставки', async ($, on) => {
  const ledger = memory(on)
  const clock = mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.blit', () => ({ value: {} }))
  on('audio.play', () => ({ deny: 'Без звука в тесте' }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(TODAY), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props(32) })
  await pressChip(ui, 'tab-blackjack')
  await pressChip(ui, 'frac-4')
  await pressChip(ui, 'deal')
  expect(ledger['day:2026-10-02']).toMatchObject({ net: -1000, hand: { bet: 1000, status: 'player' } })
  const started = ledger['day:2026-10-02'] as { hand: Hand }
  expect(started.hand.player).toHaveLength(2)
  expect(started.hand.dealer).toHaveLength(2)
  await clock.advance(1000)
  if (await ui.find({ key: 'double', in: 'controls' })) {
    await pressChip(ui, 'double')
    expect(ledger['day:2026-10-02']).toMatchObject({ net: -1000, hand: { bet: 1000, doubled: false } })
    await pressChip(ui, 'stand')
  }
  await clock.advance(5000)
  expect(ledger['day:2026-10-02']).toMatchObject({ hand: null })
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('21: восстановление руки, double одной кнопкой, единственная выплата', async ($, on) => {
  const hand: Hand = {
    player: [{ rank: 5, suit: '♠' }, { rank: 6, suit: '♥' }],
    dealer: [{ rank: 10, suit: '♦' }, { rank: 7, suit: '♣' }],
    deck: [{ rank: 10, suit: '♠' }], bet: 100, doubled: false, status: 'player',
  }
  const ledger = memory(on, { 'day:2026-10-02': { net: -100, hand } })
  const clock = mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.blit', () => ({ value: {} }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(TODAY), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('audio.play', () => ({ deny: 'Без звука в тесте' }))
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props(64) })
  expect(await ui.find({ key: 'double', in: 'controls' })).toBeDefined()
  await pressChip(ui, 'tab-slot')
  expect(await ui.find({ key: 'double', in: 'controls' })).toBeDefined()
  await pressChip(ui, 'double')
  await ui.post({ control: 'deal' }, { in: 'controls' })
  expect(ledger['day:2026-10-02']).toMatchObject({ net: -200, hand: { bet: 200, doubled: true } })
  await clock.advance(4000)
  expect(ledger['day:2026-10-02']).toEqual({ v: 1, net: 200, hand: null })
  await $.command.run(COMMAND)
  expect(ledger['day:2026-10-02']).toEqual({ v: 1, net: 200, hand: null })
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('автоматические игры: закрытие и повторное открытие не отменяют результат', async ($, on) => {
  const ledger = memory(on)
  const clock = mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.blit', () => ({ value: {} }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(TODAY), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('audio.play', () => ({ deny: 'Без звука в тесте' }))
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props(64) })
  await pressChip(ui, 'spin')
  const settled = ledger['day:2026-10-02']
  await pressChip(ui, 'spin')
  expect(ledger['day:2026-10-02']).toEqual(settled)
  await pressChip(ui, 'close')
  await clock.advance(5000)
  expect(ledger['day:2026-10-02']).toEqual(settled)
  await $.command.run(COMMAND)
  expect(await ui.find({ key: 'balance' })).toBeDefined()
  await pressChip(ui, 'tab-roulette')
  await pressChip(ui, 'roll')
  const rouletteSettled = ledger['day:2026-10-02']
  await $.command.run(COMMAND)
  expect(ledger['day:2026-10-02']).toEqual(rouletteSettled)
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('ввод: мост диалога до клика и Client.onKey выбирают те же жетоны', async ($, on) => {
  inputFixture(on)
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props(200) })
  expect((await ui.find({ key: 'hotkeys' }))?.props).toMatchObject({ width: 0, height: 0, overflow: 'hidden' })
  await ui.press({ key: 'frac-2' })
  expect((await ui.find({ key: 'statistics' }))?.text).toContain('ставка    250')
  expect((await ui.find({ key: 'frac-2', in: 'controls' }))?.text).toContain('┏━━━┓')
  expect((await ui.findAll({ type: 'Text', text: '25%', in: 'controls' }))[0]?.props).toMatchObject({ bold: true, dimColor: false })
  await ui.key({ key: '3', in: 'controls' })
  expect((await ui.find({ key: 'statistics' }))?.text).toContain('ставка    500')
  await ui.key({ key: '2', ctrl: true, in: 'controls' })
  await ui.key({ key: '2', meta: true, in: 'controls' })
  expect((await ui.find({ key: 'statistics' }))?.text).toContain('ставка    500')
  await ui.press({ key: 'tab-roulette' })
  for (const [hotkey, key] of [['r', 'red'], ['b', 'black'], ['e', 'even'], ['o', 'odd'], ['l', 'low'], ['u', 'high'],
    ['a', 'dozen1'], ['d', 'dozen2'], ['f', 'dozen3'], ['n', 'number']] as const) {
    await ui.key({ key: hotkey, in: 'controls' })
    expect((await drawnChips(ui)).find(c => c.key === key)?.selected).toBe(true)
  }
  await ui.key({ key: 'j', in: 'controls' })
  expect((await ui.find({ key: 'number', in: 'controls' }))?.text).toContain('№36')
  await ui.key({ key: 'k', in: 'controls' })
  expect((await ui.find({ key: 'number', in: 'controls' }))?.text).toContain('№0')
  await ui.key({ key: 'q', in: 'controls' })
  await ui.unmount()
})

test('мышь: клики по жетонам, границы и перенос после resize', async ($, on) => {
  inputFixture(on)
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props(88) })
  await ui.pointer({ type: 'down', x: 8, y: 4, button: 'right', in: 'controls' })
  expect((await ui.find({ key: 'statistics' }))?.text).toContain('ставка    100')
  await ui.pointer({ type: 'down', x: 8, y: 4, button: 'left', in: 'controls' })
  expect((await ui.find({ key: 'statistics' }))?.text).toContain('ставка    250')
  await ui.pointer({ type: 'up', x: 14, y: 4, button: 'left', in: 'controls' })
  await ui.pointer({ type: 'down', x: -1, y: 4, button: 'left', in: 'controls' })
  expect((await ui.find({ key: 'statistics' }))?.text).toContain('ставка    250')
  await ui.resize({ columns: 24, rows: 30, in: 'controls' })
  const next = await ui.find({ key: 'frac-3', in: 'controls' })
  expect(Number(next?.props.left) + Number(next?.props.width)).toBeLessThanOrEqual(24)
  await ui.pointer({ type: 'down', x: Number(next?.props.left) + 1, y: Number(next?.props.top) + 1, button: 'left', in: 'controls' })
  expect((await ui.find({ key: 'statistics' }))?.text).toContain('ставка    500')
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('блокировка: клавиши, мышь, мост и устаревший post не меняют активный раунд', async ($, on) => {
  const { ledger } = inputFixture(on, {}, '1')
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props(88) })
  await ui.key({ key: 'y', in: 'controls' })
  const pending = JSON.stringify(ledger)
  expect((await ui.findAll({ type: 'Text', text: '25%', in: 'controls' }))[0]?.props.dimColor).toBe(true)
  await ui.key({ key: '2', in: 'controls' })
  await ui.pointer({ type: 'down', x: 8, y: 4, button: 'left', in: 'controls' })
  await ui.press({ key: 'frac-2' })
  await ui.post({ control: 'frac-2' }, { in: 'controls' })
  await ui.post({ control: 'debug-special' }, { in: 'controls' })
  await ui.post({ control: 'bogus' }, { in: 'controls' })
  await ui.post({ control: 2 }, { in: 'controls' })
  expect((await drawnChips(ui)).find(c => c.key === 'frac-1')?.selected).toBe(true)
  expect(JSON.stringify(ledger)).toBe(pending)
  await ui.key({ key: 'q', in: 'controls' })
  await ui.unmount()
})

test('21: ЕЩЁ через Client, запрещённый DOUBLE и ХВАТИТ через мост', async ($, on) => {
  const hand: Hand = {
    player: [{ rank: 5, suit: '♠' }, { rank: 6, suit: '♥' }],
    dealer: [{ rank: 10, suit: '♦' }, { rank: 7, suit: '♣' }],
    deck: [{ rank: 5, suit: '♠' }], bet: 100, doubled: false, status: 'player',
  }
  const { ledger, clock } = inputFixture(on, { 'day:2026-10-02': { net: -100, hand } })
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props(88) })
  await ui.key({ key: 'h', in: 'controls' })
  await clock.advance(360)
  const pending = JSON.stringify(ledger)
  expect((await drawnChips(ui)).find(c => c.key === 'double')?.disabled).toBe(true)
  await ui.key({ key: 'd', in: 'controls' })
  await ui.press({ key: 'double' })
  expect(JSON.stringify(ledger)).toBe(pending)
  await ui.press({ key: 'stand' })
  await clock.advance(4000)
  expect(ledger['day:2026-10-02']).toMatchObject({ net: -100, hand: null })
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('банкрот: шутка на табло и приглушённый SPIN, без подсказок и кнопок отладки', async ($, on) => {
  const { ledger } = inputFixture(on, { 'day:2026-10-02': { net: -1000, hand: null } })
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props(88) })
  const pending = JSON.stringify(ledger)
  const stats = (await ui.find({ key: 'statistics' }))?.text
  expect(stats).toContain('ALL OUT. Кэш пуст.')
  expect(stats).not.toContain('ставка')
  expect((await ui.findAll({ type: 'Text', text: 'SPIN', in: 'controls' }))[0]?.props.dimColor).toBe(true)
  await ui.key({ key: 's', in: 'controls' })
  await ui.press({ key: 'spin' })
  await ui.post({ control: 'debug-win' }, { in: 'controls' })
  expect(JSON.stringify(ledger)).toBe(pending)
  expect(await ui.find({ key: 'debug-win', in: 'controls' })).toBeUndefined()
  const text = await ui.drawn()
  expect(JSON.stringify(text)).not.toContain('Следующая ставка')
  expect(JSON.stringify(text)).not.toContain('Double:')
  expect(JSON.stringify(text)).not.toContain('Зеро проигрывает')
  await pressChip(ui, 'close')
  await ui.unmount()
})
