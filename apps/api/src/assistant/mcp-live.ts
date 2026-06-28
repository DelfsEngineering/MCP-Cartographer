import {
  callMcpTool,
  getMcpPrompt,
  listMcpCapabilities,
  readMcpResource,
  type McpConnectionConfig,
} from '@mcp-cartographer/mcp-client'
import type { ScanDocument } from '@mcp-cartographer/shared'
import { redactSecrets } from '@mcp-cartographer/scan-core'
import { describeFromScan } from './scan-describe'

const MAX_RESULT_CHARS = 16_000

function truncateJson(value: unknown): string {
  const text = redactSecrets(JSON.stringify(value, null, 2))
  if (text.length <= MAX_RESULT_CHARS) return text
  return `${text.slice(0, MAX_RESULT_CHARS)}\n… [truncated ${text.length - MAX_RESULT_CHARS} chars]`
}

export type McpAssistantConnection = McpConnectionConfig

const SCAN_DESCRIBE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'scan_describe_capability',
    description:
      'Get full metadata from the scan snapshot: JSON Schema, descriptions, prompt arguments, resource/template URIs. Use before live calls when you need exact schemas.',
    parameters: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['tool', 'resource', 'resource_template', 'prompt'],
          description: 'Capability type to describe',
        },
        name: {
          type: 'string',
          description: 'Tool name, prompt name, or resource/template name (partial match ok for resources)',
        },
        uri: {
          type: 'string',
          description: 'Resource URI or resource template URI (alternative to name)',
        },
      },
      required: ['kind'],
      additionalProperties: false,
    },
  },
}

const LIVE_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'mcp_list_capabilities',
      description:
        'Re-discover the live MCP server catalog: tools (with schemas), resources, resource templates, prompts, server info, and instructions. Use to refresh or compare against the scan.',
      parameters: {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            enum: ['all', 'tools', 'resources', 'resource_templates', 'prompts', 'server'],
            description: 'What to list. Default all.',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'mcp_call_tool',
      description:
        'Call a tool on the live MCP server. Use scan_describe_capability first for exact input schema. Prefer read-only tools unless the user asked to test writes.',
      parameters: {
        type: 'object',
        properties: {
          tool_name: { type: 'string', description: 'Exact tool name' },
          arguments: {
            type: 'object',
            description: 'Tool input arguments matching the JSON schema',
            additionalProperties: true,
          },
        },
        required: ['tool_name'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'mcp_read_resource',
      description:
        'Read a resource URI from the live MCP server. Works for static URIs and concrete template instances (e.g. guide://pageSchema).',
      parameters: {
        type: 'object',
        properties: {
          uri: { type: 'string', description: 'Full resource URI to read' },
        },
        required: ['uri'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'mcp_get_prompt',
      description: 'Resolve an MCP prompt template on the live server with optional string arguments.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Prompt name' },
          arguments: {
            type: 'object',
            description: 'Prompt argument values',
            additionalProperties: { type: 'string' },
          },
        },
        required: ['name'],
        additionalProperties: false,
      },
    },
  },
]

export function buildAssistantOpenAiTools(hasLiveConnection: boolean) {
  return hasLiveConnection ? [SCAN_DESCRIBE_TOOL, ...LIVE_TOOLS] : [SCAN_DESCRIBE_TOOL]
}

export type AssistantToolCall =
  | { name: 'scan_describe_capability'; args: Record<string, unknown> }
  | { name: 'mcp_list_capabilities'; args: Record<string, unknown> }
  | { name: 'mcp_call_tool'; args: Record<string, unknown> }
  | { name: 'mcp_read_resource'; args: Record<string, unknown> }
  | { name: 'mcp_get_prompt'; args: Record<string, unknown> }

export function describeAssistantToolCall(call: AssistantToolCall): string {
  switch (call.name) {
    case 'scan_describe_capability': {
      const kind = String(call.args.kind ?? 'capability')
      const label = call.args.name ?? call.args.uri ?? ''
      return `scan ${kind}${label ? ` ${label}` : ''}`
    }
    case 'mcp_list_capabilities':
      return `list ${String(call.args.scope ?? 'all')}`
    case 'mcp_call_tool':
      return `tool ${String(call.args.tool_name ?? 'unknown')}`
    case 'mcp_read_resource':
      return `resource ${String(call.args.uri ?? 'unknown')}`
    case 'mcp_get_prompt':
      return `prompt ${String(call.args.name ?? 'unknown')}`
  }
}

