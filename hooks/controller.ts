import type { Timer } from 'claude-code'
import type { Host } from './host'
import { busyPhase } from './host'
import type { Earned, Game, Phase } from '../types'
import type { Hand } from './blackjack'
import type { RouletteBet } from './roulette'
import type { Day } from './economy'
import type { Effect } from './effects'
import type { Frame } from './raster'
import { blackjackPayout, canDouble, deal, dealerStep, doubleDown, hit, natural, score, shuffledDeck } from './blackjack'
import { balanceOf, dayValue, stake } from './economy'
import { FRAME_MS, effectDuration, effectFrame } from './effects'
import { encode } from './raster'
import { ROULETTE_MS, roulettePayout, rouletteResult, wheelIndex, wheelPosition } from './roulette'
import { debugDeck, debugEnabled, debugKey, debugRoulette, debugSlot } from './debug'
import type { DebugOutcome } from './debug'
import { fmt, payout, spinResult } from './slot'
import { blackjackFrame } from './views/blackjack'
import { rouletteFrame } from './views/roulette'
import { slotFrame } from './views/slot'

const WIN = ["You're absolutely right!", 'Тесты не запускал. Уверен в результате.', 'Проблема была в кэше.', 'LGTM, мержим.']
const LOSE = ['I apologize for the confusion.', 'Задача выполнена. Остались небольшие замечания.', 'Работает на моей машине.', 'Давай я ещё раз проверю…']
const pick = (xs: string[]) => xs[Math.floor(Math.random() * xs.length)]!
let columns: number | undefined, opened = false, locked = false
let animation: Timer | undefined, poll: Timer | undefined
let generation = 0, liveFrame: ((width: number) => Frame) | undefined
let debugging = false
let pendingGame: (() => Promise<unknown>) | undefined

export const setColumns = (n: number) => { columns = Math.max(1, Math.min(512, Math.floor(n))) }
export const currentFrame = (width: number) => liveFrame?.(width)
export const isDebug = () => debugging
const message = (api: Host, s: string) => api.msg.set(s)
const setPhase = (api: Host, p: Phase) => api.phase.set(p)
const sound = (api: Host, name: string) => { void api.play(name).catch(() => {}) }

async function sync(api: Host) {
  const er = await api.earned.get()
  const day = dayValue(await api.storeGet(debugKey(er.date, debugging)))
  await api.net.set(day.net)
  const current = await api.hand.get()
  await api.hand.set(day.hand ?? (current?.status === 'done' ? current : null))
  return day
}

async function change(api: Host, date: string, fn: (day: Day) => Day | null, show = true) {
  const key = debugKey(date, debugging)
  const next = fn(dayValue(await api.storeGet(key)))
  if (!next) return null
  await api.storeSet(key, next)
  if (show && (await api.earned.get()).date === date) {
    await api.net.set(next.net)
    await api.hand.set(next.hand)
  }
  return next
}

async function refresh(api: Host) {
  const { exitCode, stdout } = await api.countTokens()
  if (exitCode !== 0) throw new Error('Счётчик токенов недоступен')
  const er = JSON.parse(stdout) as Earned
  if (!Number.isSafeInteger(er.total) || er.total < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(er.date) || !Number.isFinite(er.midnight)) {
    throw new Error('Счётчик вернул некорректные данные')
  }
  if (debugging) er.total = 10000
  const previous = await api.earned.get()
  if (previous.date && er.date !== previous.date) await api.hand.set(null)
  await api.earned.set(er)
  const day = await sync(api)
  if (previous.date && er.date !== previous.date) {
    await message(api, 'Полночь. Вчерашние фишки сгорели; агент начинает новую жизнь.')
    if (!animation) await setPhase(api, 'idle')
  }
  return { day, er }
}

async function guarded(api: Host, fn: () => Promise<void>, passive = false) {
  if (locked) return false
  locked = true
  try { await fn(); return true }
  catch (error) {
    if (!passive) {
      await message(api, error instanceof Error && error.message.startsWith('Нужен Python 3') ? error.message :
        'Казино споткнулось о API. Баланс сохранён; попробуй /casino ещё раз.')
      if (!animation) await setPhase(api, 'idle')
    }
    return false
  } finally {
    locked = false
    const pending = pendingGame
    pendingGame = undefined
    await pending?.()
  }
}

