import type { ScanDocument } from '@mcp-cartographer/shared'
import type { McpConnectionConfig } from '@mcp-cartographer/mcp-client'
import type { AiChatRequest, ChatMessage } from './chat'

export type ParsedChatBody =
  | { ok: true; request: AiChatRequest }
  | { ok: false; error: string; status: number }

function parseConnection(body: Record<string, unknown>): McpConnectionConfig | null {
  const raw = body.connection
  if (!raw || typeof raw !== 'object') return null

  const c = raw as Record<string, unknown>
  const name = typeof c.name === 'string' ? c.name.trim() : ''
  const endpoint = typeof c.endpoint === 'string' ? c.endpoint.trim() : ''
  if (!name || !endpoint) return null

  try {
    new URL(endpoint)
  } catch {
    return null
  }

  const headers =
    c.headers && typeof c.headers === 'object'
      ? Object.fromEntries(
          Object.entries(c.headers as Record<string, unknown>)
            .filter(([, v]) => typeof v === 'string' && v.length > 0)
            .map(([k, v]) => [k, v as string]),
        )
      : undefined

  return {
    name,
    endpoint,
    headers: headers && Object.keys(headers).length ? headers : undefined,
    transport: 'streamable_http',
  }
}

export function parseChatBody(body: unknown): ParsedChatBody {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body', status: 400 }
  }

  const b = body as Record<string, unknown>
  const apiKey = typeof b.apiKey === 'string' ? b.apiKey.trim() : ''
  if (!apiKey) {
    return { ok: false, error: 'apiKey is required', status: 400 }
  }
  if (!b.scan || typeof b.scan !== 'object') {
    return { ok: false, error: 'scan document is required', status: 400 }
  }
  if (!Array.isArray(b.messages) || b.messages.length === 0) {
    return { ok: false, error: 'messages array is required', status: 400 }
  }

  const messages = b.messages
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        typeof m === 'object' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string',
    )
    .map((m) => ({ role: m.role, content: m.content }))

  if (!messages.length) {
    return { ok: false, error: 'At least one valid message is required', status: 400 }
  }

  return {
    ok: true,
    request: {
      apiKey,
      messages,
      scan: b.scan as ScanDocument,
      selectedNodeId: typeof b.selectedNodeId === 'string' ? b.selectedNodeId : null,
      connection: parseConnection(b),
    },
  }
}
