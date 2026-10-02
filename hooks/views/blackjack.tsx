import type { Elements } from 'claude-code'
import type { Card, Hand } from '../blackjack'
import { canDouble, rankLabel, score } from '../blackjack'
import { GOLD, MUTED, center, frame, put, stamp, text } from '../raster'
import type { Frame } from '../raster'
import { numberPixels, pixels } from '../glyphs'

export const CARD_FACE = 0xf8f4e8, CARD_INK = 0x142237, CARD_RED = 0xb01b3b, CARD_BACK = 0x244873
const RANKS: Record<string, string[]> = {
  A: [' # ', '# #', '###', '# #', '# #'], J: ['  #', '  #', '  #', '# #', '###'],
  Q: ['###', '# #', '# #', ' ##', '  #'], K: ['# #', '## ', '#  ', '## ', '# #'],
}
const SUIT_PIXELS = {
  '♥': [' # # ', '#####', '#####', ' ### ', '  #  '], '♦': ['  #  ', ' ### ', '#####', ' ### ', '  #  '],
  '♠': ['  #  ', ' ### ', '#####', '  #  ', ' ### '], '♣': ['  #  ', ' ### ', '# # #', '  #  ', ' ### '],
}

export function cardLayout(columns: number, count: number, preferredWidth = 23) {
  const width = Math.max(1, Math.min(preferredWidth, columns))
  const step = count <= 1 ? 0 : Math.max(0, Math.min(width + 2, Math.floor((columns - width) / (count - 1))))
  const span = width + Math.max(0, count - 1) * step
  return { width, step, left: Math.floor((columns - span) / 2), span }
}

export function cardFace(card: Card, width = 23, rows = 11, back = false): Frame {
  const bg = back ? CARD_BACK : CARD_FACE, ink = back ? GOLD : CARD_INK
  const f = frame(width, rows, bg)
  for (let y = 0; y < rows; y++) for (let x = 0; x < width; x++) {
    const glyph = y === 0 || y === rows - 1 ?
      (x === 0 ? (y === 0 ? '╭' : '╰') : x === width - 1 ? (y === 0 ? '╮' : '╯') : '─') :
      x === 0 || x === width - 1 ? '│' : back ? ((x + y) % 2 ? '╳' : '◆') : ' '
    put(f, x, y, glyph, back && x > 0 && x < width - 1 && y > 0 && y < rows - 1 ? 0x93bbdf : ink)
  }
  if (back) return f
  const fg = card.suit === '♥' || card.suit === '♦' ? CARD_RED : CARD_INK
  const rank = rankLabel(card), rankWidth = rank.length * 4 - 1
  if (width >= 23 && rows >= 11) {
    const corner = (x: number, y: number) => rank in RANKS ? pixels(f, x, y, RANKS[rank]!, fg) : numberPixels(f, x, y, Number(rank), fg)
    corner(1, 1)
    corner(width - rankWidth - 1, rows - 6)
  } else {
    text(f, 1, 1, rank, fg)
    text(f, width - rank.length - 1, rows - 2, rank, fg)
  }
  pixels(f, Math.floor((width - 5) / 2), Math.floor((rows - 5) / 2), SUIT_PIXELS[card.suit], fg)
  return f
}

function cards(f: Frame, hand: readonly Card[], y: number, visible: number, hidden = false, flip = 1, slide = 0, compact = false) {
  const layout = cardLayout(f.columns, hand.length, compact ? 13 : 23), height = compact ? 7 : 11
  hand.slice(0, visible).forEach((c, i) => {
    const arriving = i === visible - 1 ? slide : 0
    const x = layout.left + i * layout.step + Math.round(arriving)
    const top = y - Math.min(1, Math.floor(arriving / 8))
    const turning = i === 1 && flip < 1
    const back = i === 1 && (turning ? flip < 0.5 : hidden)
    const face = cardFace(c, layout.width, height, back)
    if (!turning) { stamp(f, face, x, top); return }
    // Сжатие к ребру симметрично относительно центра; лицо появляется только после середины.
    const width = Math.max(1, Math.round(layout.width * Math.abs(1 - flip * 2)))
    const left = x + Math.floor((layout.width - width) / 2)
    for (let cy = 0; cy < height; cy++) for (let cx = 0; cx < width; cx++) {
      const sx = Math.min(face.columns - 1, Math.floor(cx * face.columns / width))
      const at = (cy * face.columns + sx) * 3
      put(f, left + cx, top + cy, width === 1 ? '│' : String.fromCharCode(face.words[at]!), face.words[at + 1]!, face.words[at + 2]!)
    }
  })
  const labels = hand.slice(0, visible).map((c, i) => hidden && i === 1 ? '??' : rankLabel(c) + c.suit).join('  ')
  center(f, y + height, labels, MUTED)
}

