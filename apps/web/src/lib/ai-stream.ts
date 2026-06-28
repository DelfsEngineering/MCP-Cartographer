import { slimScanForChat } from '@mcp-cartographer/scan-core'

export type StreamPhase = 'thinking' | 'testing' | 'streaming'

export type AiStreamEvent =
  | { type: 'status'; phase: StreamPhase; detail?: string }
  | { type: 'delta'; content: string }
  | { type: 'done'; model: string }
  | { type: 'error'; error: string }

export type AiStreamCallbacks = {
  onStatus?: (phase: StreamPhase, detail?: string) => void
  onDelta?: (content: string) => void
  onDone?: (model: string) => void
  onError?: (error: string) => void
}

function connectionPayload(form: import('@/lib/api').ConnectionForm) {
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

export async function streamAiChat(
  payload: {
    apiKey: string
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    scan: import('@mcp-cartographer/shared').ScanDocument
    selectedNodeId?: string | null
    connection?: import('@/lib/api').ConnectionForm | null
  },
  callbacks: AiStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const body: Record<string, unknown> = {
    apiKey: payload.apiKey,
    messages: payload.messages,
    scan: slimScanForChat(payload.scan),
    selectedNodeId: payload.selectedNodeId,
  }
  if (payload.connection?.endpoint?.trim()) {
    body.connection = connectionPayload(payload.connection)
  }

  let res: Response
  try {
    res = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    callbacks.onError?.(
      msg === 'Failed to fetch'
        ? 'Cannot reach API — run pnpm dev:api in a terminal.'
        : msg,
    )
    return
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = await res.json() as { error?: string }
      if (data.error) message = data.error
    } catch {
      if (res.status === 404) message = 'API route not found. Restart the API: pnpm dev:api'
    }
    callbacks.onError?.(message)
    return
  }

  if (!res.body) {
    callbacks.onError?.('No response stream')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sawError = false
  let sawDone = false

  function handleEvent(event: AiStreamEvent) {
    switch (event.type) {
      case 'status':
        callbacks.onStatus?.(event.phase, event.detail)
        break
      case 'delta':
        callbacks.onDelta?.(event.content)
        break
      case 'done':
        if (!sawError) {
          sawDone = true
          callbacks.onDone?.(event.model)
        }
        break
      case 'error':
        sawError = true
        callbacks.onError?.(event.error)
        break
    }
  }

  function parseLine(line: string) {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      handleEvent(JSON.parse(trimmed) as AiStreamEvent)
    } catch {
      // ignore malformed chunks
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      parseLine(line)
    }
  }

  if (buffer.trim()) {
    parseLine(buffer)
  }

  if (!sawDone && !sawError) {
    callbacks.onError?.('Chat stream ended without a response — check API logs and your OpenAI key')
  }
}