export function parseAssistantToolCall(
  name: string,
  argsJson: string,
): AssistantToolCall | { error: string } {
  let args: Record<string, unknown>
  try {
    args = JSON.parse(argsJson) as Record<string, unknown>
  } catch {
    return { error: 'Invalid tool arguments JSON' }
  }

  const known = [
    'scan_describe_capability',
    'mcp_list_capabilities',
    'mcp_call_tool',
    'mcp_read_resource',
    'mcp_get_prompt',
  ] as const

  if ((known as readonly string[]).includes(name)) {
    return { name: name as AssistantToolCall['name'], args }
  }
  return { error: `Unknown tool: ${name}` }
}

export async function executeAssistantToolCall(
  call: AssistantToolCall,
  ctx: { scan: ScanDocument; connection?: McpAssistantConnection | null },
): Promise<string> {
  switch (call.name) {
    case 'scan_describe_capability': {
      const kind = call.args.kind
      if (
        kind !== 'tool' &&
        kind !== 'resource' &&
        kind !== 'resource_template' &&
        kind !== 'prompt'
      ) {
        return JSON.stringify({ ok: false, error: 'kind must be tool, resource, resource_template, or prompt' })
      }
      const result = describeFromScan(ctx.scan, {
        kind,
        name: typeof call.args.name === 'string' ? call.args.name : undefined,
        uri: typeof call.args.uri === 'string' ? call.args.uri : undefined,
      })
      return truncateJson(result)
    }
    case 'mcp_list_capabilities': {
      if (!ctx.connection?.endpoint) {
        return JSON.stringify({ ok: false, error: 'No live MCP connection' })
      }
      const scope = call.args.scope
      const validScopes = ['all', 'tools', 'resources', 'resource_templates', 'prompts', 'server'] as const
      const parsedScope =
        typeof scope === 'string' && (validScopes as readonly string[]).includes(scope)
          ? (scope as (typeof validScopes)[number])
          : 'all'
      const result = await listMcpCapabilities(ctx.connection, parsedScope)
      return truncateJson(result)
    }
    case 'mcp_call_tool': {
      if (!ctx.connection?.endpoint) {
        return JSON.stringify({ ok: false, error: 'No live MCP connection' })
      }
      const toolName = typeof call.args.tool_name === 'string' ? call.args.tool_name : ''
      if (!toolName) return JSON.stringify({ ok: false, error: 'tool_name is required' })
      const args =
        call.args.arguments && typeof call.args.arguments === 'object'
          ? (call.args.arguments as Record<string, unknown>)
          : {}
      const result = await callMcpTool(ctx.connection, toolName, args)
      return truncateJson(result)
    }
    case 'mcp_read_resource': {
      if (!ctx.connection?.endpoint) {
        return JSON.stringify({ ok: false, error: 'No live MCP connection' })
      }
      const uri = typeof call.args.uri === 'string' ? call.args.uri : ''
      if (!uri) return JSON.stringify({ ok: false, error: 'uri is required' })
      const result = await readMcpResource(ctx.connection, uri)
      return truncateJson(result)
    }
    case 'mcp_get_prompt': {
      if (!ctx.connection?.endpoint) {
        return JSON.stringify({ ok: false, error: 'No live MCP connection' })
      }
      const name = typeof call.args.name === 'string' ? call.args.name : ''
      if (!name) return JSON.stringify({ ok: false, error: 'name is required' })
      const rawArgs = call.args.arguments
      const promptArgs: Record<string, string> = {}
      if (rawArgs && typeof rawArgs === 'object') {
        for (const [k, v] of Object.entries(rawArgs as Record<string, unknown>)) {
          if (typeof v === 'string') promptArgs[k] = v
        }
      }
      const result = await getMcpPrompt(ctx.connection, name, promptArgs)
      return truncateJson(result)
    }
    default:
      return JSON.stringify({ ok: false, error: `Unknown action: ${(call as AssistantToolCall).name}` })
  }
}
