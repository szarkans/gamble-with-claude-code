import { drawnChips, expectBalance, pressChip } from './ui-test-helpers'
import { expect, mock, test } from 'claude-code/testing'
import type { On, ProcessRunResult, RenderPropsOf } from 'claude-code'
import type { Earned, Hand } from '../types'

const PLUGIN = 'gambling-with-claude-code'
const COMMAND = { command: 'casino', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 80 } }
const TODAY = { total: 1000, date: '2026-10-02', midnight: 100000 }
const props = (bodyColumns = 90): RenderPropsOf['Pane'] => ({
  title: 'TOKEN GAMBLE', isFocused: true, bodyColumns, placement: 'inline',
  scroll: { offset: 0, bodyRows: 50 }, view: {},
})
type Fixtures = {
  debug?: string
  existingPane?: boolean
  read?: (value: unknown) => Promise<unknown>
  run?: (argv: readonly string[]) => ProcessRunResult | Promise<ProcessRunResult>
  today?: () => Earned
  blit?: (cells: string) => void
  audio?: (asset: string) => void
}
const result = (today = TODAY): ProcessRunResult => ({ exitCode: 0, stdout: JSON.stringify(today), stderr: '', isStdoutTruncated: false, isStderrTruncated: false })
const ready = (on: On, ledger: Record<string, unknown> = {}, fixtures: Fixtures = {}) => {
  mock.env(on, fixtures.debug ? { GWCC_DEBUG: fixtures.debug } : {})
  const clock = mock.clock(on)
  on('store.get', async (_, e) => ({ value: fixtures.read ? await fixtures.read(ledger[e.key]) : ledger[e.key] }))
  on('store.set', (_, e) => {
    ledger[e.key] = JSON.parse(JSON.stringify(e.value))
    return { value: undefined }
  })
  let paneOpen = fixtures.existingPane ?? false
  on('ui.open', () => { paneOpen = true; return { value: { isPlaced: true } } })
  on('ui.close', () => { paneOpen = false; return { value: undefined } })
  on('ui.panes', () => ({ value: paneOpen ? [{ id: PLUGIN, title: 'TOKEN GAMBLE', isShown: true, isFocused: true, isPlaced: true }] : [] }))
  on('ui.blit', (_, e) => { if ('cells' in e) fixtures.blit?.(e.cells); return { value: {} } })
  on('audio.play', (_, e) => { if (e.clip.asset) fixtures.audio?.(e.clip.asset); return { deny: 'Без звука в тесте' } })
  on('process.run', async (_, e) => ({ value: fixtures.run ? await fixtures.run(e.argv) : result(fixtures.today?.() ?? TODAY) }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  return clock
}

for (const scenario of [
  { game: 'slot', outcome: 'win', time: 200, delta: 4000 },
  { game: 'slot', outcome: 'lose', time: 1640, delta: -1000 },
  { game: 'slot', outcome: 'win', time: 1640, delta: 4000 },
  { game: 'roulette', outcome: 'win', time: 200, delta: 1000 },
  { game: 'roulette', outcome: 'lose', time: 2840, delta: -1000 },
  { game: 'roulette', outcome: 'win', time: 2840, delta: 1000 },
  { game: 'roulette', outcome: 'lose', time: 3560, delta: -1000 },
  { game: 'roulette', outcome: 'win', time: 3560, delta: 1000 },
  { game: 'blackjack', outcome: 'special', time: 1520, delta: 1500 },
  { game: 'blackjack', outcome: 'win', time: 1520, delta: 1000 },
  { game: 'blackjack', outcome: 'lose', time: 1880, delta: -1000 },
] as const) test(`смена вкладки во время шоу: ${scenario.game}/${scenario.outcome} на ${scenario.time} мс, выплата ровно один раз`, async ($, on) => {
  const real = { v: 1, net: 250, hand: null }
  const ledger: Record<string, unknown> = { 'day:2026-10-02': real }
  const blits: string[] = []
  const clock = ready(on, ledger, { debug: '1', blit: cells => { blits.push(cells) } })
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props() })
  await pressChip(ui, `tab-${scenario.game}`)
  await pressChip(ui, `debug-${scenario.outcome}`)
  await clock.advance(scenario.time)
  expect((await drawnChips(ui)).find(c => c.key === 'frac-1')?.disabled).toBe(true)
  expect((await drawnChips(ui)).filter(c => c.intent.kind === 'game').every(c => !c.disabled)).toBe(true)
  const paid = JSON.stringify(ledger), frames = blits.length
  const target = scenario.game === 'slot' ? 'tab-roulette' : 'tab-slot'
  if (scenario.time === 200) await ui.key({ key: target === 'tab-slot' ? 'z' : 'x', in: 'controls' })
  else if (scenario.time === 2840) {
    const tab = await ui.find({ key: target, in: 'navigation' })
    await ui.pointer({ type: 'down', x: Number(tab?.props.left) + 1, y: 1, button: 'left', in: 'navigation' })
  } else await ui.press({ key: target })
  expect((await drawnChips(ui)).find(c => c.key === target)?.selected).toBe(true)
  expect((await drawnChips(ui)).find(c => c.key === 'frac-1')?.disabled).toBe(false)
  await expectBalance(ui, scenario.delta === -1000 ? '9.0K' : scenario.delta === 4000 ? '14.0K' : scenario.delta === 1500 ? '11.5K' : '11.0K')
  await clock.advance(8000)
  expect(blits.length).toBe(frames)
  expect(JSON.stringify(ledger)).toBe(paid)
  expect(ledger['debug:day:2026-10-02']).toEqual({ v: 1, net: scenario.delta, hand: null })
  expect(ledger['day:2026-10-02']).toEqual(real)
  await $.command.run(COMMAND)
  await clock.advance(8000)
  expect(JSON.stringify(ledger)).toBe(paid)
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('21: вкладки блокируются при раздаче, ходе игрока и ходе дилера; рука доигрывается', async ($, on) => {
  const hand: Hand = {
    player: [{ rank: 5, suit: '♠' }, { rank: 6, suit: '♥' }],
    dealer: [{ rank: 10, suit: '♦' }, { rank: 7, suit: '♣' }],
    deck: [{ rank: 10, suit: '♠' }], bet: 100, doubled: false, status: 'player',
  }
  const ledger: Record<string, unknown> = { 'day:2026-10-02': { v: 1, net: -100, hand } }
  const clock = ready(on, ledger)
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props() })
  const assertBlocked = async () => {
    const pending = JSON.stringify(ledger)
    expect((await drawnChips(ui)).filter(c => c.intent.kind === 'game').every(c => c.disabled)).toBe(true)
    await ui.key({ key: 'z', in: 'navigation' })
    await ui.press({ key: 'tab-slot' })
    await ui.post({ control: 'tab-slot' }, { in: 'navigation' })
    expect((await drawnChips(ui)).find(c => c.key === 'tab-blackjack')?.selected).toBe(true)
    expect(JSON.stringify(ledger)).toBe(pending)
  }
  await assertBlocked()
  await pressChip(ui, 'double')
  await clock.advance(200)
  await assertBlocked()
  await clock.advance(200)
  await assertBlocked()
  await clock.advance(8000)
  expect(ledger['day:2026-10-02']).toEqual({ v: 1, net: 200, hand: null })
  await pressChip(ui, 'tab-slot')
  expect((await drawnChips(ui)).find(c => c.key === 'tab-slot')?.selected).toBe(true)
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('вкладка не теряется, когда колбэк анимации ещё читает записанную выплату', async ($, on) => {
  const ledger: Record<string, unknown> = {}
  let armed = false, held = false
  let entered!: () => void, release!: () => void
  const reading = new Promise<void>(resolve => { entered = resolve })
  const released = new Promise<void>(resolve => { release = resolve })
  const clock = ready(on, ledger, { debug: '1', read: async value => {
    if (armed && !held) { held = true; entered(); await released }
    return value
  } })
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props() })
  await pressChip(ui, 'debug-win')
  armed = true
  const finishing = clock.advance(1600)
  await reading
  const choosing = ui.key({ key: 'x', in: 'navigation' })
  await clock.settle()
  release()
  await finishing
  await choosing
  expect((await drawnChips(ui)).find(c => c.key === 'tab-roulette')?.selected).toBe(true)
  await expectBalance(ui, '14.0K')
  await clock.advance(8000)
  expect(ledger['debug:day:2026-10-02']).toEqual({ v: 1, net: 4000, hand: null })
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('регрессия: натуральный блэкджек и два /casino платят один раз и сохраняют вкладку', async ($, on) => {
  const ledger: Record<string, unknown> = {}
  const clock = ready(on, ledger, { debug: '1' })
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props() })
  await pressChip(ui, 'tab-blackjack')
  await pressChip(ui, 'debug-special')
  await clock.advance(8000)
  expect(ledger['debug:day:2026-10-02']).toMatchObject({ net: 1500, hand: null })
  await pressChip(ui, 'tab-slot')
  for (let i = 0; i < 2; i++) {
    await $.command.run(COMMAND)
    await clock.advance(8000)
    expect(ledger['debug:day:2026-10-02']).toMatchObject({ net: 1500, hand: null })
    expect(await ui.find({ key: 'spin', in: 'controls' })).toBeDefined()
  }
  await pressChip(ui, 'close')
  await ui.unmount()
})

