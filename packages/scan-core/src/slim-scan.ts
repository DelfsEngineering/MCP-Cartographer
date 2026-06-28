import type { ScanDocument } from '@mcp-cartographer/shared'

/** Strip graph/raw blobs from scan before sending to chat API — keeps inspection data, saves bandwidth. */
export function slimScanForChat(doc: ScanDocument): ScanDocument {
  return {
    version: doc.version,
    scan: doc.scan,
    serverMeta: doc.serverMeta,
    tools: doc.tools.map((t) => ({
      id: t.id,
      scanId: t.scanId,
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      outputSchema: t.outputSchema,
      annotations: t.annotations,
      descriptionScore: t.descriptionScore,
      riskLevel: t.riskLevel,
      inferredSideEffects: t.inferredSideEffects,
      raw: { name: t.name },
    })),
    resources: doc.resources.map((r) => ({
      id: r.id,
      scanId: r.scanId,
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
      isOrphaned: r.isOrphaned,
      summary: r.summary,
    })),
    resourceTemplates: doc.resourceTemplates?.map((t) => ({
      id: t.id,
      scanId: t.scanId,
      uriTemplate: t.uriTemplate,
      name: t.name,
      description: t.description,
      mimeType: t.mimeType,
    })),
    prompts: doc.prompts.map((p) => ({
      id: p.id,
      scanId: p.scanId,
      name: p.name,
      description: p.description,
      arguments: p.arguments,
      summary: p.summary,
      raw: { name: p.name },
    })),
    findings: doc.findings,
    graph: { nodes: [], edges: [] },
  }
}
