import type { Finding, ScanDocument, Severity } from '@mcp-cartographer/shared'

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 }
const FULL_DETAIL_TOOL_LIMIT = 35
const FULL_DETAIL_PROMPT_LIMIT = 40
const RESOURCE_LIST_LIMIT = 200
const INSTRUCTIONS_MAX = 8000

function truncate(text: string | undefined, max: number): string | undefined {
  if (!text) return undefined
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function schemaFieldCount(schema: unknown): number | undefined {
  if (!schema || typeof schema !== 'object') return undefined
  const props = (schema as { properties?: Record<string, unknown> }).properties
  return props ? Object.keys(props).length : undefined
}

export type AssistantScanContext = {
  serverName: string
  scanId: string
  readinessScore: number
  serverMeta?: {
    name?: string
    version?: string
    instructions?: string
  }
  counts: {
    tools: number
    resources: number
    resourceTemplates: number
    prompts: number
    findings: number
    orphanedResources: number
  }
  selectedNode?: {
    id: string
    type: string
    label: string
    description?: string
    issueCount?: number
    detail?: unknown
  }
  tools: Array<Record<string, unknown>>
  resources: Array<Record<string, unknown>>
  resourceTemplates: Array<Record<string, unknown>>
  prompts: Array<Record<string, unknown>>
  findings: Array<{
    id: string
    severity: Severity
    category: string
    title: string
    message: string
    recommendation?: string
    targetNodeId?: string
  }>
  graphHints: {
    toolsWithInputSchema: number
    toolToResourceEdges: number
    note: string
  }
  assistantTools: {
    scan_describe_capability: string
    mcp_list_capabilities?: string
    mcp_call_tool?: string
    mcp_read_resource?: string
    mcp_get_prompt?: string
  }
}

function buildSelectedDetail(doc: ScanDocument, nodeId: string): unknown | undefined {
  if (nodeId.startsWith('node-tool-')) {
    const toolId = nodeId.replace('node-tool-', '')
    const tool = doc.tools.find((t) => t.id === toolId)
    if (!tool) return undefined
    return {
      kind: 'tool',
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations,
      riskLevel: tool.riskLevel,
    }
  }
  if (nodeId.startsWith('node-resource-')) {
    const resId = nodeId.replace('node-resource-', '')
    const resource = doc.resources.find((r) => r.id === resId)
    if (resource) {
      return {
        kind: 'resource',
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
        isOrphaned: resource.isOrphaned,
      }
    }
    const template = (doc.resourceTemplates ?? []).find((t) => t.id === resId)
    if (template) {
      return {
        kind: 'resource_template',
        uriTemplate: template.uriTemplate,
        name: template.name,
        description: template.description,
        mimeType: template.mimeType,
      }
    }
  }
  if (nodeId.startsWith('node-resource-template-')) {
    const tplId = nodeId.replace('node-resource-template-', '')
    const template = (doc.resourceTemplates ?? []).find((t) => t.id === tplId)
    if (!template) return undefined
    return {
      kind: 'resource_template',
      uriTemplate: template.uriTemplate,
      name: template.name,
      description: template.description,
      mimeType: template.mimeType,
    }
  }
  if (nodeId.startsWith('node-prompt-')) {
    const promptId = nodeId.replace('node-prompt-', '')
    const prompt = doc.prompts.find((p) => p.id === promptId)
    if (!prompt) return undefined
    return {
      kind: 'prompt',
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
    }
  }
  return undefined
}

function mapToolSummary(
  findingsByTarget: Map<string, number>,
  includeFullSchemas: boolean,
  tools: ScanDocument['tools'],
) {
  return tools.map((t) => {
    const nodeId = `node-tool-${t.id}`
    const base: Record<string, unknown> = {
      id: t.id,
      nodeId,
      name: t.name,
      description: t.description,
      inputFieldCount: schemaFieldCount(t.inputSchema),
      riskLevel: t.riskLevel,
      findingCount: findingsByTarget.get(nodeId) ?? 0,
    }
    if (includeFullSchemas) {
      base.inputSchema = t.inputSchema
      base.outputSchema = t.outputSchema
      base.annotations = t.annotations
    } else {
      base.hasInputSchema = Boolean(t.inputSchema)
      base.description = truncate(t.description, 500)
    }
    return base
  })
}

export function buildAssistantScanContext(
  doc: ScanDocument,
  options?: { selectedNodeId?: string | null; hasLiveConnection?: boolean },
): AssistantScanContext {
  const findingsByTarget = new Map<string, number>()
  for (const f of doc.findings) {
    if (f.targetNodeId) {
      findingsByTarget.set(f.targetNodeId, (findingsByTarget.get(f.targetNodeId) ?? 0) + 1)
    }
  }

  const selectedNodeId = options?.selectedNodeId
  const selectedGraphNode = selectedNodeId
    ? doc.graph.nodes.find((n) => n.id === selectedNodeId)
    : undefined

  const orphanedCount = doc.resources.filter((r) => r.isOrphaned).length
  const score = doc.scan.summary?.score ?? 0
  const templates = doc.resourceTemplates ?? []

  const sortedFindings = [...doc.findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  )

  const fullToolSchemas = doc.tools.length <= FULL_DETAIL_TOOL_LIMIT
  const fullPromptArgs = doc.prompts.length <= FULL_DETAIL_PROMPT_LIMIT

  const hasLive = Boolean(options?.hasLiveConnection)

  return {
    serverName: doc.scan.serverName,
    scanId: doc.scan.id,
    readinessScore: score,
    serverMeta: doc.serverMeta
      ? {
          name: doc.serverMeta.name,
          version: doc.serverMeta.version,
          instructions: truncate(doc.serverMeta.instructions, INSTRUCTIONS_MAX),
        }
      : undefined,
    counts: {
      tools: doc.tools.length,
      resources: doc.resources.length,
      resourceTemplates: templates.length,
      prompts: doc.prompts.length,
      findings: doc.findings.length,
      orphanedResources: orphanedCount,
    },
    selectedNode: selectedGraphNode
      ? {
          id: selectedGraphNode.id,
          type: selectedGraphNode.type,
          label: selectedGraphNode.label,
          description: selectedGraphNode.description,
          issueCount: findingsByTarget.get(selectedGraphNode.id),
          detail: buildSelectedDetail(doc, selectedGraphNode.id),
        }
      : undefined,
    tools: mapToolSummary(findingsByTarget, fullToolSchemas, doc.tools),
    resources: doc.resources.slice(0, RESOURCE_LIST_LIMIT).map((r) => ({
      id: r.id,
      nodeId: `node-resource-${r.id}`,
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
      isOrphaned: r.isOrphaned,
    })),
    resourceTemplates: templates.map((t) => ({
      id: t.id,
      uriTemplate: t.uriTemplate,
      name: t.name,
      description: t.description,
      mimeType: t.mimeType,
    })),
    prompts: doc.prompts.map((p) => {
      const base: Record<string, unknown> = {
        id: p.id,
        nodeId: `node-prompt-${p.id}`,
        name: p.name,
        description: fullPromptArgs ? p.description : truncate(p.description, 400),
      }
      if (fullPromptArgs) base.arguments = p.arguments
      return base
    }),
    findings: sortedFindings.slice(0, 50).map((f: Finding) => ({
      id: f.id,
      severity: f.severity,
      category: f.category,
      title: f.title,
      message: f.message,
      recommendation: f.recommendation,
      targetNodeId: f.targetNodeId,
    })),
    graphHints: {
      toolsWithInputSchema: doc.tools.filter((t) => t.inputSchema).length,
      toolToResourceEdges: doc.graph.edges.filter((e) => e.type === 'documents' || e.type === 'references').length,
      note: fullToolSchemas
        ? 'Full tool input/output schemas are included inline (server has ≤35 tools).'
        : 'Tool schemas are summarized — use scan_describe_capability for full JSON Schema of a specific tool.',
    },
    assistantTools: {
      scan_describe_capability:
        'Always available. Returns full schema/metadata for a tool, resource, resource_template, or prompt from the scan.',
      ...(hasLive
        ? {
            mcp_list_capabilities:
              'Re-list tools, resources, resource templates, prompts, and server instructions from the live server.',
            mcp_call_tool: 'Execute a tool on the live server.',
            mcp_read_resource: 'Read a resource URI from the live server.',
            mcp_get_prompt: 'Resolve a prompt template on the live server.',
          }
        : {}),
    },
  }
}

export function formatAssistantScanContext(ctx: AssistantScanContext): string {
  return JSON.stringify(ctx, null, 2)
}

export function getSuggestedQuestions(doc: ScanDocument): string[] {
  const score = doc.scan.summary?.score ?? 0
  const orphaned = doc.resources.filter((r) => r.isOrphaned).length
  const templates = doc.resourceTemplates?.length ?? 0
  const mutating = doc.tools.filter(
    (t) => /\b(create|update|delete|write|remove|set|insert)\b/i.test(t.name),
  )
  const weakTools = doc.tools.filter((t) => (t.description?.trim().length ?? 0) < 20)

  const questions: string[] = [
    `Why is the readiness score ${score}/100?`,
  ]

  if (doc.serverMeta?.instructions) {
    questions.push('Summarize the server instructions and how agents should follow them')
  }

  if (templates > 0) {
    questions.push(`What resource templates exist and how do agents resolve them?`)
  }

  if (orphaned > 0) {
    questions.push(
      orphaned === 1
        ? 'Explain the orphaned resource and whether it is a real problem'
        : `What are the ${orphaned} orphaned resources and are they false positives?`,
    )
  }

  if (mutating.length > 0) {
    questions.push('Which tools can write or mutate data, and are side effects documented?')
  } else {
    questions.push('Is this MCP read-only from an agent perspective?')
  }

  if (weakTools.length > 0) {
    questions.push(`How can I improve the weakest tool descriptions (${weakTools.length} flagged)?`)
  }

  questions.push('What workflow should an AI agent follow to use this server safely?')

  return questions.slice(0, 6)
}