for (const interpreter of ['python3', 'python', 'py'] as const) test(`Python 3: ${interpreter} найден в PATH, запуск с -I`, async ($, on) => {
  const attempts: string[][] = []
  ready(on, {}, { run: argv => {
    attempts.push([...argv])
    if (argv[0] !== interpreter) throw new Error('ENOENT')
    return result()
  } })
  expect((await $.command.run(COMMAND)).text).toContain('Казино открыто')
  expect(attempts.map(argv => argv[0])).toEqual(interpreter === 'python3' ? ['python3'] : interpreter === 'python' ? ['python3', 'python'] : ['python3', 'python', 'py'])
  expect(attempts.every(argv => argv.includes('-I') && argv.at(-1)?.endsWith('/tools/count_today.py'))).toBe(true)
  if (interpreter === 'py') expect(attempts.at(-1)?.slice(0, 3)).toEqual(['py', '-3', '-I'])
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props() })
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('Python 3 отсутствует: панель объясняет, что установить', async ($, on) => {
  ready(on, {}, { run: () => { throw new Error('ENOENT') } })
  expect((await $.command.run(COMMAND)).text).toContain('Python 3')
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props() })
  expect((await ui.find({ type: 'Text', text: 'Нужен Python 3' }))?.text).toContain('py -3')
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('Windows: магазинный alias python3 и Python 2 не маскируют отсутствие Python 3', async ($, on) => {
  const calls: string[] = []
  ready(on, {}, { run: argv => {
    calls.push(argv[0]!)
    if (argv[0] === 'py') throw new Error('ENOENT')
    return { ...result(), exitCode: 2, stderr: argv[0] === 'python3' ? 'Python was not found; run without arguments to install from the Microsoft Store' : 'Unknown option: -I' }
  } })
  await $.command.run(COMMAND)
  expect(calls).toEqual(['python3', 'python', 'py'])
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props() })
  expect(await ui.find({ type: 'Text', text: 'Нужен Python 3' })).toBeDefined()
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('день неизвестной формы: /casino открывается с пустым кошельком', async ($, on) => {
  ready(on, { 'day:2026-10-02': { v: 99, net: 'obsolete', hand: { player: 'old' } } })
  expect((await $.command.run(COMMAND)).text).toContain('Казино открыто')
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props() })
  await expectBalance(ui, '1.0K')
  expect(await ui.find({ key: 'spin', in: 'controls' })).toBeDefined()
  await pressChip(ui, 'close')
  await ui.unmount()
})

