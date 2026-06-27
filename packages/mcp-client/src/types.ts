export type McpConnectionConfig = {
  name: string
  endpoint: string
  transport?: 'streamable_http' | 'sse' | 'http'
  headers?: Record<string, string>
}

export type McpServerInfo = {
  name?: string
  version?: string
}

export type DiscoveredTool = {
  name: string
  description?: string
  inputSchema?: unknown
  outputSchema?: unknown
  annotations?: unknown
  raw: unknown
}

export type DiscoveredResource = {
  uri: string
  name?: string
  description?: string
  mimeType?: string
  raw: unknown
}

export type DiscoveredPrompt = {
  name: string
  description?: string
  arguments?: unknown
  raw: unknown
}

export type McpDiscoveryResult = {
  serverInfo?: McpServerInfo
  transportUsed: 'streamable-http' | 'sse'
  tools: DiscoveredTool[]
  resources: DiscoveredResource[]
  prompts: DiscoveredPrompt[]
}

export type McpTestResult = {
  ok: boolean
  transportUsed?: 'streamable-http' | 'sse'
  serverInfo?: McpServerInfo
  toolCount?: number
  resourceCount?: number
  promptCount?: number
  error?: string
}
