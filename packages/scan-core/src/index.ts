import type {
  Finding,
  GraphEdge,
  GraphNode,
  ScanDocument,
  Severity,
  VisualGraph,
  VisualGraphEdge,
  VisualGraphNode,
} from '@mcp-cartographer/shared'
import sampleScanJson from './fixtures/sample-scan.json'

const MUTATING_PATTERNS = /\b(create|update|delete|remove|write|set|insert|drop|destroy|modify|patch|post|put)\b/i

function now(): string {
  return new Date().toISOString()
}

function schemaFieldCount(schema: unknown): number | undefined {
  if (!schema || typeof schema !== 'object') return undefined
  const props = (schema as { properties?: Record<string, unknown> }).properties
  return props ? Object.keys(props).length : undefined
}

export function generateDeterministicFindings(doc: ScanDocument): Finding[] {
  const findings: Finding[] = []
  const ts = now()

  for (const tool of doc.tools) {
    const desc = tool.description?.trim() ?? ''
    if (desc.length < 20) {
      findings.push({
        id: `finding-${tool.id}-weak-desc`,
        scanId: doc.scan.id,
        targetNodeId: `node-tool-${tool.id}`,
        severity: desc.length === 0 ? 'high' : 'medium',
        category: 'weak_description',
        title: `Weak description: ${tool.name}`,
        message: desc.length === 0
          ? `Tool "${tool.name}" has no description.`
          : `Tool "${tool.name}" has a very short description (${desc.length} chars).`,
        recommendation: 'Add a clear description explaining what the tool does, when to use it, and any side effects.',
        createdAt: ts,
      })
    }

    if (!tool.inputSchema) {
      findings.push({
        id: `finding-${tool.id}-missing-schema`,
        scanId: doc.scan.id,
        targetNodeId: `node-tool-${tool.id}`,
        severity: 'medium',
        category: 'missing_schema',
        title: `Missing input schema: ${tool.name}`,
        message: `Tool "${tool.name}" does not define an input schema.`,
        recommendation: 'Define a JSON Schema for tool inputs so agents can construct valid calls.',
        createdAt: ts,
      })
    }

    const isMutating = MUTATING_PATTERNS.test(tool.name) || MUTATING_PATTERNS.test(desc)
    if (isMutating && !/\b(side effect|writes|mutat|destruct|irrevers|delete|create)\b/i.test(desc)) {
      findings.push({
        id: `finding-${tool.id}-side-effect`,
        scanId: doc.scan.id,
        targetNodeId: `node-tool-${tool.id}`,
        severity: 'medium',
        category: 'unclear_side_effect',
        title: `Unclear side effects: ${tool.name}`,
        message: `Tool "${tool.name}" appears to modify data but side effects are not clearly documented.`,
        recommendation: 'Document whether this tool creates, updates, or deletes data and what is irreversible.',
        createdAt: ts,
      })
    }
  }

  for (const resource of doc.resources) {
    if (resource.isOrphaned) {
      findings.push({
        id: `finding-${resource.id}-orphan`,
        scanId: doc.scan.id,
        targetNodeId: `node-resource-${resource.id}`,
        severity: 'low',
        category: 'orphaned_resource',
        title: `Orphaned resource: ${resource.uri}`,
        message: `Resource "${resource.uri}" has no linked tools or prompts.`,
        recommendation: 'Link this resource to tools that use it, or document it in tool descriptions.',
        createdAt: ts,
      })
    }
  }

  return findings
}

export function computeReadinessScore(findings: Finding[], toolCount: number, resourceCount: number): number {
  let score = 100
  const weights: Record<Severity, number> = { info: 1, low: 3, medium: 6, high: 12 }

  for (const f of findings) {
    score -= weights[f.severity]
  }

  if (toolCount === 0 && resourceCount === 0) score = Math.min(score, 30)
  return Math.max(0, Math.min(100, score))
}