for (const game of ['slot', 'roulette'] as const) test(`незаконченная рука: ${game} объясняет отказ в новой ставке`, async ($, on) => {
  const ledger: Record<string, unknown> = {}
  ready(on, ledger)
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props() })
  await pressChip(ui, `tab-${game}`)
  // Незаконченная рука появилась в store, пока панель показывала автоматическую игру.
  ledger['day:2026-10-02'] = { v: 1, net: -100, hand: {
    player: [{ rank: 5, suit: '♠' }, { rank: 6, suit: '♥' }],
    dealer: [{ rank: 10, suit: '♦' }, { rank: 7, suit: '♣' }],
    deck: [], bet: 100, doubled: false, status: 'player',
  } }
  const pending = JSON.stringify(ledger)
  await pressChip(ui, game === 'slot' ? 'spin' : 'roll')
  expect((await ui.find({ type: 'Text', text: 'Сначала закончи руку 21' }))?.text).toContain('merge')
  expect(JSON.stringify(ledger)).toBe(pending)
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('рулетка: щелчок следует смене ячейки между кадрами', async ($, on) => {
  const clicks: number[] = []
  const clock = ready(on, {}, { debug: '1', audio: asset => { if (asset === 'sounds/click.wav') clicks.push(clock.now()) } })
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props() })
  await pressChip(ui, 'tab-roulette')
  await pressChip(ui, 'debug-win')
  await clock.advance(500)
  expect(clicks.length).toBeGreaterThan(5)
  expect(clicks.some(t => t % 120 !== 0)).toBe(true)
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('ошибка расчёта в done: сообщение об API, сохранённая рука доступна для повтора', async ($, on) => {
  const hand: Hand = {
    player: [{ rank: 10, suit: '♠' }, { rank: 9, suit: '♥' }],
    dealer: [{ rank: 10, suit: '♦' }, { rank: 6, suit: '♣' }],
    deck: [], bet: 100, doubled: false, status: 'dealer',
  }
  const ledger: Record<string, unknown> = { 'day:2026-10-02': { v: 1, net: -100, hand } }
  const clock = ready(on, ledger)
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props() })
  await clock.advance(480)
  expect((await ui.find({ type: 'Text', text: 'Казино споткнулось о API' }))?.text).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Кадр выпал' })).toBeUndefined()
  expect(ledger['day:2026-10-02']).toMatchObject({ net: -100, hand: { status: 'dealer' } })
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('ошибка blit: сообщение про кадр, записанная автоматическая выплата не теряется', async ($, on) => {
  const ledger: Record<string, unknown> = {}
  const clock = ready(on, ledger, { debug: '1', blit: () => { throw new Error('synthetic draw failure') } })
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props() })
  await pressChip(ui, 'debug-win')
  await clock.advance(40)
  expect(await ui.find({ type: 'Text', text: 'Кадр выпал' })).toBeDefined()
  expect(ledger['debug:day:2026-10-02']).toEqual({ v: 1, net: 4000, hand: null })
  await $.command.run(COMMAND)
  await expectBalance(ui, '14.0K')
  await pressChip(ui, 'close')
  await ui.unmount()
})

