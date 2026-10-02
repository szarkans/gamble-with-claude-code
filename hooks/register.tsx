import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Earned, Game, Hand, Phase, RouletteBet } from '../types'
import type { Host, Snapshot } from './host'
import { chooseFraction, chooseGame, chooseNumber, chooseRoulette, close, debugRound, isDebug, newHand, open, playHand, restore, roll, spin } from './controller'
import { renderPanel } from './panel'
import { chips } from './chips'
const PANE = 'gambling-with-claude-code'

const earned = atom({ plugin: 'gambling-with-claude-code', key: 'earned' } as const, { total: 0, date: '', midnight: 0 } as Earned, { shape: 'v1' })
const net = atom({ plugin: 'gambling-with-claude-code', key: 'net' } as const, 0, { shape: 'v1' })
const frac = atom({ plugin: 'gambling-with-claude-code', key: 'frac' } as const, 0.1, { shape: 'v1' })
const reels = atom({ plugin: 'gambling-with-claude-code', key: 'reels' } as const, [0, 1, 2], { shape: 'v1' })
const phase = atom({ plugin: 'gambling-with-claude-code', key: 'phase' } as const, 'idle' as Phase, { shape: 'v1' })
const msg = atom({ plugin: 'gambling-with-claude-code', key: 'msg' } as const, 'Гемблинг — это плохо. Как и --dangerously-skip-permissions.', { shape: 'v1' })
const game = atom({ plugin: 'gambling-with-claude-code', key: 'game' } as const, 'slot' as Game, { shape: 'v1' })
const rouletteBet = atom({ plugin: 'gambling-with-claude-code', key: 'rouletteBet' } as const, { kind: 'red' } as RouletteBet, { shape: 'v1' })
const rouletteNumber = atom({ plugin: 'gambling-with-claude-code', key: 'rouletteResult' } as const, 0, { shape: 'v1' })
const roulettePick = atom({ plugin: 'gambling-with-claude-code', key: 'roulettePick' } as const, 0, { shape: 'v1' })
const hand = atom({ plugin: 'gambling-with-claude-code', key: 'hand' } as const, null as Hand | null, { shape: 'v1' })
const columns = atom({ plugin: 'gambling-with-claude-code', key: 'columns' } as const, 64, { shape: 'v1' })

async function snapshot($: EngineInterface): Promise<Snapshot> {
  return {
    earned: await read($, earned), net: await read($, net), frac: await read($, frac), reels: await read($, reels),
    phase: await read($, phase), msg: await read($, msg), game: await read($, game),
    rouletteBet: await read($, rouletteBet), rouletteNumber: await read($, rouletteNumber), roulettePick: await read($, roulettePick), hand: await read($, hand),
  }
}

async function activate($: EngineInterface, key: string) {
  // Оба пути ввода проверяют свежий снимок; Client и клавиатурный мост могут отстать от него.
  const control = chips(await snapshot($), isDebug()).flatMap(g => g.chips).find(c => c.key === key)
  if (!control || control.disabled) return
  const api = host($), intent = control.intent
  switch (intent.kind) {
    case 'game': await chooseGame(api, intent.value); break
    case 'fraction': await chooseFraction(api, intent.value); break
    case 'roulette': await chooseRoulette(api, intent.value); break
    case 'number': await chooseNumber(api, intent.step); break
    case 'debug': await debugRound(api, intent.value); break
    case 'spin': await spin(api); break
    case 'roll': await roll(api); break
    case 'deal': await newHand(api); break
    case 'hit': case 'stand': case 'double': await playHand(api, intent.kind); break
    case 'close': await $.ui.close({ id: PANE }); break
  }
}

// Все обращения к $ видны валидатору; логика и отрисовка живут отдельно.
function host($: EngineInterface): Host {
  return {
    earned: { get: () => read($, earned), set: v => update($, earned, () => v) },
    net: { get: () => read($, net), set: v => update($, net, () => v) },
    frac: { get: () => read($, frac), set: v => update($, frac, () => v) },
    reels: { get: () => read($, reels), set: v => update($, reels, () => v) },
    phase: { get: () => read($, phase), set: v => update($, phase, () => v) },
    msg: { get: () => read($, msg), set: v => update($, msg, () => v) },
    game: { get: () => read($, game), set: v => update($, game, () => v) },
    rouletteBet: { get: () => read($, rouletteBet), set: v => update($, rouletteBet, () => v) },
    rouletteNumber: { get: () => read($, rouletteNumber), set: v => update($, rouletteNumber, () => v) },
    roulettePick: { get: () => read($, roulettePick), set: v => update($, roulettePick, () => v) },
    hand: { get: () => read($, hand), set: v => update($, hand, () => v) },
    columns: { get: () => read($, columns), set: v => update($, columns, () => v) },
    countTokens: async () => {
      let failed
      for (const command of [['python3'], ['python'], ['py', '-3']]) {
        try {
          const result = await $.process.run([...command, '-I', `${$.plugin.root}/tools/count_today.py`], { timeoutMs: 15000 })
          if (result.exitCode === 0) return result
          // Windows App Execution Alias и Python 2 могут запуститься, но Python 3 за ними нет.
          if (result.exitCode === 9009 || /Python was not found|No installed Python|Unknown option: -I/i.test(result.stderr)) continue
          failed = result
        } catch { /* Не установлен или недоступен: пробуем следующий запуск. */ }
      }
      if (failed) return failed
      throw new Error('Нужен Python 3 в PATH: python3, python или py -3. Без него фишки не посчитать.')
    },
    debugFlag: () => $.env.get('GWCC_DEBUG'),
    storeGet: key => $.store.get(key), storeSet: (key, value) => $.store.set(key, value),
    now: () => $.clock.now(), every: (ms, fn) => $.clock.every(ms, fn),
    paneIsOpen: async () => (await $.ui.panes()).some(pane => pane.id === PANE),
    play: name => $.audio.play({ asset: `sounds/${name}.wav` }),
    blit: cells => $.ui.blit({ requestId: PANE, key: 'stage', cells }),
    openPane: () => $.ui.open({ id: PANE, title: 'TOKEN GAMBLE', focus: true, closeOnEscape: true, holdToasts: true, columns: 88, rows: 48 }),
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'casino', description: 'Слоты, рулетка и 21 на сегодняшних токенах Claude Code' })
    await restore(host($))
    return next(e)
  })
  on('command.run', { command: 'casino' }, async $ => {
    const opened = await open(host($))
    return { text: opened ? 'Казино открыто. Гемблинг — это плохо.' : 'Казино не открылось. Проверь Python 3 в PATH и доступ к локальному хранилищу; повтори /casino.' }
  })
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface !== 'terminal') {
      const { Text } = $.ui.resolve(e)
      return <Text>Казино работает в обычном терминале Claude Code 2.1.287+. Открой там /casino.</Text>
    }
    return renderPanel($.ui.resolve(e), await snapshot($), e.props.bodyColumns, key => activate($, key))
  })
  on('ui.message', { component: 'Pane', requestId: PANE, surface: 'terminal' }, async ($, e, next) => {
    if (e.element !== 'controls' && e.element !== 'navigation') return next(e)
    if (!e.data || typeof e.data !== 'object' || !('control' in e.data) || typeof e.data.control !== 'string') return {}
    await activate($, e.data.control)
    return {}
  })
  on('ui.close', { id: PANE }, ($, e, next) => { close(); return next(e) })
  on('session.end', ($, e, next) => { close(); return next(e) })
}
