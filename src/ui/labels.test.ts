import { describe, expect, it } from 'vitest'
import { describeHistory } from './labels'

describe('describeHistory', () => {
  it('merges runs of folds', () => {
    expect(describeHistory(['UTG folds', 'UTG+1 folds', 'MP folds', 'LJ raises to 2.5bb', 'HJ folds'])).toEqual([
      'UTG to MP fold',
      'LJ raises to 2.5bb',
      'HJ folds',
    ])
    expect(describeHistory(['UTG folds', 'UTG+1 folds'])).toEqual(['UTG and UTG+1 fold'])
    expect(describeHistory([])).toEqual([])
  })
})
