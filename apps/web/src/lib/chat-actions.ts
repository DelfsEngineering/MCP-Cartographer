import type { ChatUIAction } from '@mcp-cartographer/shared'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

/** Strip trailing UI action JSON line from assistant text for display. */
export function parseAssistantActions(content: string): {
  displayContent: string
  actions: ChatUIAction[]
} {
  const lines = content.trimEnd().split('\n')
  const last = lines[lines.length - 1]?.trim()
  if (!last?.startsWith('{') || !last.includes('"actions"')) {
    return { displayContent: content, actions: [] }
  }
  try {
    const parsed = JSON.parse(last) as { actions?: ChatUIAction[] }
    if (!Array.isArray(parsed.actions)) {
      return { displayContent: content, actions: [] }
    }
    const valid = parsed.actions.filter((a) => a && typeof a.type === 'string') as ChatUIAction[]
    if (!valid.length) return { displayContent: content, actions: [] }
    return {
      displayContent: lines.slice(0, -1).join('\n').trimEnd(),
      actions: valid,
    }
  } catch {
    return { displayContent: content, actions: [] }
  }
}
