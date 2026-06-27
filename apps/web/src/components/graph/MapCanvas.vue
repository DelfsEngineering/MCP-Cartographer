<script setup lang="ts">
import { computed, markRaw } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

import { useScanStore } from '@/stores/scan'
import { useGraphStore } from '@/stores/graph'
import { layoutGraph, getNeighborhood } from '@/lib/layout'
import CartoNode from './CartoNode.vue'
import FitViewHelper from './FitViewHelper.vue'

const scan = useScanStore()
const graphStore = useGraphStore()

const nodeTypes = { carto: markRaw(CartoNode) }

const filtered = computed(() => {
  const vg = scan.visualGraph
  if (!vg) return { nodes: [], edges: [] }

  let nodes = vg.nodes.filter((n) => graphStore.isNodeVisible(n))
  let edges = vg.edges.filter((e) => {
    if (!graphStore.showAiEdges && e.inferredBy === 'ai') return false
    return true
  })

  if (graphStore.focusMode && scan.selectedNodeId) {
    const hood = getNeighborhood(vg, scan.selectedNodeId, 1)
    nodes = nodes.filter((n) => hood.has(n.id))
    edges = edges.filter((e) => hood.has(e.source) && hood.has(e.target))
  }

  const nodeIds = new Set(nodes.map((n) => n.id))
  edges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))

  return layoutGraph(nodes, edges)
})

const flowNodes = computed(() => filtered.value.nodes)

function onNodeClick({ node }: { node: { id: string } }) {
  scan.selectNode(node.id)
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="px-3 py-2 border-b border-carto-border bg-carto-panel flex flex-wrap gap-2 items-center">
      <span class="text-xs text-carto-faint mr-1">Show:</span>
      <label class="text-xs flex items-center gap-1"><input v-model="graphStore.showTools" type="checkbox" /> Tools</label>
      <label class="text-xs flex items-center gap-1"><input v-model="graphStore.showResources" type="checkbox" /> Resources</label>
      <label class="text-xs flex items-center gap-1"><input v-model="graphStore.showPrompts" type="checkbox" /> Prompts</label>
      <label class="text-xs flex items-center gap-1"><input v-model="graphStore.showSchemas" type="checkbox" /> Schemas</label>
      <label class="text-xs flex items-center gap-1"><input v-model="graphStore.showAiEdges" type="checkbox" /> AI edges</label>
      <label class="text-xs flex items-center gap-1 ml-2"><input v-model="graphStore.focusMode" type="checkbox" /> Focus mode</label>
    </div>
    <div class="flex-1 relative min-h-0">
      <VueFlow
        :nodes="flowNodes"
        :edges="filtered.edges"
        :node-types="(nodeTypes as any)"
        :min-zoom="0.05"
        :max-zoom="4"
        :nodes-draggable="false"
        :pan-on-drag="true"
        :selection-on-drag="false"
        :zoom-on-scroll="true"
        class="h-full bg-carto-bg"
        @node-click="onNodeClick"
      >
        <FitViewHelper />
        <Background pattern-color="#E7E0D6" :gap="20" />
        <Controls />
        <MiniMap />
        <template #node-carto="nodeProps">
          <CartoNode :visual="nodeProps.data.visual" />
        </template>
      </VueFlow>
    </div>
    <div class="px-3 py-1.5 border-t border-carto-border text-xs text-carto-faint flex gap-4">
      <span>— solid = discovered</span>
      <span class="text-grape-500">- - AI inferred</span>
      <span class="text-blaze-500">··· suggested</span>
    </div>
  </div>
</template>
