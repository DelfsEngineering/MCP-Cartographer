export type GraphNodeType =
  | 'server'
  | 'tool'
  | 'resource'
  | 'prompt'
  | 'schema'
  | 'concept'
  | 'risk'
  | 'finding'
  | 'probe_result'

export type GraphEdgeType =
  | 'exposes'
  | 'documents'
  | 'uses_schema'
  | 'returns'
  | 'references'
  | 'related_to'
  | 'requires_auth'
  | 'writes_to'
  | 'reads_from'
  | 'missing_link'
  | 'has_finding'
  | 'has_probe_result'

export type Severity = 'info' | 'low' | 'medium' | 'high'

export type GraphNode = {
  id: string
  scanId: string
  type: GraphNodeType
  label: string
  description?: string
  score?: number
  severity?: Severity
  raw?: unknown
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GraphEdge = {
  id: string
  scanId: string
  sourceNodeId: string
  targetNodeId: string
  type: GraphEdgeType
  confidence: number
  inferredBy: 'mcp' | 'deterministic' | 'ai' | 'user'
  explanation?: string
  createdAt: string
}

export type MCPConnection = {
  id: string
  name: string
  transport: 'http' | 'sse' | 'streamable_http' | 'stdio'
  endpoint?: string
  command?: string
  args?: string[]
  headers?: Record<string, string>
  authType?: 'none' | 'bearer' | 'api_key' | 'custom_headers'
  createdAt: string
  updatedAt: string
}

export type ScanStatus = 'queued' | 'running' | 'analyzing' | 'complete' | 'failed'

export type Scan = {
  id: string
  connectionId?: string
  serverName: string
  status: ScanStatus
  progressPercent: number
  currentStep?: string
  error?: string
  startedAt: string
  completedAt?: string
  summary?: {
    tools: number
    resources: number
    prompts: number
    schemas: number
    findings: number
    score: number
  }
}

export type MCPToolRecord = {
  id: string
  scanId: string
  name: string
  description?: string
  inputSchema?: unknown
  outputSchema?: unknown
  annotations?: unknown
  raw: unknown
  descriptionScore?: number
  riskLevel?: 'none' | 'low' | 'medium' | 'high'
  inferredSideEffects?: string[]
}

export type MCPResourceRecord = {
  id: string
  scanId: string
  uri: string
  name?: string
  description?: string
  mimeType?: string
  contentPreview?: string
  contentHash?: string
  summary?: string
  raw?: unknown
  isOrphaned?: boolean
}

export type MCPPromptRecord = {
  id: string
  scanId: string
  name: string
  description?: string
  arguments?: unknown
  raw: unknown
  summary?: string
}

export type MCPServerMeta = {
  name?: string
  version?: string
  instructions?: string
}

export type MCPResourceTemplateRecord = {
  id: string
  scanId: string
  uriTemplate: string
  name?: string
  description?: string
  mimeType?: string
  raw?: unknown
}

export type FindingCategory =
  | 'weak_description'
  | 'missing_docs'
  | 'missing_schema'
  | 'missing_examples'
  | 'orphaned_resource'
  | 'unclear_side_effect'
  | 'unclear_auth'
  | 'security_risk'
  | 'agent_usability'
  | 'naming_issue'
  | 'duplicate_capability'

export type Finding = {
  id: string
  scanId: string
  targetNodeId?: string
  severity: Severity
  category: FindingCategory
  title: string
  message: string
  recommendation?: string
  evidence?: unknown
  createdAt: string
}

export type ProbeResult = {
  id: string
  scanId: string
  toolName: string
  input: unknown
  output?: unknown
  success: boolean
  error?: string
  durationMs: number
  createdAt: string
}

export type ScanDocument = {
  version: 1
  scan: Scan
  serverMeta?: MCPServerMeta
  tools: MCPToolRecord[]
  resources: MCPResourceRecord[]
  resourceTemplates?: MCPResourceTemplateRecord[]
  prompts: MCPPromptRecord[]
  graph: {
    nodes: GraphNode[]
    edges: GraphEdge[]
  }
  findings: Finding[]
  probeResults?: ProbeResult[]
}

export type VisualGraphNodeType = GraphNodeType

export type VisualGraphNode = {
  id: string
  type: VisualGraphNodeType
  label: string
  subtitle?: string
  score?: number
  severity?: Severity
  badges?: string[]
  issueCount?: number
  isOrphaned?: boolean
  isInferred?: boolean
  isRisky?: boolean
  position?: { x: number; y: number }
  rawRef?: {
    recordType: string
    recordId: string
  }
  description?: string
  raw?: unknown
}

export type VisualGraphEdge = {
  id: string
  source: string
  target: string
  type: GraphEdgeType
  label?: string
  confidence?: number
  inferredBy: 'mcp' | 'deterministic' | 'ai' | 'user'
  isSuggested?: boolean
}

export type VisualGraph = {
  nodes: VisualGraphNode[]
  edges: VisualGraphEdge[]
  summary: {
    score: number
    toolCount: number
    resourceCount: number
    promptCount: number
    schemaCount: number
    findingCount: number
  }
}

export type ChatUIAction =
  | { type: 'highlight_nodes'; nodeIds: string[] }
  | { type: 'focus_node'; nodeId: string }
  | { type: 'open_finding'; findingId: string }
  | { type: 'switch_mode'; mode: 'map' | 'inspector' | 'audit' | 'findings' }

export type AppMode = 'overview' | 'map' | 'inspector' | 'tools' | 'resources' | 'prompts' | 'findings' | 'probes' | 'raw'
