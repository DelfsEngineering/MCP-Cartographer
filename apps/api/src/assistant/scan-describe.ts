import type { ScanDocument } from '@mcp-cartographer/shared'

export type ScanDescribeRequest = {
  kind: 'tool' | 'resource' | 'resource_template' | 'prompt'
  name?: string
  uri?: string
}

export function describeFromScan(
  doc: ScanDocument,
  req: ScanDescribeRequest,
): { ok: true; data: unknown } | { ok: false; error: string } {
  switch (req.kind) {
    case 'tool': {
      const name = req.name?.trim()
      if (!name) return { ok: false, error: 'name is required for tool' }
      const tool = doc.tools.find((t) => t.name === name)
      if (!tool) return { ok: false, error: `Tool not found in scan: ${name}` }
      return {
        ok: true,
        data: {
          kind: 'tool',
          id: tool.id,
          nodeId: `node-tool-${tool.id}`,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          annotations: tool.annotations,
          riskLevel: tool.riskLevel,
          inferredSideEffects: tool.inferredSideEffects,
        },
      }
    }
    case 'resource': {
      const uri = req.uri?.trim()
      const name = req.name?.trim()
      const resource = uri
        ? doc.resources.find((r) => r.uri === uri)
        : name
          ? doc.resources.find((r) => r.name === name || r.uri.includes(name))
          : undefined
      if (!resource) {
        return { ok: false, error: `Resource not found in scan: ${uri ?? name ?? '(missing)'}` }
      }
      return {
        ok: true,
        data: {
          kind: 'resource',
          id: resource.id,
          nodeId: `node-resource-${resource.id}`,
          uri: resource.uri,
          name: resource.name,
          description: resource.description,
          mimeType: resource.mimeType,
          isOrphaned: resource.isOrphaned,
          contentPreview: resource.contentPreview,
        },
      }
    }
    case 'resource_template': {
      const uriTemplate = req.uri?.trim()
      const name = req.name?.trim()
      const templates = doc.resourceTemplates ?? []
      const template = uriTemplate
        ? templates.find((t) => t.uriTemplate === uriTemplate)
        : name
          ? templates.find((t) => t.name === name || t.uriTemplate.includes(name))
          : undefined
      if (!template) {
        return {
          ok: false,
          error: `Resource template not found in scan: ${uriTemplate ?? name ?? '(missing)'}`,
        }
      }
      return {
        ok: true,
        data: {
          kind: 'resource_template',
          id: template.id,
          uriTemplate: template.uriTemplate,
          name: template.name,
          description: template.description,
          mimeType: template.mimeType,
        },
      }
    }
    case 'prompt': {
      const name = req.name?.trim()
      if (!name) return { ok: false, error: 'name is required for prompt' }
      const prompt = doc.prompts.find((p) => p.name === name)
      if (!prompt) return { ok: false, error: `Prompt not found in scan: ${name}` }
      return {
        ok: true,
        data: {
          kind: 'prompt',
          id: prompt.id,
          nodeId: `node-prompt-${prompt.id}`,
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments,
        },
      }
    }
    default:
      return { ok: false, error: `Unknown kind: ${String(req.kind)}` }
  }
}
