import type { ConnectionForm } from '@/lib/api'

type RawMcpServer = {
  url?: string
  headers?: Record<string, unknown>
  command?: string
  args?: unknown[]
  env?: Record<string, unknown>
}

export type ParseMcpConfigResult =
  | { ok: true; connections: ConnectionForm[]; skipped: string[] }
  | { ok: false; error: string }

function headersToRows(headers?: Record<string, unknown>): Array<{ key: string; value: string }> {
  if (!headers || typeof headers !== 'object') {
    return [{ key: '', value: '' }]
  }
  const rows = Object.entries(headers)
    .filter(([, value]) => value != null && String(value).length > 0)
    .map(([key, value]) => ({ key, value: String(value) }))
  return rows.length ? rows : [{ key: '', value: '' }]
}

function serverToForm(name: string, server: RawMcpServer): ConnectionForm | null {
  const endpoint = typeof server.url === 'string' ? server.url.trim() : ''
  if (!endpoint) return null
  return {
    name: name.trim() || 'Imported MCP',
    endpoint,
    headers: headersToRows(server.headers),
  }
}

function parseServerMap(map: Record<string, unknown>): { connections: ConnectionForm[]; skipped: string[] } {
  const connections: ConnectionForm[] = []
  const skipped: string[] = []

  for (const [name, value] of Object.entries(map)) {
    if (!value || typeof value !== 'object') continue
    const server = value as RawMcpServer
    const form = serverToForm(name, server)
    if (form) {
      connections.push(form)
    } else if (server.command) {
      skipped.push(`${name} (stdio — not supported yet)`)
    } else {
      skipped.push(`${name} (missing url)`)
    }
  }

  return { connections, skipped }
}

export function parseMcpConfigText(text: string): ParseMcpConfigResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { ok: false, error: 'Paste is empty' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { ok: false, error: 'Invalid JSON. Paste a Cursor/Claude mcpServers block.' }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'JSON must be an object' }
  }

  const root = parsed as Record<string, unknown>

  if (root.mcpServers && typeof root.mcpServers === 'object') {
    const { connections, skipped } = parseServerMap(root.mcpServers as Record<string, unknown>)
    if (!connections.length) {
      return {
        ok: false,
        error: skipped.length
          ? `No HTTP MCP servers found. Skipped: ${skipped.join(', ')}`
          : 'No servers found in mcpServers',
      }
    }
    return { ok: true, connections, skipped }
  }

  if (typeof root.url === 'string') {
    const form = serverToForm(
      typeof root.name === 'string' ? root.name : 'Imported MCP',
      root as RawMcpServer,
    )
    if (!form) {
      return { ok: false, error: 'Server object is missing url' }
    }
    return { ok: true, connections: [form], skipped: [] }
  }

  const looksLikeServerMap = Object.values(root).every(
    (v) => v && typeof v === 'object' && ('url' in (v as object) || 'command' in (v as object)),
  )
  if (looksLikeServerMap) {
    const { connections, skipped } = parseServerMap(root)
    if (!connections.length) {
      return {
        ok: false,
        error: skipped.length
          ? `No HTTP MCP servers found. Skipped: ${skipped.join(', ')}`
          : 'No HTTP MCP servers found in pasted map',
      }
    }
    return { ok: true, connections, skipped }
  }

  return {
    ok: false,
    error: 'Unrecognized format. Expected { "mcpServers": { "name": { "url", "headers" } } }',
  }
}
