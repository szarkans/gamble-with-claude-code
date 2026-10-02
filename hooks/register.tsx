import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Earned, Phase } from '../types'
import { COLS, ROWS, SYMBOLS, cells, fmt, payout, spinResult } from './slot'

const PANE = 'gambling-with-claude-code'

const earned = atom({ plugin: 'gambling-with-claude-code', key: 'earned' } as const, { total: 0 } as Earned)
const net = atom({ plugin: 'gambling-with-claude-code', key: 'net' } as const, 0)
const frac = atom({ plugin: 'gambling-with-claude-code', key: 'frac' } as const, 0.1)
const reels = atom({ plugin: 'gambling-with-claude-code', key: 'reels' } as const, [0, 1, 2])
const phase = atom({ plugin: 'gambling-with-claude-code', key: 'phase' } as const, 'idle' as Phase)
const msg = atom({ plugin: 'gambling-with-claude-code', key: 'msg' } as const, 'Гемблинг — это плохо. Как и --dangerously-skip-permissions.')

const WIN = ['You\'re absolutely right!', 'Тесты не запускал. Уверен в результате.', 'Проблема была в кэше.', 'LGTM, мержим.']
const LOSE = ['I apologize for the confusion.', 'Задача выполнена. Остались небольшие замечания.', 'Работает на моей машине.', 'Давай я ещё раз проверю…']
const pick = (xs: string[]) => xs[Math.floor(Math.random() * xs.length)]
const RAINBOW = [0xff2d55, 0xffcc00, 0x39ff88, 0x33d6ff, 0xb44dff]

let poll: { cancel: () => void } | undefined
let anim: { cancel: () => void } | undefined

async function refresh($: EngineInterface) {
  try {
    const { exitCode, stdout } = await $.process.run(['python3', `${$.plugin.root}/tools/count_today.py`], { timeoutMs: 15000 })
    if (exitCode === 0) await update($, earned, () => JSON.parse(stdout) as Earned)
  } catch {}
}

async function spin($: EngineInterface) {
  if ((await read($, phase)) === 'spinning') return
  const balance = (await read($, earned)).total + (await read($, net))
  if (balance <= 0) {
    await update($, phase, () => 'broke' as Phase)
    await update($, msg, () => 'Claude usage limit reached. Иди работай — фишки капают с каждым токеном.')
    return
  }
  const f = await read($, frac)
  const bet = f >= 1 ? balance : Math.max(1, Math.floor(balance * f))
  const result = spinResult(Math.random)
  await update($, net, n => n - bet)
  await update($, phase, () => 'spinning' as Phase)
  await update($, msg, () => `Ставка ${fmt(bet)}…`)

  const start = await $.clock.now()
  const stopAt = [700, 1150, 1600]
  anim?.cancel()
  anim = $.clock.every(45, async () => {
    const t = (await $.clock.now()) - start
    const spinning = stopAt.map(s => t < s)
    const shown = result.map((r, i) => (spinning[i] ? Math.floor(Math.random() * SYMBOLS.length) : r))
    void $.ui.blit({ requestId: PANE, key: 'reels', cells: cells(shown, spinning) })
    if (t < stopAt[2]) return
    anim?.cancel()
    const won = payout(result, bet)
    await update($, reels, () => result)
    await update($, net, n => n + won)
    if (won > 0) {
      await update($, phase, () => 'win' as Phase)
      await update($, msg, () => `+${fmt(won - bet)} токенов. ${pick(WIN)}`)
      $.ui.toast(`🎰 +${fmt(won - bet)} токенов`)
      let k = 0
      const flash = $.clock.every(70, () => {
        void $.ui.blit({ requestId: PANE, key: 'reels', cells: cells(result, [false, false, false], RAINBOW[k % RAINBOW.length]) })
        if (++k > 14) {
          flash.cancel()
          void $.ui.blit({ requestId: PANE, key: 'reels', cells: cells(result, [false, false, false]) })
        }
      })
    } else {
      await update($, phase, () => 'lose' as Phase)
      await update($, msg, () => `−${fmt(bet)} токенов. ${pick(LOSE)}`)
    }
  })
}

export const register: Register = on => {

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'gamble', description: 'Слот-машина на токенах, которые Claude Code сжёг сегодня' })
    return next(e)
  })

  on('command.run', { command: 'gamble' }, async $ => {
    await refresh($)
    poll?.cancel()
    poll = $.clock.every(5000, () => void refresh($))  // живой счётчик, пассивно
    await $.ui.open({ id: PANE, title: '🎰 TOKEN GAMBLE' })
    return { text: 'Казино открыто. Гемблинг — это плохо.' }
  })


  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Raster } = $.ui.resolve(e) as any
    const er = await read($, earned)
    const n = await read($, net)
    const f = await read($, frac)
    const ph = await read($, phase)
    const m = await read($, msg)
    const r = await read($, reels)
    const balance = er.total + n
    const color = ph === 'win' ? 'green' : ph === 'lose' || ph === 'broke' ? 'red' : undefined
    const setFrac = (v: number) => () => void update($, frac, () => v)
    const fracBtn = (v: number, label: string, hk: string) => (
      <Button key={label} label={label} hotkey={hk} variant={f === v ? 'primary' : undefined} onPress={setFrac(v)} />
    )

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>ФИШКИ: {fmt(Math.max(0, balance))}</Text>
          <Text dimColor>
            Claude Code сжёг сегодня {fmt(er.total)} · {n >= 0 ? '+' + fmt(n) : '−' + fmt(-n)} в казино
          </Text>
        </Box>
        {Raster && <Raster key="reels" columns={COLS} rows={ROWS} cells={cells(r, [false, false, false])} />}
        <Text bold color={color}>{m}</Text>
        <Box flexDirection="row" gap={1}>
          {fracBtn(0.1, '10%', '1')}
          {fracBtn(0.25, '25%', '2')}
          {fracBtn(0.5, '50%', '3')}
          {fracBtn(1, 'ALL IN', '4')}
          <Button key="spin" label="SPIN" hotkey="s" variant="primary" onPress={() => void spin($)} />
        </Box>
        <Text dimColor>7 7 7 ×20 · $ $ $ ×10 · ✓✓✓ ×5 · ! ! ! ×3 · rm -rf ×3 = ×50 · пара ×1.5 · виртуальные фишки, вывода нет</Text>
      </Box>
    )
  })
}
