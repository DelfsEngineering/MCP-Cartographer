export type ToolParameter = {
  name: string
  type: string
  required: boolean
  description?: string
}

export function listToolParameters(inputSchema: unknown): ToolParameter[] {
  if (!inputSchema || typeof inputSchema !== 'object') return []
  const schema = inputSchema as {
    properties?: Record<string, { type?: string; description?: string }>
    required?: string[]
  }
  const required = new Set(schema.required ?? [])
  const props = schema.properties ?? {}
  return Object.entries(props).map(([name, spec]) => ({
    name,
    type: spec?.type ?? 'any',
    required: required.has(name),
    description: spec?.description,
  }))
}
