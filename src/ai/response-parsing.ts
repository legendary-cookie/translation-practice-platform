export function parseJsonResponse(content: string): unknown {
  const withoutThinking = content.trim().replace(/^<think>[\s\S]*?<\/think>\s*/i, '')
  const withoutFence = withoutThinking.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    return JSON.parse(withoutFence) as unknown
  } catch {
    throw new Error('The evaluator returned malformed JSON.')
  }
}
