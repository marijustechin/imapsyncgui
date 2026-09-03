export const MAX_OUTPUT_CHARS = 100_000

export function appendOutput(prev: string, text: string, max: number = MAX_OUTPUT_CHARS): string {
  if (text.length === 0) {
    return prev
  }
  const combined = prev + text
  if (combined.length <= max) {
    return combined
  }
  return combined.slice(combined.length - max)
}
