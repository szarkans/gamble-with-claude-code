export type Phase = 'idle' | 'spinning' | 'win' | 'lose' | 'broke'
export type Earned = { total: number }

declare module 'claude-code' {
  interface PluginState {
    'gambling-with-claude-code': {
      earned: Earned
      net: number
      frac: number
      reels: number[]
      phase: Phase
      msg: string
    }
  }
}
