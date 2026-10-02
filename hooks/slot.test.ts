import { expect, test } from 'claude-code/testing'
import { COLS, ROWS, cells, payout, spinResult } from './slot'

test('payout: triple, pair, miss', () => {
  expect(payout([0, 0, 0], 100)).toBe(2000)
  expect(payout([4, 4, 4], 100)).toBe(5000)
  expect(payout([1, 1, 3], 100)).toBe(150)
  expect(payout([1, 2, 3], 100)).toBe(0)
  expect(payout([1, 2, 1], 100)).toBe(0)
  expect(payout([2, 1, 1], 3)).toBe(4)
  expect(payout([0, 0, 0], 0)).toBe(0)
  for (const [n, multiplier] of [[0, 20], [1, 10], [2, 5], [3, 3], [4, 50]]) {
    expect(payout([n!, n!, n!], 10)).toBe(multiplier! * 10)
  }
})

test('slot: random generator covers first and last symbols', () => {
  expect(spinResult(() => 0)).toEqual([0, 0, 0])
  expect(spinResult(() => 0.9999)).toEqual([4, 4, 4])
})

test('cells: one u32 triplet per cell', () => {
  const b64 = cells([0, 1, 2], [false, false, false])
  expect(Uint8Array.fromBase64(b64).length).toBe(COLS * ROWS * 12)
})
