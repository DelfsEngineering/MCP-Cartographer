import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import {
  discoverMcpServer,
  testMcpConnection,
  readMcpResource,
  getMcpPrompt,
  type McpConnectionConfig,
} from '@mcp-cartographer/mcp-client'
import { buildScanDocumentFromDiscovery, redactSecrets } from '@mcp-cartographer/scan-core'
import { runAiChat, streamOpenAiChat, type StreamEvent } from './assistant/chat.js'
import { parseChatBody } from './assistant/parse-chat-body.js'

const isDev = process.env.NODE_ENV !== 'production'

const SECRET_HEADER_KEYS = /api[-_]?key|authorization|token|secret|password/i

function corsOrigin(): boolean | string | string[] {
  if (isDev) return true
  // Same-origin when web + API share one Vercel deployment; comma-list for extra origins.
  const allowed = process.env.ALLOWED_ORIGINS
  if (!allowed?.trim()) return true
  return allowed.split(',').map((s) => s.trim()).filter(Boolean)
}

function redactHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
  if (!headers) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SECRET_HEADER_KEYS.test(k) ? '[REDACTED]' : v
  }
  return out
}

function parseConnection(body: unknown): McpConnectionConfig | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid request body' }
  const b = body as Record<string, unknown>
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  const endpoint = typeof b.endpoint === 'string' ? b.endpoint.trim() : ''
  if (!name) return { error: 'Connection name is required' }
  if (!endpoint) return { error: 'Endpoint URL is required' }
  try {
    new URL(endpoint)
  } catch {
    return { error: 'Endpoint must be a valid URL' }
  }
  const headers = b.headers && typeof b.headers === 'object'
    ? Object.fromEntries(
        Object.entries(b.headers as Record<string, unknown>)
          .filter(([, v]) => typeof v === 'string' && v.length > 0)
          .map(([k, v]) => [k, v as string]),
      )
    : undefined
  return { name, endpoint, headers, transport: 'streamable_http' }
}