for (const game of ['slot', 'roulette', 'blackjack'] as const) test(`session.start после reload: ${game}, кошелёк, ширина, отладка и новый опрос`, async ($, on) => {
  const ledger: Record<string, unknown> = { 'day:2026-10-02': { v: 1, net: 250, hand: null } }
  let today = TODAY
  const blits: string[] = []
  const clock = ready(on, ledger, { debug: '1', today: () => today, blit: cells => { blits.push(cells) } })
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props(40) })
  await pressChip(ui, `tab-${game}`)
  await pressChip(ui, 'debug-win')
  await clock.advance(game === 'blackjack' ? 1100 : 200)
  const before = JSON.parse(JSON.stringify(ledger))
  // Kit не заменяет среду модуля; повторяем ровно тот lifecycle, который движок вызывает при reload.
  await $.session.start({ cwd: '/fixture', surface: 'terminal', isInteractive: true })
  if (game !== 'blackjack') expect((await drawnChips(ui)).find(c => c.key === 'debug-win')?.disabled).toBe(false)
  await clock.advance(8000)
  expect(ledger['day:2026-10-02']).toEqual(before['day:2026-10-02'])
  expect(ledger['debug:day:2026-10-02']).toMatchObject({ net: game === 'slot' ? 4000 : 1000, hand: null })
  expect(await ui.find({ key: 'debug-win', in: 'controls' })).toBeDefined()
  await expectBalance(ui, game === 'slot' ? '14.0K' : '11.0K')
  await pressChip(ui, 'debug-win')
  await clock.advance(80)
  const stage = await ui.find({ key: 'stage' })
  expect(stage?.props.columns).toBe(40)
  expect(Uint8Array.fromBase64(blits.at(-1)!).length).toBe(40 * Number(stage?.props.rows) * 12)
  await clock.advance(8000)
  today = { total: 0, date: '2026-10-03', midnight: 200000 }
  await clock.advance(5000)
  await expectBalance(ui, '10.0K')
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('session.start после reload: рука игрока ждёт решения, закрытая панель не начинает опрос', async ($, on) => {
  let calls = 0
  const hand: Hand = {
    player: [{ rank: 5, suit: '♠' }, { rank: 6, suit: '♥' }],
    dealer: [{ rank: 10, suit: '♦' }, { rank: 7, suit: '♣' }],
    deck: [{ rank: 10, suit: '♠' }], bet: 100, doubled: false, status: 'player',
  }
  const ledger: Record<string, unknown> = { 'day:2026-10-02': { v: 1, net: -100, hand } }
  const clock = ready(on, ledger, { run: () => { calls++; return result() } })
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props() })
  await $.session.start({ cwd: '/fixture', surface: 'terminal', isInteractive: true })
  await clock.advance(5000)
  expect(ledger['day:2026-10-02']).toEqual({ v: 1, net: -100, hand })
  expect(await ui.find({ key: 'double', in: 'controls' })).toBeDefined()
  await pressChip(ui, 'close')
  await $.session.start({ cwd: '/fixture', surface: 'terminal', isInteractive: true })
  const stopped = calls
  await clock.advance(10000)
  expect(calls).toBe(stopped)
  await ui.unmount()
})