async function animate(api: Host, duration: number, paint: (t: number, width: number) => Frame,
  done: () => Promise<void>) {
  animation?.cancel()
  const id = ++generation, start = await api.now()
  let elapsed = 0, drawing = false
  liveFrame = width => paint(Math.min(elapsed, duration), width)
  const timer = api.every(FRAME_MS, () => {
    if (drawing) return
    drawing = true
    void (async () => {
      elapsed = Math.max(0, (await api.now()) - start)
      if (id !== generation) return
      // Ширина переживает reload в state; render подставляет актуальную ширину панели.
      const savedWidth = await api.columns.get(), width = columns ?? savedWidth
      if (width !== savedWidth) await api.columns.set(width)
      if (id !== generation) return
      try {
        if (opened) await api.blit(encode(paint(Math.min(elapsed, duration), width)))
      } catch {
        timer.cancel()
        if (id !== generation) return
        animation = undefined; liveFrame = undefined
        await message(api, 'Кадр выпал. Сохранённый результат ждёт в /casino.')
        await setPhase(api, 'idle')
        return
      }
      if (id !== generation) return
      if (elapsed >= duration) {
        // Не теряем колбэк, если /casino или опрос удерживает блокировку: следующий кадр повторит попытку.
        if (locked) return
        timer.cancel()
        animation = undefined
        liveFrame = undefined
        await guarded(api, done)
      }
    })().catch(async () => {
      timer.cancel()
      if (id !== generation) return
      animation = undefined; liveFrame = undefined
      await message(api, 'Казино споткнулось о API. Баланс сохранён; попробуй /casino ещё раз.')
      await setPhase(api, 'idle')
    }).finally(() => { drawing = false })
  })
  animation = timer
}

async function celebrate(api: Host, base: (width: number) => Frame, effect: Effect, date: string) {
  if (effect.won === 0) {
    await message(api, 'Ставка вернулась. Нулевой diff, зато какая анимация.')
    await setPhase(api, 'idle')
    return
  }
  await setPhase(api, 'effect')
  const win = effect.won > 0
  const expired = (await api.earned.get()).date !== date
  const samples = Array.from({ length: 72 }, () => Math.random())
  sound(api, win ? effect.banner === 'JACKPOT' || effect.banner === 'BLACKJACK' ? 'jackpot' : 'win' : 'lose')
  await message(api, `${effect.won > 0 ? '+' : '−'}${fmt(Math.abs(effect.won))} токенов${expired ? ` за ${date}; фишки уже сгорели` : ''}. ${pick(win ? WIN : LOSE)}`)
  await animate(api, effectDuration(effect), (t, width) => {
    let i = 0
    return effectFrame(base(width), effect, t, () => samples[i++ % samples.length]!)
  },
    async () => { await setPhase(api, win ? 'win' : 'lose') })
}

async function betInfo(api: Host, forced = false) {
  if (busyPhase(await api.phase.get())) return null
  const { day, er } = await refresh(api)
  const h = day.hand
  if (h && h.status !== 'done') {
    await message(api, 'Сначала закончи руку 21. Дилер уже заблокировал твой merge.')
    return null
  }
  // Любую отладочную сцену можно повторить даже после проигрыша ALL IN.
  if (debugging && forced) await change(api, er.date, () => ({ v: 1, net: 0, hand: null }))
  const bet = stake(balanceOf(er.total, debugging && forced ? 0 : day.net), await api.frac.get())
  if (bet <= 0) {
    await setPhase(api, 'broke')
    await message(api, 'Claude usage limit reached. Иди работай — фишки капают с каждым токеном.')
    return null
  }
  return { bet, date: er.date }
}

async function startAutomatic(api: Host, date: string, bet: number, won: number, text: string) {
  await setPhase(api, 'spinning')
  const before = await api.net.get()
  // Автоматические игры фиксируют результат до шоу: reload не теряет выигрыш.
  await change(api, date, day => ({ ...day, net: day.net + won - bet }), false)
  await api.net.set(before - bet)
  await message(api, `Ставка ${fmt(bet)}. ${text}`)
  sound(api, 'spin')
}

const automaticEffect = (won: number, bet: number): Effect => ({
  banner: won / bet >= 10 ? 'JACKPOT' : won > 0 ? 'WIN' : 'LOSE', won: won - bet, bet,
})

export const spin = (api: Host, forced?: DebugOutcome) => guarded(api, async () => {
  const info = await betInfo(api, !!forced)
  if (!info) return
  const { bet, date } = info, result = debugging && forced ? debugSlot(forced) : spinResult(Math.random), won = payout(result, bet)
  await startAutomatic(api, date, bet, won, 'Генерирую результат…')
  await api.reels.set(result)
  let stopped = 0
  await animate(api, 1600, (t, width) => {
    const spinning = [700, 1150, 1600].map(end => t < end)
    const count = spinning.filter(x => !x).length
    if (count > stopped) { stopped = count; sound(api, 'click') }
    return slotFrame(width, result.map((n, i) => spinning[i] ? Math.floor(Math.random() * 5) : n), spinning)
  }, async () => {
    await sync(api)
    await celebrate(api, w => slotFrame(w, result), automaticEffect(won, bet), date)
  })
})