export function buildGraphFromScan(doc: ScanDocument): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const ts = now()
  const scanId = doc.scan.id

  const serverId = `node-server-${scanId}`
  nodes.push({
    id: serverId,
    scanId,
    type: 'server',
    label: doc.scan.serverName,
    description: 'MCP server root',
    createdAt: ts,
    updatedAt: ts,
  })

  const schemaNodes = new Map<string, string>()

  for (const tool of doc.tools) {
    const toolNodeId = `node-tool-${tool.id}`
    const isRisky = (tool.riskLevel && tool.riskLevel !== 'none') ||
      MUTATING_PATTERNS.test(tool.name)

    nodes.push({
      id: toolNodeId,
      scanId,
      type: 'tool',
      label: tool.name,
      description: tool.description,
      score: tool.descriptionScore,
      severity: isRisky ? 'medium' : undefined,
      raw: tool.raw,
      metadata: { riskLevel: tool.riskLevel, isRisky },
      createdAt: ts,
      updatedAt: ts,
    })

    edges.push({
      id: `edge-exposes-tool-${tool.id}`,
      scanId,
      sourceNodeId: serverId,
      targetNodeId: toolNodeId,
      type: 'exposes',
      confidence: 1,
      inferredBy: 'mcp',
      createdAt: ts,
    })

    if (tool.inputSchema) {
      const schemaKey = JSON.stringify(tool.inputSchema)
      let schemaNodeId = schemaNodes.get(schemaKey)
      if (!schemaNodeId) {
        schemaNodeId = `node-schema-${schemaNodes.size + 1}`
        schemaNodes.set(schemaKey, schemaNodeId)
        const fieldCount = schemaFieldCount(tool.inputSchema)
        nodes.push({
          id: schemaNodeId,
          scanId,
          type: 'schema',
          label: `${tool.name}Input`,
          description: fieldCount ? `${fieldCount} fields` : undefined,
          raw: tool.inputSchema,
          createdAt: ts,
          updatedAt: ts,
        })
        edges.push({
          id: `edge-exposes-schema-${schemaNodes.size}`,
          scanId,
          sourceNodeId: serverId,
          targetNodeId: schemaNodeId,
          type: 'exposes',
          confidence: 1,
          inferredBy: 'mcp',
          createdAt: ts,
        })
      }
      edges.push({
        id: `edge-tool-schema-${tool.id}`,
        scanId,
        sourceNodeId: toolNodeId,
        targetNodeId: schemaNodeId,
        type: 'uses_schema',
        confidence: 1,
        inferredBy: 'mcp',
        createdAt: ts,
      })
    }
  }

  for (const resource of doc.resources) {
    const resourceNodeId = `node-resource-${resource.id}`
    nodes.push({
      id: resourceNodeId,
      scanId,
      type: 'resource',
      label: resource.name ?? resource.uri,
      description: resource.description,
      raw: resource,
      metadata: { uri: resource.uri, isOrphaned: resource.isOrphaned },
      createdAt: ts,
      updatedAt: ts,
    })
    edges.push({
      id: `edge-exposes-resource-${resource.id}`,
      scanId,
      sourceNodeId: serverId,
      targetNodeId: resourceNodeId,
      type: 'exposes',
      confidence: 1,
      inferredBy: 'mcp',
      createdAt: ts,
    })

    for (const tool of doc.tools) {
      const haystack = `${tool.name} ${tool.description ?? ''}`.toLowerCase()
      if (haystack.includes(resource.uri.toLowerCase()) || (resource.name && haystack.includes(resource.name.toLowerCase()))) {
        edges.push({
          id: `edge-tool-resource-${tool.id}-${resource.id}`,
          scanId,
          sourceNodeId: `node-tool-${tool.id}`,
          targetNodeId: resourceNodeId,
          type: 'references',
          confidence: 0.8,
          inferredBy: 'deterministic',
          explanation: 'Matched by name/URI in tool description',
          createdAt: ts,
        })
        resource.isOrphaned = false
      }
    }
  }

  for (const prompt of doc.prompts) {
    const promptNodeId = `node-prompt-${prompt.id}`
    nodes.push({
      id: promptNodeId,
      scanId,
      type: 'prompt',
      label: prompt.name,
      description: prompt.description,
      raw: prompt.raw,
      createdAt: ts,
      updatedAt: ts,
    })
    edges.push({
      id: `edge-exposes-prompt-${prompt.id}`,
      scanId,
      sourceNodeId: serverId,
      targetNodeId: promptNodeId,
      type: 'exposes',
      confidence: 1,
      inferredBy: 'mcp',
      createdAt: ts,
    })
  }

  return { nodes, edges }
}