function devConnectionFromEnv(): McpConnectionConfig | null {
  const endpoint = process.env.MCP_DEV_URL
  if (!endpoint) return null
  const headers: Record<string, string> = {}
  if (process.env.MCP_DEV_X_API_KEY) headers['X-Api-Key'] = process.env.MCP_DEV_X_API_KEY
  if (process.env.MCP_DEV_X_BF_ENV_NAME) headers['X-BF-Env-Name'] = process.env.MCP_DEV_X_BF_ENV_NAME
  if (process.env.MCP_DEV_X_BF_ID_ENVIRONMENT) headers['X-BF-Id-Environment'] = process.env.MCP_DEV_X_BF_ID_ENVIRONMENT
  if (process.env.MCP_DEV_X_BF_ID_USER) headers['X-BF-Id-User'] = process.env.MCP_DEV_X_BF_ID_USER
  return {
    name: process.env.MCP_DEV_NAME ?? 'Development MCP',
    endpoint,
    headers: Object.keys(headers).length ? headers : undefined,
    transport: 'streamable_http',
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: 'info',
      serializers: {
        req(req) {
          return { method: req.method, url: req.url }
        },
      },
    },
  })

  await app.register(cors, {
    origin: corsOrigin(),
  })

  app.get('/api/health', async () => ({ ok: true, service: 'mcp-cartographer-api' }))

  if (isDev) {
    app.get('/api/dev/connection', async () => {
      const conn = devConnectionFromEnv()
      if (!conn) {
        return { available: false }
      }
      return {
        available: true,
        connection: {
          name: conn.name,
          endpoint: conn.endpoint,
          headers: conn.headers,
        },
      }
    })
  }

  app.post('/api/mcp/test', async (request, reply) => {
    const parsed = parseConnection(request.body)
    if ('error' in parsed) {
      return reply.status(400).send({ ok: false, error: parsed.error })
    }
    request.log.info({ endpoint: parsed.endpoint, headers: redactHeaders(parsed.headers) }, 'Testing MCP connection')
    const result = await testMcpConnection(parsed)
    if (!result.ok) {
      return reply.status(502).send(result)
    }
    return result
  })

  app.post('/api/mcp/scan', async (request, reply) => {
    const parsed = parseConnection(request.body)
    if ('error' in parsed) {
      return reply.status(400).send({ ok: false, error: parsed.error })
    }
    request.log.info({ endpoint: parsed.endpoint, headers: redactHeaders(parsed.headers) }, 'Running MCP scan')
    try {
      const discovery = await discoverMcpServer(parsed)
      const doc = buildScanDocumentFromDiscovery(parsed.name, discovery)
      return {
        ok: true,
        transportUsed: discovery.transportUsed,
        scan: doc,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      request.log.error({ err: redactSecrets(message) }, 'MCP scan failed')
      return reply.status(502).send({ ok: false, error: message })
    }
  })

  app.post('/api/mcp/read-resource', async (request, reply) => {
    if (!request.body || typeof request.body !== 'object') {
      return reply.status(400).send({ ok: false, error: 'Invalid request body' })
    }
    const b = request.body as Record<string, unknown>
    const parsed = parseConnection(b)
    if ('error' in parsed) {
      return reply.status(400).send({ ok: false, error: parsed.error })
    }
    const uri = typeof b.uri === 'string' ? b.uri.trim() : ''
    if (!uri) {
      return reply.status(400).send({ ok: false, error: 'uri is required' })
    }
    const result = await readMcpResource(parsed, uri)
    if (!result.ok) {
      return reply.status(502).send({ ok: false, error: result.error, durationMs: result.durationMs })
    }
    return { ok: true, data: result.data, durationMs: result.durationMs }
  })

  app.post('/api/mcp/get-prompt', async (request, reply) => {
    if (!request.body || typeof request.body !== 'object') {
      return reply.status(400).send({ ok: false, error: 'Invalid request body' })
    }
    const b = request.body as Record<string, unknown>
    const parsed = parseConnection(b)
    if ('error' in parsed) {
      return reply.status(400).send({ ok: false, error: parsed.error })
    }
    const name = typeof b.name === 'string' ? b.name.trim() : ''
    if (!name) {
      return reply.status(400).send({ ok: false, error: 'name is required' })
    }
    const rawArgs = b.arguments
    const args: Record<string, string> = {}
    if (rawArgs && typeof rawArgs === 'object') {
      for (const [k, v] of Object.entries(rawArgs as Record<string, unknown>)) {
        if (typeof v === 'string') args[k] = v
      }
    }
    const result = await getMcpPrompt(parsed, name, args)
    if (!result.ok) {
      return reply.status(502).send({ ok: false, error: result.error, durationMs: result.durationMs })
    }
    return { ok: true, data: result.data, durationMs: result.durationMs }
  })

  app.post('/api/openai/validate', async (request, reply) => {
    const body = request.body as { apiKey?: string } | undefined
    const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : ''
    if (!apiKey) {
      return reply.status(400).send({ ok: false, error: 'apiKey is required' })
    }
    if (!apiKey.startsWith('sk-')) {
      return reply.status(400).send({ ok: false, error: 'OpenAI API keys usually start with sk-' })
    }

    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (res.ok) {
        return { ok: true }
      }
      const errBody = await res.text()
      const message = errBody.slice(0, 200) || res.statusText
      request.log.info({ status: res.status }, 'OpenAI key validation failed')
      return reply.status(502).send({
        ok: false,
        error: res.status === 401 ? 'Invalid API key' : `OpenAI returned ${res.status}: ${message}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return reply.status(502).send({ ok: false, error: message })
    }
  })

  app.post('/api/ai/chat', async (request, reply) => {
    const parsed = parseChatBody(request.body)
    if (!parsed.ok) {
      return reply.status(parsed.status).send({ ok: false, error: parsed.error })
    }

    const result = await runAiChat(parsed.request)
    if (!result.ok) {
      return reply.status(502).send(result)
    }
    return result
  })

  app.post('/api/ai/chat/stream', async (request, reply) => {
    const parsed = parseChatBody(request.body)
    if (!parsed.ok) {
      return reply.status(parsed.status).send({ ok: false, error: parsed.error })
    }

    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Transfer-Encoding': 'chunked',
    })
    reply.raw.flushHeaders?.()

    const write = (event: StreamEvent) => {
      if (reply.raw.writableEnded) return
      reply.raw.write(`${JSON.stringify(event)}\n`)
      const res = reply.raw as typeof reply.raw & { flush?: () => void }
      res.flush?.()
    }

    const abortController = new AbortController()
    const onClientClose = () => abortController.abort()
    request.raw.on('aborted', onClientClose)
    reply.raw.on('close', onClientClose)

    let streamFailed = false
    const result = await streamOpenAiChat(parsed.request, (event) => {
      if (event.type === 'error') streamFailed = true
      write(event)
    }, abortController.signal)

    if (!result.ok && result.error !== 'Request cancelled' && !streamFailed) {
      write({ type: 'error', error: result.error })
    }
    reply.raw.end()
  })

  return app
}
