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
  expect((await ui.find({ type: 'Text', text: 'ФИШКИ:' }))?.text).toBe('ФИШКИ: 1.0K')
  expect(await ui.find({ key: 'debug-special' })).toBeUndefined()
  expect(await ui.find({ key: 'debug-win' })).toBeUndefined()
  expect(await ui.find({ key: 'debug-lose' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Все кнопки кликаются' })).toBeUndefined()
  await ui.press({ key: 'frac-2' })
  expect((await ui.find({ type: 'Text', text: 'Следующая ставка:' }))?.text).toBe('Следующая ставка: 250')
  await ui.press({ key: 'tab-roulette' })
  expect(await ui.find({ key: 'roll' })).toBeDefined()
  await ui.press({ key: 'number-prev' })
  expect((await ui.find({ key: 'number' }))?.text).toContain('36')
  await ui.press({ key: 'number-next' })
  expect((await ui.find({ key: 'number' }))?.text).toContain('0')
  for (const game of ['slot', 'roulette', 'blackjack']) {
    await ui.press({ key: `tab-${game}` })
    const keys = (await ui.findAll({ type: 'Button' })).map(b => b.props.hotkey)
    expect(new Set(keys).size).toBe(keys.length)
  }
  for (const width of [24, 40, 68, 90, 200]) {
    await ui.redraw(props(width))
    expect((await ui.find({ key: 'stage' }))?.props.columns).toBe(width)
  }
  await ui.press({ key: 'close' })
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
  expect((await ui.find({ type: 'Text', text: 'ФИШКИ:' }))?.text).toBe('ФИШКИ: 10.0K')
  await ui.press({ key: `tab-${scenario.game}` })
  const key = `debug-${scenario.outcome}`
  expect((await ui.find({ key }))?.props.hotkey).toBe(scenario.hotkey)
  const keys = (await ui.findAll({ type: 'Button' })).map(b => b.props.hotkey)
  expect(new Set(keys).size).toBe(keys.length)
  await ui.press({ key })
  const pending = JSON.stringify(ledger['debug:day:2026-10-02'])
  await ui.press({ key })
  expect(JSON.stringify(ledger['debug:day:2026-10-02'])).toBe(pending)
  await clock.advance(8000)
  expect(ledger['debug:day:2026-10-02']).toEqual({ v: 1, net: scenario.delta, hand: null })
  expect(ledger['day:2026-10-02']).toEqual(real)
  expect((await ui.find({ type: 'Text', text: 'ФИШКИ:' }))?.text).toBe(`ФИШКИ: ${fmt(10000 + scenario.delta)}`)
  expect(blits.length).toBeGreaterThan(40)
  await ui.press({ key: 'close' })
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
  expect((await ui.find({ type: 'Text', text: 'ФИШКИ:' }))?.text).toBe('ФИШКИ: 1.3K')
  expect(await ui.find({ key: 'debug-special' })).toBeUndefined()
  expect(await ui.find({ key: 'debug-win' })).toBeUndefined()
  expect(await ui.find({ key: 'debug-lose' })).toBeUndefined()
  await ui.press({ key: 'close' })
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
  await ui.press({ key: 'frac-4' })
  await ui.press({ key: 'debug-lose' })
  await clock.advance(3000)
  expect((await ui.find({ type: 'Text', text: 'ФИШКИ:' }))?.text).toBe('ФИШКИ: 0')
  await ui.press({ key: 'debug-special' })
  await clock.advance(6000)
  expect(ledger['debug:day:2026-10-02']).toEqual({ v: 1, net: 490000, hand: null })
  expect(ledger['day:2026-10-02']).toBeUndefined()
  await ui.press({ key: 'close' })
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
  expect((await ui.find({ type: 'Text', text: 'ФИШКИ:' }))?.text).toBe('ФИШКИ: 1.3K')
  await $.command.run(COMMAND)
  expect((await ui.find({ type: 'Text', text: 'ФИШКИ:' }))?.text).toBe('ФИШКИ: 1.3K')
  today = { total: 7, date: '2026-10-03', midnight: 200000 }
  await clock.advance(100000)
  expect((await ui.find({ type: 'Text', text: 'ФИШКИ:' }))?.text).toBe('ФИШКИ: 7')
  expect(ledger['day:2026-10-02']).toMatchObject({ net: 250 })
  await ui.press({ key: 'close' })
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
  await ui.press({ key: 'stand' })
  await clock.advance(6000)
  expect(ledger['day:2026-10-02']).toEqual({ v: 1, net: 100, hand: null })
  expect((await ui.find({ type: 'Text', text: 'ФИШКИ:' }))?.text).toBe('ФИШКИ: 5')
  await ui.press({ key: 'close' })
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
  await ui.press({ key: 'tab-blackjack' })
  await ui.press({ key: 'frac-4' })
  await ui.press({ key: 'deal' })
  expect(ledger['day:2026-10-02']).toMatchObject({ net: -1000, hand: { bet: 1000, status: 'player' } })
  const started = ledger['day:2026-10-02'] as { hand: Hand }
  expect(started.hand.player).toHaveLength(2)
  expect(started.hand.dealer).toHaveLength(2)
  await clock.advance(1000)
  if (await ui.find({ key: 'double' })) {
    await ui.press({ key: 'double' })
    expect(ledger['day:2026-10-02']).toMatchObject({ net: -1000, hand: { bet: 1000, doubled: false } })
    await ui.press({ key: 'stand' })
  }
  await clock.advance(5000)
  expect(ledger['day:2026-10-02']).toMatchObject({ hand: null })
  await ui.press({ key: 'close' })
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
  expect(await ui.find({ key: 'double' })).toBeDefined()
  await ui.press({ key: 'tab-slot' })
  expect(await ui.find({ key: 'double' })).toBeDefined()
  await ui.press({ key: 'double' })
  await ui.press({ key: 'deal' })
  expect(ledger['day:2026-10-02']).toMatchObject({ net: -200, hand: { bet: 200, doubled: true } })
  await clock.advance(4000)
  expect(ledger['day:2026-10-02']).toEqual({ v: 1, net: 200, hand: null })
  await $.command.run(COMMAND)
  expect(ledger['day:2026-10-02']).toEqual({ v: 1, net: 200, hand: null })
  await ui.press({ key: 'close' })
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
  await ui.press({ key: 'spin' })
  const settled = ledger['day:2026-10-02']
  await ui.press({ key: 'spin' })
  expect(ledger['day:2026-10-02']).toEqual(settled)
  await ui.press({ key: 'close' })
  await clock.advance(5000)
  expect(ledger['day:2026-10-02']).toEqual(settled)
  await $.command.run(COMMAND)
  expect((await ui.find({ type: 'Text', text: 'ФИШКИ:' }))?.text).toContain('ФИШКИ:')
  await ui.press({ key: 'tab-roulette' })
  await ui.press({ key: 'roll' })
  const rouletteSettled = ledger['day:2026-10-02']
  await $.command.run(COMMAND)
  expect(ledger['day:2026-10-02']).toEqual(rouletteSettled)
  await ui.press({ key: 'close' })
  await ui.unmount()
})
