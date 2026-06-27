import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { VisualGraphNode } from '@mcp-cartographer/shared'

export const useGraphStore = defineStore('graph', () => {
  const showTools = ref(true)
  const showResources = ref(true)
  const showPrompts = ref(true)
  const showSchemas = ref(true)
  const showFindings = ref(true)
  const showRisks = ref(true)
  const showAiEdges = ref(true)
  const focusMode = ref(false)

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

  return {
    showTools,
    showResources,
    showPrompts,
    showSchemas,
    showFindings,
    showRisks,
    showAiEdges,
    focusMode,
    isNodeVisible,
  }
})
