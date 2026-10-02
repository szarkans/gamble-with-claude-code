import { expect, test } from 'claude-code/testing'
import { COLS, ROWS, cells, payout } from './slot'

test('payout: triple, pair, miss', () => {
  expect(payout([0, 0, 0], 100)).toBe(2000)
  expect(payout([4, 4, 4], 100)).toBe(5000)
  expect(payout([1, 1, 3], 100)).toBe(150)
  expect(payout([1, 2, 3], 100)).toBe(0)
})

test('cells: one u32 triplet per cell', () => {
  const b64 = cells([0, 1, 2], [false, false, false])
  expect(Uint8Array.fromBase64(b64).length).toBe(COLS * ROWS * 12)
})