export const roll = (api: Host, forced?: DebugOutcome) => guarded(api, async () => {
  const info = await betInfo(api, !!forced)
  if (!info) return
  const { bet, date } = info, choice = await api.rouletteBet.get()
  const result = debugging && forced ? debugRoulette(choice, forced) : rouletteResult(Math.random)
  const won = roulettePayout(result, choice, bet)
  await startAutomatic(api, date, bet, won, 'Шарик уже в проде…')
  await api.rouletteNumber.set(result)
  let last = -1
  await animate(api, ROULETTE_MS, (t, width) => {
    const index = wheelIndex(result, t)
    if (index !== last) { last = index; sound(api, 'click') }
    return rouletteFrame(width, result, choice, t < ROULETTE_MS ? wheelPosition(result, t) : undefined)
  }, async () => {
    await animate(api, 720, (t, width) => rouletteFrame(width, result, choice, undefined, t), async () => {
      await sync(api)
      await celebrate(api, w => rouletteFrame(w, result, choice), automaticEffect(won, bet), date)
    })
  })
})

async function saveHand(api: Host, date: string, h: Hand, extra = 0) {
  // Только новая раздача создаёт руку. Устаревший колбэк не воскрешает рассчитанную.
  return change(api, date, day => !day.hand || h.status === 'done' ? null :
    ({ ...day, net: day.net - extra, hand: h }))
}

async function finishHand(api: Host, date: string, h: Hand) {
  const done = { ...h, status: 'done' as const }, won = blackjackPayout(done)
  const paid = await change(api, date, day => day.hand ? { ...day, net: day.net + won, hand: null } : null)
  if (!paid) return
  if ((await api.earned.get()).date === date) await api.hand.set(done)
  if (won === h.bet) {
    await message(api, 'PUSH. Ничья. Даже казино не решилось принять твой PR.')
    await setPhase(api, 'idle')
    return
  }
  await celebrate(api, w => blackjackFrame(w, done), {
    banner: score(h.player) > 21 ? 'BUST' : natural(h.player) ? 'BLACKJACK' : won > 0 ? 'WIN' : 'LOSE',
    won: won - h.bet, bet: h.bet,
  }, date)
}

async function dealer(api: Host, date: string, h: Hand, flip = true) {
  if (h.status === 'done') return
  h = { ...h, status: 'dealer' }
  if (!await saveHand(api, date, h)) return
  await setPhase(api, 'dealing')
  sound(api, 'click')
  await animate(api, flip ? 480 : 360, (t, width) => blackjackFrame(width, h,
    { player: h.player.length, dealer: h.dealer.length, reveal: !flip || t >= 240,
      flip: flip ? t / 480 : 1, dealerSlide: flip ? 0 : (1 - t / 360) * 8 }), async () => {
      const next = dealerStep(h)
      if (next.status === 'done') await finishHand(api, date, next)
      else await dealer(api, date, next, false)
    })
}

export const newHand = (api: Host, forced?: DebugOutcome) => guarded(api, async () => {
  const info = await betInfo(api, !!forced)
  if (!info) return
  const scenario = debugging ? forced : undefined
  const h = deal(info.bet, scenario ? debugDeck(scenario) : shuffledDeck(Math.random))
  const reserved = await change(api, info.date, day => day.hand ? null :
    ({ ...day, net: day.net - info.bet, hand: h }))
  if (!reserved) return
  await setPhase(api, 'dealing')
  await message(api, `Ставка ${fmt(info.bet)}. Карты без as any.`)
  let dealt = 0
  await animate(api, 1000, (t, width) => {
    const count = Math.min(4, Math.floor(t / 200))
    if (count > dealt) { dealt = count; sound(api, 'click') }
    const slide = count > 0 && t < 1000 ? (1 - (t % 200) / 200) * 8 : 0
    return blackjackFrame(width, h, {
      player: Math.ceil(count / 2), dealer: Math.floor(count / 2), reveal: false,
      playerSlide: count % 2 ? slide : 0, dealerSlide: count % 2 ? 0 : slide,
    })
  }, async () => {
    if (natural(h.player) || natural(h.dealer) || scenario === 'win') await dealer(api, info.date, h)
    else if (scenario === 'lose') {
      await setPhase(api, 'playing')
      await takeHandAction(api, 'hit')
    }
    else { await setPhase(api, 'playing'); await message(api, 'Дилер ждёт. Контекст не резиновый.') }
  })
})

