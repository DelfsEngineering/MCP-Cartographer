import { redactSecrets } from '@mcp-cartographer/scan-core'

type ResourceContentBlock = {
  uri?: string
  mimeType?: string
  text?: string
  blob?: string
}

/** Turn MCP readResource / getPrompt payloads into displayable text. */
export function formatMcpPayload(payload: unknown): string {
  if (payload == null) return ''
  if (typeof payload === 'string') return redactSecrets(payload)

  if (typeof payload === 'object') {
    const obj = payload as Record<string, unknown>

    if (obj.ok === false && typeof obj.error === 'string') {
      return `Error: ${obj.error}`
    }

    const data = obj.data ?? obj

    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>

      if (Array.isArray(d.contents)) {
        return redactSecrets(
          (d.contents as ResourceContentBlock[])
            .map((block, i) => {
              const header = [
                block.uri ? `--- ${block.uri}` : `--- block ${i + 1}`,
                block.mimeType,
              ]
                .filter(Boolean)
                .join(' · ')
              const body = block.text ?? (block.blob ? `[base64 blob ${block.blob.length} chars]` : '')
              return `${header}\n${body}`
            })
            .join('\n\n'),
        )
      }

      if (Array.isArray(d.messages)) {
        return redactSecrets(
          (d.messages as Array<{ role?: string; content?: { type?: string; text?: string } }>)
            .map((m) => {
              const text =
                typeof m.content === 'string'
                  ? m.content
                  : m.content?.text ?? JSON.stringify(m.content)
              return `${m.role ?? 'message'}: ${text}`
            })
            .join('\n\n'),
        )
      }
    }
  }

  return redactSecrets(JSON.stringify(payload, null, 2))
}

export function formatJson(value: unknown): string {
  if (value == null) return '—'
  return redactSecrets(JSON.stringify(value, null, 2))
}
