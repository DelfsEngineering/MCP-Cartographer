export type ConnectionForm = {
  name: string
  endpoint: string
  headers: Array<{ key: string; value: string }>
}

export type McpTestResponse = {
  ok: boolean
  transportUsed?: string
  toolCount?: number
  resourceCount?: number
  promptCount?: number
  error?: string
}

export type McpScanResponse = {
  ok: boolean
  transportUsed?: string
  scan?: import('@mcp-cartographer/shared').ScanDocument
  error?: string
}

function connectionPayload(form: ConnectionForm) {
  const headers: Record<string, string> = {}
  for (const { key, value } of form.headers) {
    const k = key.trim()
    if (k && value) headers[k] = value
  }
  return {
    name: form.name.trim(),
    endpoint: form.endpoint.trim(),
    headers: Object.keys(headers).length ? headers : undefined,
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const data = await res.json() as T & { error?: string }
  if (!res.ok && !(data as { ok?: boolean }).ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
  }
  return data
}

export async function testConnection(form: ConnectionForm): Promise<McpTestResponse> {
  return apiFetch<McpTestResponse>('/api/mcp/test', {
    method: 'POST',
    body: JSON.stringify(connectionPayload(form)),
  })
}

export async function runMcpScan(form: ConnectionForm): Promise<McpScanResponse> {
  return apiFetch<McpScanResponse>('/api/mcp/scan', {
    method: 'POST',
    body: JSON.stringify(connectionPayload(form)),
  })
}

export async function fetchDevConnection(): Promise<ConnectionForm | null> {
  try {
    const data = await apiFetch<{
      available: boolean
      connection?: { name: string; endpoint: string; headers?: Record<string, string> }
    }>('/api/dev/connection')
    if (!data.available || !data.connection) return null
    return {
      name: data.connection.name,
      endpoint: data.connection.endpoint,
      headers: Object.entries(data.connection.headers ?? {}).map(([key, value]) => ({ key, value })),
    }
  } catch {
    return null
  }
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const data = await apiFetch<{ ok: boolean }>('/api/health')
    return data.ok
  } catch {
    return false
  }
}
