import dagre from 'dagre'
import type { Node, Edge } from '@vue-flow/core'
import type { VisualGraph, VisualGraphEdge, VisualGraphNode } from '@mcp-cartographer/shared'

const NODE_WIDTH = 200
const NODE_HEIGHT = 80

export function layoutGraph(
  nodes: VisualGraphNode[],
  edges: VisualGraphEdge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 })

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(g)

  const flowNodes: Node[] = nodes.map((node) => {
    const pos = g.node(node.id)
    return {
      id: node.id,
      type: 'carto',
      position: {
        x: (pos?.x ?? 0) - NODE_WIDTH / 2,
        y: (pos?.y ?? 0) - NODE_HEIGHT / 2,
      },
      data: { visual: node },
    }
  })

  const flowEdges: Edge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.inferredBy === 'ai' ? 'smoothstep' : 'default',
    animated: edge.inferredBy === 'ai',
    label: edge.label,
    style: edgeStyle(edge),
    labelStyle: { fontSize: 10, fill: '#756D64' },
    labelBgStyle: { fill: '#FBFAF7' },
  }))

  return { nodes: flowNodes, edges: flowEdges }
}

function edgeStyle(edge: VisualGraphEdge): Record<string, string | number> {
  if (edge.type === 'writes_to' || edge.isSuggested) {
    return { stroke: '#F04B37', strokeDasharray: edge.isSuggested ? '4 4' : 'none' }
  }
  if (edge.inferredBy === 'ai') {
    return { stroke: '#7B5CFF', strokeDasharray: '6 4' }
  }
  if (edge.inferredBy === 'deterministic') {
    return { stroke: '#756D64' }
  }
  return { stroke: '#A99F94' }
}

export function getNeighborhood(
  graph: VisualGraph,
  nodeId: string,
  hops = 1,
): Set<string> {
  const result = new Set<string>([nodeId])
  let frontier = [nodeId]

  for (let h = 0; h < hops; h++) {
    const next: string[] = []
    for (const edge of graph.edges) {
      if (frontier.includes(edge.source) && !result.has(edge.target)) {
        result.add(edge.target)
        next.push(edge.target)
      }
      if (frontier.includes(edge.target) && !result.has(edge.source)) {
        result.add(edge.source)
        next.push(edge.source)
      }
    }
    frontier = next
  }

  return result
}
