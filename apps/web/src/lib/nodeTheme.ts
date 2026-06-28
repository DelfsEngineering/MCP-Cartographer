import type { GraphNodeType } from '@mcp-cartographer/shared'

export type NodeTheme = {
  label: string
  color: string
  container: string
  iconWrap: string
  typeLabel: string
  selectedRing: string
}

const themes: Record<GraphNodeType, NodeTheme> = {
  server: {
    label: 'Server',
    color: '#7B5CFF',
    container: 'bg-grape-50 border-grape-300',
    iconWrap: 'bg-grape-500 text-white',
    typeLabel: 'text-grape-700',
    selectedRing: 'ring-grape-500',
  },
  tool: {
    label: 'Tool',
    color: '#F04B37',
    container: 'bg-blaze-50 border-blaze-300',
    iconWrap: 'bg-blaze-500 text-white',
    typeLabel: 'text-blaze-700',
    selectedRing: 'ring-blaze-500',
  },
  resource: {
    label: 'Resource',
    color: '#2563EB',
    container: 'bg-blue-50 border-blue-300',
    iconWrap: 'bg-blue-500 text-white',
    typeLabel: 'text-blue-700',
    selectedRing: 'ring-blue-500',
  },
  prompt: {
    label: 'Prompt',
    color: '#9333EA',
    container: 'bg-violet-50 border-violet-300',
    iconWrap: 'bg-violet-500 text-white',
    typeLabel: 'text-violet-700',
    selectedRing: 'ring-violet-500',
  },
  schema: {
    label: 'Schema',
    color: '#059669',
    container: 'bg-emerald-50 border-emerald-300',
    iconWrap: 'bg-emerald-500 text-white',
    typeLabel: 'text-emerald-700',
    selectedRing: 'ring-emerald-500',
  },
  concept: {
    label: 'Concept',
    color: '#64748B',
    container: 'bg-slate-50 border-slate-300',
    iconWrap: 'bg-slate-500 text-white',
    typeLabel: 'text-slate-700',
    selectedRing: 'ring-slate-500',
  },
  finding: {
    label: 'Finding',
    color: '#F59E0B',
    container: 'bg-amber-50 border-amber-300',
    iconWrap: 'bg-amber-500 text-white',
    typeLabel: 'text-amber-700',
    selectedRing: 'ring-amber-500',
  },
  risk: {
    label: 'Risk',
    color: '#EF4444',
    container: 'bg-red-50 border-red-300',
    iconWrap: 'bg-red-500 text-white',
    typeLabel: 'text-red-700',
    selectedRing: 'ring-red-500',
  },
  probe_result: {
    label: 'Probe',
    color: '#0891B2',
    container: 'bg-cyan-50 border-cyan-300',
    iconWrap: 'bg-cyan-500 text-white',
    typeLabel: 'text-cyan-700',
    selectedRing: 'ring-cyan-500',
  },
}

const fallback: NodeTheme = {
  label: 'Node',
  color: '#A99F94',
  container: 'bg-carto-panelSoft border-carto-border',
  iconWrap: 'bg-carto-muted text-white',
  typeLabel: 'text-carto-muted',
  selectedRing: 'ring-carto-muted',
}

export function getNodeTheme(type: string): NodeTheme {
  return themes[type as GraphNodeType] ?? fallback
}

/** Types shown in the map legend (primary MCP surface area). */
export const LEGEND_TYPES: GraphNodeType[] = [
  'server',
  'tool',
  'resource',
  'prompt',
]
