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
  /** Truncated body from resources/read during scan (for guide link inference). */
  contentPreview?: string
  raw: unknown
}

export type McpDiscoveryOptions = {
  /** Sample resource bodies during scan (default true, capped by maxResourcesToRead). */
  readResourceBodies?: boolean
  maxResourcesToRead?: number
  maxResourceBodyChars?: number
}

export type DiscoveredResourceTemplate = {
  uriTemplate: string
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
  instructions?: string
  transportUsed: 'streamable-http' | 'sse'
  tools: DiscoveredTool[]
  resources: DiscoveredResource[]
  resourceTemplates: DiscoveredResourceTemplate[]
  prompts: DiscoveredPrompt[]
}

export type McpCapabilitiesSnapshot = {
  serverInfo?: McpServerInfo
  instructions?: string
  tools: DiscoveredTool[]
  resources: DiscoveredResource[]
  resourceTemplates: DiscoveredResourceTemplate[]
  prompts: DiscoveredPrompt[]
}

export type McpTestResult = {
  ok: boolean
  transportUsed?: 'streamable-http' | 'sse'
  serverInfo?: McpServerInfo
  toolCount?: number
  resourceCount?: number
  resourceTemplateCount?: number
  promptCount?: number
  error?: string
}
