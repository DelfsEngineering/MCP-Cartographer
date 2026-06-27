import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import type {
  McpConnectionConfig,
  McpDiscoveryResult,
  McpTestResult,
} from './types.js'

type ConnectedClient = {
  client: Client
  transport: StreamableHTTPClientTransport | SSEClientTransport
  transportUsed: 'streamable-http' | 'sse'
}

function transportOptions(headers?: Record<string, string>) {
  if (!headers || Object.keys(headers).length === 0) return undefined
  return { requestInit: { headers } }
}

async function connect(config: McpConnectionConfig): Promise<ConnectedClient> {
  const url = new URL(config.endpoint)
  const opts = transportOptions(config.headers)

  try {
    const transport = new StreamableHTTPClientTransport(url, opts)
    const client = new Client({ name: 'mcp-cartographer', version: '0.1.0' })
    await client.connect(transport)
    return { client, transport, transportUsed: 'streamable-http' }
  } catch (streamableError) {
    try {
      const transport = new SSEClientTransport(url, opts)
      const client = new Client({ name: 'mcp-cartographer', version: '0.1.0' })
      await client.connect(transport)
      return { client, transport, transportUsed: 'sse' }
    } catch (sseError) {
      const msg = sseError instanceof Error ? sseError.message : String(sseError)
      const streamMsg = streamableError instanceof Error ? streamableError.message : String(streamableError)
      throw new Error(`Could not connect to MCP server. Streamable HTTP: ${streamMsg}. SSE: ${msg}`)
    }
  }
}

async function disconnect(session: ConnectedClient): Promise<void> {
  try {
    await session.client.close()
  } catch {
    // ignore close errors
  }
}

export async function testMcpConnection(config: McpConnectionConfig): Promise<McpTestResult> {
  let session: ConnectedClient | null = null
  try {
    session = await connect(config)
    const [tools, resources, prompts] = await Promise.all([
      session.client.listTools().catch(() => ({ tools: [] })),
      session.client.listResources().catch(() => ({ resources: [] })),
      session.client.listPrompts().catch(() => ({ prompts: [] })),
    ])

    return {
      ok: true,
      transportUsed: session.transportUsed,
      serverInfo: session.client.getServerVersion?.() ?? undefined,
      toolCount: tools.tools?.length ?? 0,
      resourceCount: resources.resources?.length ?? 0,
      promptCount: prompts.prompts?.length ?? 0,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    if (session) await disconnect(session)
  }
}

export async function discoverMcpServer(config: McpConnectionConfig): Promise<McpDiscoveryResult> {
  let session: ConnectedClient | null = null
  try {
    session = await connect(config)
    const [toolsResult, resourcesResult, promptsResult] = await Promise.all([
      session.client.listTools(),
      session.client.listResources().catch(() => ({ resources: [] })),
      session.client.listPrompts().catch(() => ({ prompts: [] })),
    ])

    return {
      serverInfo: session.client.getServerVersion?.() ?? { name: config.name },
      transportUsed: session.transportUsed,
      tools: (toolsResult.tools ?? []).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        outputSchema: (t as { outputSchema?: unknown }).outputSchema,
        annotations: (t as { annotations?: unknown }).annotations,
        raw: t,
      })),
      resources: (resourcesResult.resources ?? []).map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
        raw: r,
      })),
      prompts: (promptsResult.prompts ?? []).map((p) => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments,
        raw: p,
      })),
    }
  } finally {
    if (session) await disconnect(session)
  }
}
