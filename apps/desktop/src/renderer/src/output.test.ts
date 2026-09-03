import { describe, expect, it } from 'vitest'
import { appendOutput, MAX_OUTPUT_CHARS } from './output'

describe('appendOutput', () => {
  it('appends text in order', () => {
    expect(appendOutput('abc', 'def')).toBe('abcdef')
  })

  it('returns the previous output unchanged for empty text', () => {
    expect(appendOutput('abc', '')).toBe('abc')
  })

  it('keeps the output bounded to the maximum size', () => {
    const result = appendOutput('', 'x'.repeat(MAX_OUTPUT_CHARS + 10))
    expect(result.length).toBe(MAX_OUTPUT_CHARS)
  })

  it('discards the oldest output when the limit is exceeded', () => {
    const result = appendOutput('abcdefgh', 'ijkl', 6)
    expect(result).toBe('ghijkl')
  })

  it('discards oldest across many small appends', () => {
    let output = ''
    for (let i = 0; i < 20; i += 1) {
      output = appendOutput(output, String.fromCharCode(97 + i), 5)
    }
    expect(output).toBe('pqrst')
  })
})