export type DealView = { player: number; dealer: number; reveal?: boolean; flip?: number; playerSlide?: number; dealerSlide?: number }
export function blackjackFrame(columns: number, hand: Hand | null, view?: DealView) {
  const wide = columns >= 60, f = frame(columns, wide ? 16 : 20)
  center(f, 0, '21 / BLACKJACK', GOLD)
  if (!hand) {
    cards(f, [{ rank: 1, suit: '♠' }, { rank: 13, suit: '♥' }], wide ? 2 : 5, 2, false, 1, 0, !wide)
    center(f, wide ? 15 : 16, 'Дилер стоит на 17. Как CI.', MUTED)
    return f
  }
  const reveal = view?.reveal ?? hand.status !== 'player'
  const dealer = hand.dealer.slice(0, view?.dealer ?? hand.dealer.length)
  const player = hand.player.slice(0, view?.player ?? hand.player.length)
  const hidden = !reveal || (view?.flip ?? 1) < 0.5
  const dealerLabel = `ДИЛЕР: ${!hidden ? score(dealer) : (dealer[0] ? score([dealer[0]]) + ' + ?' : '…')}`
  const playerLabel = `ВЫ: ${score(player)}${hand.doubled ? ' / DOUBLE' : ''}`
  if (wide) {
    const room = Math.floor((columns - 3) / 2)
    const d = frame(room, 14), p = frame(room, 14)
    center(d, 0, dealerLabel, MUTED); center(p, 0, playerLabel, GOLD)
    cards(d, hand.dealer, 1, dealer.length, hidden, view?.flip ?? 1, view?.dealerSlide ?? 0)
    cards(p, hand.player, 1, player.length, false, 1, view?.playerSlide ?? 0)
    const left = Math.floor((columns - room * 2 - 3) / 2)
    stamp(f, d, left, 1); stamp(f, p, left + room + 3, 1)
  } else {
    center(f, 1, dealerLabel, MUTED)
    cards(f, hand.dealer, 2, dealer.length, hidden, view?.flip ?? 1, view?.dealerSlide ?? 0, true)
    center(f, 10, playerLabel, GOLD)
    cards(f, hand.player, 11, player.length, false, 1, view?.playerSlide ?? 0, true)
  }
  center(f, f.rows - 1, `Ставка ${hand.bet} · S17 · BJ 3:2`, MUTED)
  return f
}

export function blackjackControls({ Box, Button, Text }: Elements['terminal'], hand: Hand | null,
  balance: number, busy: boolean, actions: { deal: () => void; hit: () => void; stand: () => void; double: () => void }) {
  const playing = hand?.status === 'player'
  return <Box flexDirection="column">
    {playing ? <Box flexDirection="row" flexWrap="wrap" gap={1}>
      <Button key="hit" label="ЕЩЁ [h]" hotkey="h" dimColor={busy} onPress={actions.hit} />
      <Button key="stand" label="ХВАТИТ [s]" hotkey="s" variant="primary" dimColor={busy} onPress={actions.stand} />
      <Button key="double" label="DOUBLE [d]" hotkey="d" dimColor={busy || !canDouble(hand, balance)} onPress={actions.double} />
    </Box> : <Button key="deal" label="РАЗДАТЬ [s]" hotkey="s" variant="primary" dimColor={busy} onPress={actions.deal} />}
    <Text dimColor>Double: ещё одна ставка и ровно одна карта. Дилер стоит на мягких 17. Без split.</Text>
  </Box>
}
