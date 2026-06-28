import type { GraphEdge, ScanDocument } from '@mcp-cartographer/shared'

/** Short names used in prose → canonical MCP resource uri (Klai / BetterForms guides). */
const GUIDE_ALIASES: Record<string, string> = {
  site_schema_reference: 'assistantGuide_SITE_SCHEMA_REFERENCE',
  page_schema_reference: 'guide_pageSchema_v8',
}

export type ResourceCatalogEntry = {
  resourceId: string
  nodeId: string
  uri: string
  name?: string
  /** Normalized lookup keys → canonical uri */
  keys: Set<string>
}

function normalizeGuideKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^guide:\/\//i, '')
    .replace(/\.md$/i, '')
    .replace(/[^a-z0-9_]/g, '')
}

function addKey(keys: Set<string>, raw: string | undefined): void {
  if (!raw?.trim()) return
  keys.add(normalizeGuideKey(raw))
}

export function buildResourceCatalog(doc: ScanDocument): ResourceCatalogEntry[] {
  const byUri = new Map<string, ResourceCatalogEntry>()

  const register = (
    resourceId: string,
    uri: string,
    name: string | undefined,
    nodeId: string,
  ) => {
    const canonicalUri = resolveAlias(uri) ?? uri
    let entry = byUri.get(canonicalUri)
    if (!entry) {
      entry = {
        resourceId,
        nodeId,
        uri: canonicalUri,
        name,
        keys: new Set(),
      }
      byUri.set(canonicalUri, entry)
    }
    addKey(entry.keys, canonicalUri)
    addKey(entry.keys, name)
    if (name && name !== canonicalUri) entry.name = name
  }

  for (const r of doc.resources) {
    register(r.id, r.uri, r.name, `node-resource-${r.id}`)
  }
  for (const t of doc.resourceTemplates ?? []) {
    register(t.id, t.uriTemplate, t.name, `node-resource-template-${t.id}`)
  }

  return [...byUri.values()]
}

export function resolveAlias(token: string): string | undefined {
  const norm = normalizeGuideKey(token)
  const aliased = GUIDE_ALIASES[norm]
  if (aliased) return aliased
  return undefined
}

export function resolveCatalogEntry(
  token: string,
  catalog: ResourceCatalogEntry[],
): ResourceCatalogEntry | undefined {
  const norm = normalizeGuideKey(token)
  const aliasedUri = GUIDE_ALIASES[norm]
  if (aliasedUri) {
    const hit = catalog.find((c) => c.uri === aliasedUri)
    if (hit) return hit
  }
  for (const entry of catalog) {
    if (entry.keys.has(norm)) return entry
    if (normalizeGuideKey(entry.uri) === norm) return entry
  }
  return undefined
}

export type ExtractedGuideRef = {
  token: string
  matchType: 'get_guide_query' | 'backtick' | 'catalog_mention'
}

/** Pull guide/resource id tokens from guide body text (not URI-only). */
export function extractGuideReferences(
  text: string,
  catalog: ResourceCatalogEntry[],
): ExtractedGuideRef[] {
  if (!text.trim()) return []

  const found: ExtractedGuideRef[] = []
  const seen = new Set<string>()

  const push = (token: string, matchType: ExtractedGuideRef['matchType']) => {
    const trimmed = token.trim()
    if (!trimmed || seen.has(trimmed)) return
    if (!resolveCatalogEntry(trimmed, catalog)) return
    seen.add(trimmed)
    found.push({ token: trimmed, matchType })
  }

  const getGuideRe = /get_guide\s*\(\s*\{[^}]*\bquery:\s*["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = getGuideRe.exec(text)) !== null) {
    push(m[1], 'get_guide_query')
  }

  const backtickRe = /`([a-zA-Z][\w]*)`/g
  while ((m = backtickRe.exec(text)) !== null) {
    push(m[1], 'backtick')
  }

  // Longest keys first to prefer specific ids over short substrings
  const mentionKeys = catalog
    .flatMap((entry) => [...entry.keys].map((k) => ({ key: k, entry })))
    .filter((x) => x.key.length >= 8)
    .sort((a, b) => b.key.length - a.key.length)

  const hay = text.toLowerCase()
  for (const { key, entry } of mentionKeys) {
    if (!hay.includes(key)) continue
    push(entry.uri, 'catalog_mention')
  }

  return found
}

function resourceBodyText(record: {
  description?: string
  contentPreview?: string
}): string {
  return [record.description, record.contentPreview].filter(Boolean).join('\n')
}

export function inferResourceToResourceEdges(
  doc: ScanDocument,
  catalog: ResourceCatalogEntry[],
  serverNodeId: string,
  ts: string,
): GraphEdge[] {
  const scanId = doc.scan.id
  const edges: GraphEdge[] = []
  const edgeIds = new Set<string>()

  const addEdge = (
    sourceResourceId: string,
    target: ResourceCatalogEntry,
    matchType: string,
    token: string,
  ) => {
    if (sourceResourceId === target.resourceId) return
    const id = `edge-resource-resource-${sourceResourceId}-${target.resourceId}`
    if (edgeIds.has(id)) return
    edgeIds.add(id)
    edges.push({
      id,
      scanId,
      sourceNodeId: `node-resource-${sourceResourceId}`,
      targetNodeId: target.nodeId,
      type: 'related_to',
      confidence: matchType === 'get_guide_query' ? 0.9 : matchType === 'backtick' ? 0.85 : 0.75,
      inferredBy: 'deterministic',
      explanation: `Guide reference (${matchType}): ${token}`,
      createdAt: ts,
    })
  }

  for (const resource of doc.resources) {
    const text = resourceBodyText(resource)
    for (const ref of extractGuideReferences(text, catalog)) {
      const target = resolveCatalogEntry(ref.token, catalog)
      if (target) addEdge(resource.id, target, ref.matchType, ref.token)
    }
  }

  if (doc.serverMeta?.instructions) {
    for (const ref of extractGuideReferences(doc.serverMeta.instructions, catalog)) {
      const target = resolveCatalogEntry(ref.token, catalog)
      if (!target) continue
      const id = `edge-server-resource-${target.resourceId}-${normalizeGuideKey(ref.token)}`
      if (edgeIds.has(id)) continue
      edgeIds.add(id)
      edges.push({
        id,
        scanId,
        sourceNodeId: serverNodeId,
        targetNodeId: target.nodeId,
        type: 'documents',
        confidence: 0.85,
        inferredBy: 'deterministic',
        explanation: `Server instructions reference (${ref.matchType}): ${ref.token}`,
        createdAt: ts,
      })
    }
  }

  // Prompt descriptions often gate which guide to read (e.g. MCP system prompt table)
  for (const prompt of doc.prompts) {
    const text = [prompt.description, prompt.summary].filter(Boolean).join('\n')
    for (const ref of extractGuideReferences(text, catalog)) {
      const target = resolveCatalogEntry(ref.token, catalog)
      if (!target) continue
      const id = `edge-prompt-resource-${prompt.id}-${target.resourceId}`
      if (edgeIds.has(id)) continue
      edgeIds.add(id)
      edges.push({
        id,
        scanId,
        sourceNodeId: `node-prompt-${prompt.id}`,
        targetNodeId: target.nodeId,
        type: 'documents',
        confidence: 0.8,
        inferredBy: 'deterministic',
        explanation: `Prompt references guide (${ref.matchType}): ${ref.token}`,
        createdAt: ts,
      })
    }
  }

  return edges
}
