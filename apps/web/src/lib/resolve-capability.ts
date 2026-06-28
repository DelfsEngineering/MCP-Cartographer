import type {
  MCPResourceRecord,
  MCPResourceTemplateRecord,
  MCPPromptRecord,
  MCPToolRecord,
  ScanDocument,
  VisualGraphNode,
} from '@mcp-cartographer/shared'

export type ResolvedCapability =
  | { kind: 'tool'; record: MCPToolRecord; node: VisualGraphNode }
  | { kind: 'resource'; record: MCPResourceRecord; node: VisualGraphNode }
  | { kind: 'resource_template'; record: MCPResourceTemplateRecord; node: VisualGraphNode }
  | { kind: 'prompt'; record: MCPPromptRecord; node: VisualGraphNode }
  | { kind: 'schema'; schema: unknown; node: VisualGraphNode; toolName?: string }
  | { kind: 'server'; node: VisualGraphNode }

export function resolveCapability(
  doc: ScanDocument,
  node: VisualGraphNode | null | undefined,
): ResolvedCapability | null {
  if (!node) return null

  if (node.type === 'server') {
    return { kind: 'server', node }
  }

  if (node.type === 'tool') {
    const id = node.id.replace('node-tool-', '')
    const record = doc.tools.find((t) => t.id === id)
    if (!record) return null
    return { kind: 'tool', record, node }
  }

  if (node.type === 'resource') {
    if (node.id.startsWith('node-resource-template-')) {
      const id = node.id.replace('node-resource-template-', '')
      const record = (doc.resourceTemplates ?? []).find((t) => t.id === id)
      if (!record) return null
      return { kind: 'resource_template', record, node }
    }
    const id = node.id.replace('node-resource-', '')
    const template = (doc.resourceTemplates ?? []).find((t) => t.id === id)
    if (template) {
      return { kind: 'resource_template', record: template, node }
    }
    const record = doc.resources.find((r) => r.id === id)
    if (!record) return null
    return { kind: 'resource', record, node }
  }

  if (node.type === 'prompt') {
    const id = node.id.replace('node-prompt-', '')
    const record = doc.prompts.find((p) => p.id === id)
    if (!record) return null
    return { kind: 'prompt', record, node }
  }

  if (node.type === 'schema') {
    const schema = node.raw
    const edge = doc.graph.edges.find(
      (e) => e.targetNodeId === node.id && e.type === 'uses_schema',
    )
    const toolNode = edge
      ? doc.graph.nodes.find((n) => n.id === edge.sourceNodeId)
      : undefined
    return {
      kind: 'schema',
      schema,
      node,
      toolName: toolNode?.label,
    }
  }

  return null
}

export function inspectorModeForNode(node: VisualGraphNode): 'tools' | 'resources' | 'prompts' | null {
  switch (node.type) {
    case 'tool':
    case 'schema':
      return 'tools'
    case 'resource':
      return 'resources'
    case 'prompt':
      return 'prompts'
    default:
      return null
  }
}
