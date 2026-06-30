import { describe, expect, it } from 'vitest'
import { getAvcCodecCandidates } from './capabilities'

describe('getAvcCodecCandidates', () => {
  it('selects a level valid for high-resolution portrait video', () => {
    const candidates = getAvcCodecCandidates(1440, 2500, 30)

    expect(candidates[0]).toBe('avc1.640032')
    expect(candidates).not.toContain('avc1.640028')
  })

  it('returns no invalid codec for dimensions beyond AVC level 5.2', () => {
    expect(getAvcCodecCandidates(8000, 8000, 60)).toEqual([])
  })
})
