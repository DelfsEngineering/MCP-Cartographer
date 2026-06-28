import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import type { McpConnectionConfig } from './types.js'

type ConnectedClient = {
  client: Client
  transport: StreamableHTTPClientTransport | SSEClientTransport
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
    return { client, transport }
  } catch (streamableError) {
    const transport = new SSEClientTransport(url, opts)
    const client = new Client({ name: 'mcp-cartographer', version: '0.1.0' })
    await client.connect(transport)
    return { client, transport }
  }
}

async function disconnect(session: ConnectedClient): Promise<void> {
  try {
    await session.client.close()
  } catch {
    // ignore close errors
  }
}

export type McpLiveResult<T = unknown> =
  | { ok: true; data: T; durationMs: number }
  | { ok: false; error: string; durationMs: number }

async function withSession<T>(
  config: McpConnectionConfig,
  fn: (client: Client) => Promise<T>,
): Promise<McpLiveResult<T>> {
  const started = Date.now()
  let session: ConnectedClient | null = null
  try {
    session = await connect(config)
    const data = await fn(session.client)
    return { ok: true, data, durationMs: Date.now() - started }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    }
  } finally {
    if (session) await disconnect(session)
  }
}

export async function callMcpTool(
  config: McpConnectionConfig,
  toolName: string,
  args?: Record<string, unknown>,
): Promise<McpLiveResult> {
  return withSession(config, async (client) => {
    const result = await client.callTool({
      name: toolName,
      arguments: args ?? {},
    })
    return result
  })
}

export async function readMcpResource(
  config: McpConnectionConfig,
  uri: string,
): Promise<McpLiveResult> {
  return withSession(config, async (client) => {
    const result = await client.readResource({ uri })
    return result
  })
}

export async function getMcpPrompt(
  config: McpConnectionConfig,
  name: string,
  args?: Record<string, string>,
): Promise<McpLiveResult> {
  return withSession(config, async (client) => {
    const result = await client.getPrompt({
      name,
      arguments: args,
    })
    return result
  })
}

export async function listMcpCapabilities(
  config: McpConnectionConfig,
  scope?: 'all' | 'tools' | 'resources' | 'resource_templates' | 'prompts' | 'server',
): Promise<McpLiveResult<import('./types.js').McpCapabilitiesSnapshot>> {
  return withSession(config, async (client) => {
    const wantAll = !scope || scope === 'all' || scope === 'server'
    const wantTools = wantAll || scope === 'tools'
    const wantResources = wantAll || scope === 'resources'
    const wantTemplates = wantAll || scope === 'resource_templates'
    const wantPrompts = wantAll || scope === 'prompts'

    const [toolsResult, resourcesResult, templatesResult, promptsResult] = await Promise.all([
      wantTools ? client.listTools().catch(() => ({ tools: [] })) : Promise.resolve({ tools: [] }),
      wantResources ? client.listResources().catch(() => ({ resources: [] })) : Promise.resolve({ resources: [] }),
      wantTemplates
        ? client.listResourceTemplates().catch(() => ({ resourceTemplates: [] }))
        : Promise.resolve({ resourceTemplates: [] }),
      wantPrompts ? client.listPrompts().catch(() => ({ prompts: [] })) : Promise.resolve({ prompts: [] }),
    ])

    return {
      serverInfo: client.getServerVersion?.(),
      instructions: client.getInstructions?.() || undefined,
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
      resourceTemplates: (templatesResult.resourceTemplates ?? []).map((r) => ({
        uriTemplate: r.uriTemplate,
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
  })
}