export function enrichScanDocument(doc: ScanDocument): ScanDocument {
  const { nodes, edges } = buildGraphFromScan(doc)

  const linkedResourceIds = new Set(
    edges.filter((e) => e.type === 'references').map((e) => e.targetNodeId),
  )
  const resources = doc.resources.map((r) => ({
    ...r,
    isOrphaned: r.isOrphaned ?? !linkedResourceIds.has(`node-resource-${r.id}`),
  }))

  const enriched: ScanDocument = {
    ...doc,
    resources,
    graph: { nodes, edges },
  }

  const findings = doc.findings.length > 0 ? doc.findings : generateDeterministicFindings(enriched)

  for (const finding of findings) {
    if (!finding.targetNodeId) continue
    const findingNodeId = `node-finding-${finding.id}`
    if (!nodes.find((n) => n.id === findingNodeId)) {
      nodes.push({
        id: findingNodeId,
        scanId: doc.scan.id,
        type: 'finding',
        label: finding.title,
        description: finding.message,
        severity: finding.severity,
        raw: finding,
        createdAt: finding.createdAt,
        updatedAt: finding.createdAt,
      })
      edges.push({
        id: `edge-finding-${finding.id}`,
        scanId: doc.scan.id,
        sourceNodeId: finding.targetNodeId,
        targetNodeId: findingNodeId,
        type: 'has_finding',
        confidence: 1,
        inferredBy: 'deterministic',
        createdAt: finding.createdAt,
      })
    }
  }

  const schemaCount = nodes.filter((n) => n.type === 'schema').length
  const score = computeReadinessScore(findings, doc.tools.length, doc.resources.length)

  return {
    ...enriched,
    findings,
    graph: { nodes, edges },
    scan: {
      ...enriched.scan,
      status: 'complete',
      progressPercent: 100,
      completedAt: enriched.scan.completedAt ?? now(),
      summary: {
        tools: doc.tools.length,
        resources: doc.resources.length,
        prompts: doc.prompts.length,
        schemas: schemaCount,
        findings: findings.length,
        score,
      },
    },
  }
}

export function toVisualGraph(doc: ScanDocument): VisualGraph {
  const findingsByNode = new Map<string, number>()
  for (const f of doc.findings) {
    if (f.targetNodeId) {
      findingsByNode.set(f.targetNodeId, (findingsByNode.get(f.targetNodeId) ?? 0) + 1)
    }
  }

  const nodes: VisualGraphNode[] = doc.graph.nodes
    .filter((n) => n.type !== 'finding')
    .map((n) => {
      const isOrphaned = n.type === 'resource' && Boolean(n.metadata?.isOrphaned)
      const isRisky = n.type === 'tool' && Boolean(n.metadata?.isRisky)
      const badges: string[] = []
      if (isOrphaned) badges.push('orphan')
      if (isRisky) badges.push('risk')

      return {
        id: n.id,
        type: n.type,
        label: n.label,
        subtitle: n.description,
        score: n.score,
        severity: n.severity,
        badges,
        issueCount: findingsByNode.get(n.id) ?? 0,
        isOrphaned,
        isRisky,
        description: n.description,
        raw: n.raw,
        rawRef: { recordType: n.type, recordId: n.id },
      }
    })

  const edges: VisualGraphEdge[] = doc.graph.edges
    .filter((e) => e.type !== 'has_finding')
    .map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      type: e.type,
      label: e.type.replace(/_/g, ' '),
      confidence: e.confidence,
      inferredBy: e.inferredBy,
      isSuggested: e.type === 'missing_link',
    }))

  const summary = doc.scan.summary
  const toolCount = summary?.tools ?? doc.tools.length
  const resourceCount = summary?.resources ?? doc.resources.length
  const promptCount = summary?.prompts ?? doc.prompts.length
  const schemaCount = summary?.schemas ?? nodes.filter((n) => n.type === 'schema').length
  const findingCount = summary?.findings ?? doc.findings.length
  const score = summary?.score ?? computeReadinessScore(doc.findings, doc.tools.length, doc.resources.length)

  return {
    nodes,
    edges,
    summary: {
      score,
      toolCount,
      resourceCount,
      promptCount,
      schemaCount,
      findingCount,
    },
  }
}

export function validateScanDocument(data: unknown): { ok: true; doc: ScanDocument } | { ok: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Invalid JSON: expected an object' }
  }
  const doc = data as Partial<ScanDocument>
  if (doc.version !== 1) {
    return { ok: false, error: 'Unsupported scan version. Expected version: 1' }
  }
  if (!doc.scan?.id || !doc.scan?.serverName) {
    return { ok: false, error: 'Missing required scan fields (id, serverName)' }
  }
  if (!Array.isArray(doc.tools) || !Array.isArray(doc.resources) || !Array.isArray(doc.prompts)) {
    return { ok: false, error: 'Missing tools, resources, or prompts arrays' }
  }
  return { ok: true, doc: enrichScanDocument(doc as ScanDocument) }
}

