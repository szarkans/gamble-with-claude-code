import type { ProcessRunResult, Timer } from 'claude-code'
import type { Earned, Game, Hand, Phase, RouletteBet } from '../types'

export const busyPhase = (p: Phase) => p === 'spinning' || p === 'dealing' || p === 'effect'

export type Snapshot = {
  earned: Earned; net: number; frac: number; reels: number[]; phase: Phase; msg: string
  game: Game; rouletteBet: RouletteBet; rouletteNumber: number; hand: Hand | null
}
type Value<T> = { get: () => Promise<T>; set: (value: T) => Promise<unknown> }
// Валидатор API следует за $ только в одном файле. Здесь передаём узкие вызовы.
export type Host = { [K in keyof Snapshot]: Value<Snapshot[K]> } & {
  countTokens: () => Promise<ProcessRunResult>
  debugFlag: () => Promise<string | undefined>
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<void>
  now: () => Promise<number>
  every: (ms: number, fn: () => void) => Timer
  columns: Value<number>
  paneIsOpen: () => Promise<boolean>
  play: (name: string) => Promise<void>
  blit: (cells: string) => Promise<unknown>
  openPane: () => Promise<unknown>
}