test('новая среда модуля: session.start находит открытую панель и продолжает отладочную руку без /casino', async ($, on) => {
  const hand: Hand = {
    player: [{ rank: 10, suit: '♠' }, { rank: 10, suit: '♥' }],
    dealer: [{ rank: 10, suit: '♦' }, { rank: 7, suit: '♣' }],
    deck: [], bet: 100, doubled: false, status: 'dealer',
  }
  const ledger: Record<string, unknown> = { 'debug:day:2026-10-02': { v: 1, net: -100, hand } }
  const blits: string[] = []
  const clock = ready(on, ledger, { debug: '1', existingPane: true, blit: cells => { blits.push(cells) } })
  // Мод загружается заново для каждого теста; движок уже хранит панель и ширину старой среды.
  on('state.get', { plugin: PLUGIN, key: 'columns' }, async (_, e, next) => {
    const reply = await next(e)
    if ('deny' in reply) return reply
    const held = reply.value
    return { value: held.value === undefined ? { ...held, value: { shape: 'v1', value: 32 } } : held }
  })
  await $.session.start({ cwd: '/fixture', surface: 'terminal', isInteractive: true })
  // До нового render ширина приходит из state; opened и debugging ещё никто не устанавливал через open.
  await clock.advance(40)
  expect(blits.length).toBeGreaterThan(0)
  expect(Uint8Array.fromBase64(blits[0]!).length).toBe(32 * 20 * 12)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props(32) })
  expect(await ui.find({ key: 'debug-win', in: 'controls' })).toBeDefined()
  await clock.advance(8000)
  expect(ledger['debug:day:2026-10-02']).toEqual({ v: 1, net: 100, hand: null })
  expect(ledger['day:2026-10-02']).toBeUndefined()
  await expectBalance(ui, '10.1K')
  await pressChip(ui, 'close')
  await ui.unmount()
})

test('регрессия: колбэк выплаты и /casino со старым снимком store не платят дважды', async ($, on) => {
  const hand: Hand = {
    player: [{ rank: 10, suit: '♠' }, { rank: 10, suit: '♥' }],
    dealer: [{ rank: 10, suit: '♦' }, { rank: 7, suit: '♣' }],
    deck: [], bet: 100, doubled: false, status: 'dealer',
  }
  const ledger: Record<string, unknown> = { 'day:2026-10-02': { v: 1, net: -100, hand } }
  let reads = 0, armed = false
  let entered!: () => void, releaseFinish!: () => void, releaseOpen!: () => void
  const settling = new Promise<void>(resolve => { entered = resolve })
  const finishReleased = new Promise<void>(resolve => { releaseFinish = resolve })
  const openReleased = new Promise<void>(resolve => { releaseOpen = resolve })
  const clock = ready(on, ledger, { read: async value => {
    const snapshot = value === undefined ? value : JSON.parse(JSON.stringify(value))
    if (armed && reads++ === 0) { entered(); await finishReleased }
    else if (armed && reads === 2) await openReleased
    return snapshot
  } })
  await $.command.run(COMMAND)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: props() })
  armed = true
  const finishing = clock.advance(480)
  await settling
  const reopening = $.command.run(COMMAND)
  await clock.settle()
  releaseFinish()
  await finishing
  releaseOpen()
  await reopening
  await clock.advance(8000)
  expect(ledger['day:2026-10-02']).toMatchObject({ net: 100, hand: null })
  await $.command.run(COMMAND)
  await clock.advance(8000)
  expect(ledger['day:2026-10-02']).toMatchObject({ net: 100, hand: null })
  await pressChip(ui, 'close')
  await ui.unmount()
})
