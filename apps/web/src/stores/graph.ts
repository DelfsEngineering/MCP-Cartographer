import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { VisualGraphNode } from '@mcp-cartographer/shared'
import { defaultGraphUiState, type GraphUiState, type NodePosition } from '@/lib/scan-storage'

export const useGraphStore = defineStore('graph', () => {
  const showTools = ref(true)
  const showResources = ref(true)
  const showPrompts = ref(true)
  const showSchemas = ref(true)
  const showFindings = ref(true)
  const showRisks = ref(true)
  const showAiEdges = ref(true)
  const focusMode = ref(false)
  const nodePositions = ref<Record<string, NodePosition>>({})
  /** Bumped when layout should rebuild from dagre (e.g. reset layout). */
  const layoutRevision = ref(0)

  const nodeFilters = () => ({
    tool: showTools.value,
    resource: showResources.value,
    prompt: showPrompts.value,
    schema: showSchemas.value,
    finding: showFindings.value,
    risk: showRisks.value,
    server: true,
    concept: true,
    probe_result: true,
  })

  function isNodeVisible(node: VisualGraphNode): boolean {
    const filters = nodeFilters()
    if (node.type === 'tool' && node.isRisky && !showRisks.value) return false
    return filters[node.type] !== false
  }

  function setNodePosition(nodeId: string, position: NodePosition) {
    nodePositions.value = {
      ...nodePositions.value,
      [nodeId]: { x: position.x, y: position.y },
    }
  }

  function clearNodePositions() {
    nodePositions.value = {}
    layoutRevision.value += 1
  }

  function getUiState(): GraphUiState {
    return {
      showTools: showTools.value,
      showResources: showResources.value,
      showPrompts: showPrompts.value,
      showSchemas: showSchemas.value,
      showFindings: showFindings.value,
      showRisks: showRisks.value,
      showAiEdges: showAiEdges.value,
      focusMode: focusMode.value,
      nodePositions: { ...nodePositions.value },
    }
  }

  function applyUiState(state: GraphUiState) {
    showTools.value = state.showTools
    showResources.value = state.showResources
    showPrompts.value = state.showPrompts
    showSchemas.value = state.showSchemas
    showFindings.value = state.showFindings
    showRisks.value = state.showRisks
    showAiEdges.value = state.showAiEdges
    focusMode.value = state.focusMode
    nodePositions.value = { ...(state.nodePositions ?? {}) }
  }

  function resetUiState() {
    applyUiState(defaultGraphUiState())
    layoutRevision.value += 1
  }

  return {
    showTools,
    showResources,
    showPrompts,
    showSchemas,
    showFindings,
    showRisks,
    showAiEdges,
    focusMode,
    nodePositions,
    layoutRevision,
    isNodeVisible,
    setNodePosition,
    clearNodePositions,
    getUiState,
    applyUiState,
    resetUiState,
  }
})
