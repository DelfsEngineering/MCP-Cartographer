import { config } from 'dotenv'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

import Fastify from 'fastify'
import cors from '@fastify/cors'
import { discoverMcpServer, testMcpConnection, type McpConnectionConfig } from '@mcp-cartographer/mcp-client'
import { buildScanDocumentFromDiscovery, redactSecrets } from '@mcp-cartographer/scan-core'

const PORT = Number(process.env.PORT ?? 3333)
const isDev = process.env.NODE_ENV !== 'production'

const SECRET_HEADER_KEYS = /api[-_]?key|authorization|token|secret|password/i

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
  origin: isDev ? true : false,
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

try {
  await app.listen({ port: PORT, host: '127.0.0.1' })
  console.log(`MCP Cartographer API listening on http://127.0.0.1:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
