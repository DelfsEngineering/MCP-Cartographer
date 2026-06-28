import {
  ASSISTANT_SYSTEM_PROMPT,
  buildAssistantConnectionNote,
  formatAssistantScanContext,
  buildAssistantScanContext,
} from '@mcp-cartographer/scan-core'
import type { ScanDocument } from '@mcp-cartographer/shared'
import {
  buildAssistantOpenAiTools,
  describeAssistantToolCall,
  executeAssistantToolCall,
  parseAssistantToolCall,
  type McpAssistantConnection,
} from './mcp-live'

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const MAX_TOOL_ROUNDS = 12

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AiChatRequest = {
  apiKey: string
  messages: ChatMessage[]
  scan: ScanDocument
  selectedNodeId?: string | null
  connection?: McpAssistantConnection | null
}

export type AiChatResponse =
  | { ok: true; message: string; model: string }
  | { ok: false; error: string }

export type StreamPhase = 'thinking' | 'testing' | 'streaming'

export type StreamEvent =
  | { type: 'status'; phase: StreamPhase; detail?: string }
  | { type: 'delta'; content: string }
  | { type: 'done'; model: string }
  | { type: 'error'; error: string }

type OpenAiMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | {
      role: 'assistant'
      content: string | null
      tool_calls?: Array<{
        id: string
        type: 'function'
        function: { name: string; arguments: string }
      }>
    }
  | { role: 'tool'; tool_call_id: string; content: string }

type OpenAiCompletion = {
  model?: string
  choices?: Array<{
    message?: {
      content?: string | null
      tool_calls?: Array<{
        id: string
        type: 'function'
        function: { name: string; arguments: string }
      }>
    }
    finish_reason?: string
  }>
}

export function buildOpenAiMessages(req: AiChatRequest): OpenAiMessage[] {
  const hasConnection = Boolean(req.connection?.endpoint)
  const context = buildAssistantScanContext(req.scan, {
    selectedNodeId: req.selectedNodeId,
    hasLiveConnection: hasConnection,
  })
  const contextBlock = formatAssistantScanContext(context)

  return [
    { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `${buildAssistantConnectionNote(hasConnection)}\n\n## Current scan snapshot (JSON)\n\n\`\`\`json\n${contextBlock}\n\`\`\``,
    },
    ...req.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]
}

async function requestOpenAiCompletion(
  apiKey: string,
  messages: OpenAiMessage[],
  tools: ReturnType<typeof buildAssistantOpenAiTools>,
  signal?: AbortSignal,
): Promise<{ ok: true; data: OpenAiCompletion } | { ok: false; error: string; status?: number }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.35,
      max_tokens: 3500,
    }),
    signal,
  })

  if (!res.ok) {
    const errBody = await res.text()
    const message = errBody.slice(0, 300) || res.statusText
    return {
      ok: false,
      status: res.status,
      error: res.status === 401 ? 'Invalid OpenAI API key' : `OpenAI error (${res.status}): ${message}`,
    }
  }

  const data = (await res.json()) as OpenAiCompletion
  return { ok: true, data }
}

async function runWithAssistantTools(
  req: AiChatRequest,
  emit: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<{ ok: true; content: string; model: string } | { ok: false; error: string }> {
  const apiKey = req.apiKey.trim()
  const hasConnection = Boolean(req.connection?.endpoint)
  const tools = buildAssistantOpenAiTools(hasConnection)
  let messages = buildOpenAiMessages(req)
  let model = DEFAULT_MODEL
  let rounds = 0

  emit({ type: 'status', phase: 'thinking' })

  while (rounds < MAX_TOOL_ROUNDS) {
    if (signal?.aborted) {
      return { ok: false, error: 'Request cancelled' }
    }

    const result = await requestOpenAiCompletion(apiKey, messages, tools, signal)
    if (!result.ok) {
      return { ok: false, error: result.error }
    }

    if (result.data.model) model = result.data.model
    const message = result.data.choices?.[0]?.message
    if (!message) {
      return { ok: false, error: 'OpenAI returned an empty response' }
    }

    const toolCalls = message.tool_calls ?? []
    if (toolCalls.length === 0) {
      const content = message.content?.trim()
      if (!content) {
        return { ok: false, error: 'OpenAI returned an empty response' }
      }
      return { ok: true, content, model }
    }

    messages = [
      ...messages,
      {
        role: 'assistant' as const,
        content: message.content ?? '',
        tool_calls: toolCalls,
      },
    ]

    for (const toolCall of toolCalls) {
      if (signal?.aborted) {
        return { ok: false, error: 'Request cancelled' }
      }

      const parsed = parseAssistantToolCall(toolCall.function.name, toolCall.function.arguments)
      if ('error' in parsed) {
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ ok: false, error: parsed.error }),
        })
        continue
      }

      emit({
        type: 'status',
        phase: 'testing',
        detail: describeAssistantToolCall(parsed),
      })

      const toolResult = await executeAssistantToolCall(parsed, {
        scan: req.scan,
        connection: req.connection,
      })
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: toolResult,
      })
    }

    rounds += 1
    emit({ type: 'status', phase: 'thinking' })
  }

  return { ok: false, error: 'Too many inspection rounds — try a narrower question' }
}

function emitContentAsDeltas(content: string, emit: (event: StreamEvent) => void) {
  emit({ type: 'status', phase: 'streaming' })
  const chunkSize = 24
  for (let i = 0; i < content.length; i += chunkSize) {
    emit({ type: 'delta', content: content.slice(i, i + chunkSize) })
  }
}

export async function runAiChat(req: AiChatRequest): Promise<AiChatResponse> {
  const apiKey = req.apiKey.trim()
  if (!apiKey) {
    return { ok: false, error: 'apiKey is required' }
  }

  try {
    const result = await runWithAssistantTools(req, () => {}, undefined)
    if (!result.ok) return result
    return { ok: true, message: result.content, model: result.model }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function streamOpenAiChat(
  req: AiChatRequest,
  emit: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<{ ok: true; model: string } | { ok: false; error: string }> {
  const apiKey = req.apiKey.trim()
  if (!apiKey) {
    return { ok: false, error: 'apiKey is required' }
  }

  try {
    const result = await runWithAssistantTools(req, emit, signal)
    if (!result.ok) {
      if (result.error !== 'Request cancelled') {
        emit({ type: 'error', error: result.error })
      }
      return result
    }
    emitContentAsDeltas(result.content, emit)
    emit({ type: 'done', model: result.model })
    return { ok: true, model: result.model }
  } catch (error) {
    if (signal?.aborted) {
      return { ok: false, error: 'Request cancelled' }
    }
    const message = error instanceof Error ? error.message : String(error)
    emit({ type: 'error', error: message })
    return { ok: false, error: message }
  }
}
