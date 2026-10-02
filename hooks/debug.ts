import type { Card, Game } from '../types'
import type { RouletteBet } from './roulette'
import { WHEEL, roulettePayout } from './roulette'
import { shuffledDeck } from './blackjack'

export type DebugOutcome = 'special' | 'win' | 'lose'
export const debugEnabled = (value: string | undefined) => value === '1'
export const debugKey = (date: string, enabled: boolean) => `${enabled ? 'debug:' : ''}day:${date}`
export const debugSlot = (outcome: DebugOutcome) => outcome === 'special' ? [4, 4, 4] : outcome === 'win' ? [2, 2, 2] : [0, 1, 2]
export function debugRoulette(choice: RouletteBet, outcome: DebugOutcome) {
  return WHEEL.find(n => outcome === 'lose' ? roulettePayout(n, choice, 100) === 0 : roulettePayout(n, choice, 100) > 100)!
}

// Та же настоящая колода из 52 уникальных карт; меняется только порядок.
export function debugDeck(outcome: DebugOutcome): Card[] {
  const first: Card[] = outcome === 'special' ?
    [{ rank: 1, suit: '♥' }, { rank: 9, suit: '♣' }, { rank: 13, suit: '♠' }, { rank: 8, suit: '♦' }] :
    outcome === 'win' ?
      [{ rank: 10, suit: '♥' }, { rank: 10, suit: '♣' }, { rank: 12, suit: '♠' }, { rank: 7, suit: '♦' }] :
      [{ rank: 10, suit: '♥' }, { rank: 10, suit: '♣' }, { rank: 9, suit: '♠' }, { rank: 7, suit: '♦' }, { rank: 5, suit: '♣' }]
  return [...first, ...shuffledDeck(() => 0.5).filter(c => !first.some(f => f.rank === c.rank && f.suit === c.suit))]
}

export function debugChoices(game: Game): { outcome: DebugOutcome; label: string; hotkey: string }[] {
  if (game === 'roulette') return [
    { outcome: 'win', label: 'DEBUG WIN', hotkey: 't' }, { outcome: 'lose', label: 'DEBUG LOSE', hotkey: 'v' },
  ]
  return [
    { outcome: 'special', label: game === 'slot' ? 'DEBUG JACKPOT' : 'DEBUG BLACKJACK', hotkey: 't' },
    { outcome: 'win', label: 'DEBUG WIN', hotkey: 'y' },
    { outcome: 'lose', label: game === 'slot' ? 'DEBUG LOSE' : 'DEBUG BUST', hotkey: 'v' },
  ]
}
