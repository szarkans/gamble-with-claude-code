export type Phase = 'idle' | 'spinning' | 'dealing' | 'playing' | 'effect' | 'win' | 'lose' | 'broke'
export type Earned = { total: number; date: string; midnight: number }
export type Game = 'slot' | 'roulette' | 'blackjack'
export type RouletteBet =
  | { kind: 'red' | 'black' | 'even' | 'odd' | 'low' | 'high' }
  | { kind: 'dozen'; value: 1 | 2 | 3 }
  | { kind: 'number'; value: number }
export type Card = { rank: number; suit: '♠' | '♥' | '♦' | '♣' }
export type Hand = {
  player: Card[]; dealer: Card[]; deck: Card[]; bet: number
  status: 'player' | 'dealer' | 'done'; doubled: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'gambling-with-claude-code': {
      earned: Shaped<Earned>
      net: Shaped<number>
      frac: Shaped<number>
      reels: Shaped<number[]>
      phase: Shaped<Phase>
      msg: Shaped<string>
      game: Shaped<Game>
      rouletteBet: Shaped<RouletteBet>
      rouletteResult: Shaped<number>
      hand: Shaped<Hand | null>
      columns: Shaped<number>
    }
  }
}
