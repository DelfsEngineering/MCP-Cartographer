import { slimScanForChat } from '@mcp-cartographer/scan-core'

export type ConnectionForm = {
  name: string
  endpoint: string
  headers: Array<{ key: string; value: string }>
}

/** Plain-object clone — safe for Vue reactive store values (structuredClone cannot clone proxies). */
export function cloneConnectionForm(form: ConnectionForm): ConnectionForm {
  return {
    name: form.name,
    endpoint: form.endpoint,
    headers: form.headers.map((h) => ({ key: h.key, value: h.value })),
  }
}

export type McpTestResponse = {
  ok: boolean
  transportUsed?: string
  toolCount?: number
  resourceCount?: number
  promptCount?: number
  error?: string
}

export type McpScanResponse = {
  ok: boolean
  transportUsed?: string
  scan?: import('@mcp-cartographer/shared').ScanDocument
  error?: string
}

function connectionPayload(form: ConnectionForm) {
  const headers: Record<string, string> = {}
  for (const { key, value } of form.headers) {
    const k = key.trim()
    if (k && value) headers[k] = value
  }
  return {
    name: form.name.trim(),
    endpoint: form.endpoint.trim(),
    headers: Object.keys(headers).length ? headers : undefined,
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  let data: T & { ok?: boolean; error?: string; message?: string }
  try {
    data = await res.json() as T & { ok?: boolean; error?: string; message?: string }
  } catch {
    if (res.status === 404) {
      throw new Error('API route not found. Restart the API: pnpm dev:api')
    }
    throw new Error(`Request failed (${res.status})`)
  }
  if (!res.ok && !data.ok) {
    if (res.status === 404) {
      throw new Error('API route not found. Restart the API: pnpm dev:api')
    }
    throw new Error(data.error ?? data.message ?? `Request failed (${res.status})`)
  }
  return data
}

export async function testConnection(form: ConnectionForm): Promise<McpTestResponse> {
  return apiFetch<McpTestResponse>('/api/mcp/test', {
    method: 'POST',
    body: JSON.stringify(connectionPayload(form)),
  })
}

export async function runMcpScan(form: ConnectionForm): Promise<McpScanResponse> {
  return apiFetch<McpScanResponse>('/api/mcp/scan', {
    method: 'POST',
    body: JSON.stringify(connectionPayload(form)),
  })
}

export type McpLiveReadResponse = {
  ok: boolean
  data?: unknown
  durationMs?: number
  error?: string
}

function liveMcpBody(form: ConnectionForm, extra: Record<string, unknown>) {
  return JSON.stringify({ ...connectionPayload(form), ...extra })
}

export async function readMcpResource(
  form: ConnectionForm,
  uri: string,
): Promise<McpLiveReadResponse> {
  return apiFetch<McpLiveReadResponse>('/api/mcp/read-resource', {
    method: 'POST',
    body: liveMcpBody(form, { uri }),
  })
}

export async function getMcpPrompt(
  form: ConnectionForm,
  name: string,
  args?: Record<string, string>,
): Promise<McpLiveReadResponse> {
  return apiFetch<McpLiveReadResponse>('/api/mcp/get-prompt', {
    method: 'POST',
    body: liveMcpBody(form, { name, arguments: args }),
  })
}

export async function fetchDevConnection(): Promise<ConnectionForm | null> {
  try {
    const data = await apiFetch<{
      available: boolean
      connection?: { name: string; endpoint: string; headers?: Record<string, string> }
    }>('/api/dev/connection')
    if (!data.available || !data.connection) return null
    return {
      name: data.connection.name,
      endpoint: data.connection.endpoint,
      headers: Object.entries(data.connection.headers ?? {}).map(([key, value]) => ({ key, value })),
    }
  } catch {
    return null
  }
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const data = await apiFetch<{ ok: boolean }>('/api/health')
    return data.ok
  } catch {
    return false
  }
}

export type OpenAiValidateResponse = {
  ok: boolean
  error?: string
}

export type ChatHistoryMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AiChatResponse = {
  ok: boolean
  message?: string
  model?: string
  error?: string
}

export async function validateOpenAiKey(apiKey: string): Promise<OpenAiValidateResponse> {
  return apiFetch<OpenAiValidateResponse>('/api/openai/validate', {
    method: 'POST',
    body: JSON.stringify({ apiKey: apiKey.trim() }),
  })
}

/** For future AI routes — key stays in the browser, sent per request only. */
export function openAiKeyHeader(apiKey: string): Record<string, string> {
  return apiKey ? { 'X-OpenAI-Api-Key': apiKey } : {}
}

export async function sendAiChat(payload: {
  apiKey: string
  messages: ChatHistoryMessage[]
  scan: import('@mcp-cartographer/shared').ScanDocument
  selectedNodeId?: string | null
  connection?: ConnectionForm | null
}): Promise<AiChatResponse> {
  const body: Record<string, unknown> = {
    ...payload,
    scan: slimScanForChat(payload.scan),
  }
  if (payload.connection?.endpoint?.trim()) {
    const headers: Record<string, string> = {}
    for (const { key, value } of payload.connection.headers) {
      const k = key.trim()
      if (k && value) headers[k] = value
    }
    body.connection = {
      name: payload.connection.name.trim(),
      endpoint: payload.connection.endpoint.trim(),
      headers: Object.keys(headers).length ? headers : undefined,
    }
  } else {
    delete body.connection
  }

  return apiFetch<AiChatResponse>('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export { streamAiChat, type AiStreamCallbacks } from './ai-stream'