const SECRET_PATTERNS = [
  /BFAPI_[A-Z0-9-]+/gi,
  /sk-[a-zA-Z0-9]{20,}/g,
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
  /api[_-]?key["']?\s*[:=]\s*["'][^"']+["']/gi,
]

export function detectSecrets(text: string): string[] {
  const found = new Set<string>()
  for (const pattern of SECRET_PATTERNS) {
    const matches = text.match(pattern)
    if (matches) matches.forEach((m) => found.add(m.slice(0, 20) + '…'))
  }
  return [...found]
}

export function redactSecrets(text: string): string {
  let result = text
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]')
  }
  return result
}

export function exportMarkdownReport(doc: ScanDocument): string {
  const s = doc.scan.summary
  const lines: string[] = [
    '# MCP Cartographer Scan Report',
    '',
    `**Server:** ${doc.scan.serverName}`,
    `**Scan ID:** ${doc.scan.id}`,
    `**Completed:** ${doc.scan.completedAt ?? '—'}`,
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Tools | ${s?.tools ?? 0} |`,
    `| Resources | ${s?.resources ?? 0} |`,
    `| Prompts | ${s?.prompts ?? 0} |`,
    `| Schemas | ${s?.schemas ?? 0} |`,
    `| Findings | ${s?.findings ?? 0} |`,
    '',
    `**Overall readiness score:** ${s?.score ?? 0}/100`,
    '',
    '## Top findings',
    '',
  ]

  const bySeverity: Record<string, Finding[]> = { high: [], medium: [], low: [], info: [] }
  for (const f of doc.findings) bySeverity[f.severity].push(f)

  for (const sev of ['high', 'medium', 'low', 'info'] as const) {
    const group = bySeverity[sev]
    if (group.length === 0) continue
    lines.push(`### ${sev.toUpperCase()}`, '')
    for (const f of group) {
      lines.push(`- **${f.title}** — ${f.message}`)
      if (f.recommendation) lines.push(`  - *Recommendation:* ${f.recommendation}`)
    }
    lines.push('')
  }

  const weakTools = doc.tools.filter((t) => (t.description?.length ?? 0) < 20)
  if (weakTools.length) {
    lines.push('## Weak tools', '')
    for (const t of weakTools) lines.push(`- \`${t.name}\``)
    lines.push('')
  }

  const orphans = doc.resources.filter((r) => r.isOrphaned)
  if (orphans.length) {
    lines.push('## Orphaned resources', '')
    for (const r of orphans) lines.push(`- \`${r.uri}\``)
    lines.push('')
  }

  lines.push('---', '*Generated by MCP Cartographer*')
  return lines.join('\n')
}

export function exportJsonReport(doc: ScanDocument): string {
  const redacted = JSON.parse(redactSecrets(JSON.stringify(doc))) as ScanDocument
  return JSON.stringify(redacted, null, 2)
}

export const sampleScanDocument = enrichScanDocument(sampleScanJson as ScanDocument)

export type RawMcpDiscovery = {
  tools: Array<{
    name: string
    description?: string
    inputSchema?: unknown
    outputSchema?: unknown
    annotations?: unknown
    raw: unknown
  }>
  resources: Array<{
    uri: string
    name?: string
    description?: string
    mimeType?: string
    raw: unknown
  }>
  prompts: Array<{
    name: string
    description?: string
    arguments?: unknown
    raw: unknown
  }>
}

function slugId(prefix: string, name: string, index: number): string {
  const slug = name.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().slice(0, 40)
  return `${prefix}-${slug || index}`
}

export function buildScanDocumentFromDiscovery(
  serverName: string,
  discovery: RawMcpDiscovery,
): ScanDocument {
  const scanId = `scan-${crypto.randomUUID()}`
  const ts = now()

  const doc: ScanDocument = {
    version: 1,
    scan: {
      id: scanId,
      serverName,
      status: 'running',
      progressPercent: 0,
      startedAt: ts,
      currentStep: 'Discovering MCP capabilities',
    },
    tools: discovery.tools.map((t, i) => ({
      id: slugId('tool', t.name, i),
      scanId,
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      outputSchema: t.outputSchema,
      annotations: t.annotations,
      raw: t.raw,
      riskLevel: /\b(delete|remove|destroy|write|create|update)\b/i.test(t.name) ? 'medium' as const : 'none' as const,
    })),
    resources: discovery.resources.map((r, i) => ({
      id: slugId('res', r.uri, i),
      scanId,
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
      raw: r.raw,
    })),
    prompts: discovery.prompts.map((p, i) => ({
      id: slugId('prompt', p.name, i),
      scanId,
      name: p.name,
      description: p.description,
      arguments: p.arguments,
      raw: p.raw,
    })),
    graph: { nodes: [], edges: [] },
    findings: [],
  }

  return enrichScanDocument(doc)
}