async function takeHandAction(api: Host, action: 'hit' | 'stand' | 'double') {
  if (busyPhase(await api.phase.get())) return
  const { day, er } = await refresh(api), h = day.hand
  if (!h || h.status !== 'player') return
  const balance = balanceOf(er.total, day.net)
  if (action === 'double' && !canDouble(h, balance)) {
    await message(api, 'Double: только первые две карты и ещё одна ставка в кошельке.')
    return
  }
  const next = action === 'hit' ? hit(h) : action === 'double' ? doubleDown(h, balance) : { ...h, status: 'dealer' as const }
  if (!await saveHand(api, er.date, next, action === 'double' ? h.bet : 0)) return
  if (action === 'stand') { await dealer(api, er.date, next); return }
  await setPhase(api, 'dealing')
  sound(api, 'click')
  await animate(api, 360, (t, width) => blackjackFrame(width, next, {
    player: t < 180 ? h.player.length : next.player.length, dealer: h.dealer.length, reveal: false,
    playerSlide: t < 180 ? 0 : (1 - (t - 180) / 180) * 8,
  }), async () => {
    if (next.status === 'dealer') await dealer(api, er.date, next)
    else await setPhase(api, 'playing')
  })
}
export const playHand = (api: Host, action: 'hit' | 'stand' | 'double') => guarded(api, () => takeHandAction(api, action))

export function chooseGame(api: Host, g: Game): Promise<unknown> {
  // Колбэк расчёта держит locked во время await: сохраняем последний выбор вкладки.
  if (locked) { pendingGame = () => chooseGame(api, g); return Promise.resolve(false) }
  return guarded(api, async () => {
    if (await api.game.get() === g) return
    const day = await sync(api), h = day.hand
    if (h && h.status !== 'done') { await message(api, 'Сначала закончи руку. Дилер помнит твои обещания.'); return }
    stopAnimation()
    // Автоматический результат уже в store; меняем только показ, без повторной выплаты.
    await api.game.set(g)
    await setPhase(api, 'idle')
  })
}

export const chooseFraction = (api: Host, f: number) => guarded(api, async () => {
  if (busyPhase(await api.phase.get())) return
  await api.frac.set(f)
})
export const chooseRoulette = (api: Host, bet: RouletteBet) => guarded(api, async () => {
  if (busyPhase(await api.phase.get())) return
  if (bet.kind === 'number') await api.roulettePick.set(bet.value)
  await api.rouletteBet.set(bet)
})

export const chooseNumber = (api: Host, step: -1 | 1) => guarded(api, async () => {
  if (busyPhase(await api.phase.get())) return
  const bet = await api.rouletteBet.get()
  const n = ((bet.kind === 'number' ? bet.value : await api.roulettePick.get()) + step + 37) % 37
  await api.roulettePick.set(n)
  if (bet.kind === 'number') await api.rouletteBet.set({ kind: 'number', value: n })
})

function stopAnimation() {
  animation?.cancel(); animation = undefined; liveFrame = undefined; generation++
}

function stopTimers() {
  stopAnimation()
  poll?.cancel(); poll = undefined
}

function startPolling(api: Host) {
  poll = api.every(5000, () => { if (!animation) void guarded(api, async () => { await refresh(api) }, true) })
}

async function continueHand(api: Host, day: Day, date: string) {
  const h = day.hand
  if (h && h.status !== 'done') await api.game.set('blackjack')
  await setPhase(api, h?.status === 'player' ? 'playing' : 'idle')
  if (h && (h.status === 'dealer' || h.status === 'player' && (natural(h.player) || natural(h.dealer)))) {
    await dealer(api, date, h)
  }
}

export const open = (api: Host) => guarded(api, async () => {
  debugging = debugEnabled(await api.debugFlag())
  stopTimers()
  let current: Awaited<ReturnType<typeof refresh>>
  try { current = await refresh(api) }
  catch (error) {
    if (error instanceof Error && error.message.startsWith('Нужен Python 3')) {
      opened = true
      await api.openPane()
      startPolling(api)
    }
    throw error
  }
  opened = true
  await setPhase(api, 'idle')
  await api.openPane()
  startPolling(api)
  await continueHand(api, current.day, current.er.date)
})

// session.start повторяется при reload; таймеры старой среды движок уже отменил.
export const restore = (api: Host) => guarded(api, async () => {
  stopTimers()
  columns = undefined
  debugging = debugEnabled(await api.debugFlag())
  opened = await api.paneIsOpen()
  if (!opened) return
  await setPhase(api, 'idle')
  startPolling(api)
  const { day, er } = await refresh(api)
  await message(api, 'Казино снова в строю. Сохранённый кошелёк на месте.')
  await continueHand(api, day, er.date)
})

export async function debugRound(api: Host, outcome: DebugOutcome) {
  if (!debugging) return
  const game = await api.game.get()
  return game === 'slot' ? spin(api, outcome) : game === 'roulette' ? roll(api, outcome) : newHand(api, outcome)
}

export function close() {
  opened = false
  poll?.cancel(); poll = undefined
  // Раунд заканчивается и без панели; незаконченная рука лежит в store.
}
