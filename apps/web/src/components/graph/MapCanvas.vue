<script setup lang="ts">
import { computed, markRaw, ref, watch } from 'vue'
import { VueFlow } from '@vue-flow/core'
import type { Edge, Node } from '@vue-flow/core'
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
import { getNodeTheme, LEGEND_TYPES } from '@/lib/nodeTheme'
import CartoNode from './CartoNode.vue'
import FitViewHelper from './FitViewHelper.vue'
import NodeTypeIcon from './NodeTypeIcon.vue'

const scan = useScanStore()
const graphStore = useGraphStore()

const nodeTypes = { carto: markRaw(CartoNode) }

const flowNodes = ref<Node[]>([])
const flowEdges = ref<Edge[]>([])

const layoutDeps = computed(() => ({
  scanId: scan.scanDoc?.scan.id ?? null,
  revision: graphStore.layoutRevision,
  showTools: graphStore.showTools,
  showResources: graphStore.showResources,
  showPrompts: graphStore.showPrompts,
  showAiEdges: graphStore.showAiEdges,
  focusMode: graphStore.focusMode,
  selectedNodeId: scan.selectedNodeId,
  graph: scan.visualGraph,
}))

function rebuildFlowGraph() {
  const vg = layoutDeps.value.graph
  if (!vg) {
    flowNodes.value = []
    flowEdges.value = []
    return
  }

  let nodes = vg.nodes.filter((n) => graphStore.isNodeVisible(n))
  let edges = vg.edges.filter((e) => {
    if (!graphStore.showAiEdges && e.inferredBy === 'ai') return false
    return true
  })
  const highlightNodeIds = scan.selectedNodeId
    ? getNeighborhood(vg, scan.selectedNodeId, 1)
    : new Set<string>()
  const highlightEdgeIds = scan.selectedNodeId
    ? new Set(
        edges
          .filter((e) => e.source === scan.selectedNodeId || e.target === scan.selectedNodeId)
          .map((e) => e.id),
      )
    : new Set<string>()

  if (graphStore.focusMode && scan.selectedNodeId) {
    nodes = nodes.filter((n) => highlightNodeIds.has(n.id))
    edges = edges.filter((e) => highlightNodeIds.has(e.source) && highlightNodeIds.has(e.target))
  }

  const nodeIds = new Set(nodes.map((n) => n.id))
  edges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))

  const laid = layoutGraph(nodes, edges, graphStore.nodePositions, {
    selectedNodeId: scan.selectedNodeId,
    nodeIds: highlightNodeIds,
    edgeIds: highlightEdgeIds,
  })
  flowNodes.value = laid.nodes
  flowEdges.value = laid.edges
}

watch(layoutDeps, rebuildFlowGraph, { immediate: true, deep: true })

function onNodeClick({ node }: { node: { id: string } }) {
  scan.selectNode(node.id)
}

function onNodeDragStop({ node }: { node: Node }) {
  graphStore.setNodePosition(node.id, { x: node.position.x, y: node.position.y })
  scan.schedulePersist()
}

function resetLayout() {
  graphStore.clearNodePositions()
  scan.schedulePersist()
}

function minimapNodeColor(node: { data?: { visual?: { type?: string } } }) {
  return getNodeTheme(node.data?.visual?.type ?? 'concept').color
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="px-3 py-2 border-b border-carto-border bg-carto-panel flex flex-wrap gap-2 items-center">
      <span class="text-xs text-carto-faint mr-1">Show:</span>
      <label class="text-xs flex items-center gap-1"><input v-model="graphStore.showTools" type="checkbox" /> Tools</label>
      <label class="text-xs flex items-center gap-1"><input v-model="graphStore.showResources" type="checkbox" /> Resources</label>
      <label class="text-xs flex items-center gap-1"><input v-model="graphStore.showPrompts" type="checkbox" /> Prompts</label>
      <label class="text-xs flex items-center gap-1"><input v-model="graphStore.showAiEdges" type="checkbox" /> AI edges</label>
      <label class="text-xs flex items-center gap-1 ml-2"><input v-model="graphStore.focusMode" type="checkbox" /> Focus mode</label>
      <button
        type="button"
        class="text-xs ml-auto text-carto-muted hover:text-carto-text underline-offset-2 hover:underline"
        @click="resetLayout"
      >
        Reset layout
      </button>
    </div>
    <div class="flex-1 relative min-h-0 overflow-hidden map-canvas">
      <VueFlow
        v-model:nodes="flowNodes"
        v-model:edges="flowEdges"
        :node-types="(nodeTypes as any)"
        :min-zoom="0.05"
        :max-zoom="4"
        :nodes-draggable="true"
        :nodes-connectable="false"
        :pan-on-drag="true"
        :selection-on-drag="false"
        :zoom-on-scroll="true"
        class="h-full bg-carto-bg"
        @node-click="onNodeClick"
        @node-drag-stop="onNodeDragStop"
      >
        <FitViewHelper />
        <Background pattern-color="#E7E0D6" :gap="20" />
        <Controls />
        <MiniMap :node-color="minimapNodeColor" />
        <template #node-carto="nodeProps">
          <CartoNode
            :visual="nodeProps.data.visual"
            :is-one-hop-neighbor="nodeProps.data.isOneHopNeighbor"
          />
        </template>
      </VueFlow>
    </div>
    <div class="px-3 py-1.5 border-t border-carto-border text-xs text-carto-faint flex flex-wrap items-center gap-x-4 gap-y-1">
      <div class="flex flex-wrap items-center gap-3 mr-2">
        <span
          v-for="t in LEGEND_TYPES"
          :key="t"
          class="inline-flex items-center gap-1"
        >
          <span
            class="inline-flex items-center justify-center w-4 h-4 rounded"
            :style="{ backgroundColor: getNodeTheme(t).color }"
          >
            <NodeTypeIcon :type="t" class="w-2.5 h-2.5 text-white" />
          </span>
          <span class="text-carto-muted">{{ getNodeTheme(t).label }}</span>
        </span>
      </div>
      <span class="hidden sm:inline text-carto-border">|</span>
      <span class="inline-flex items-center gap-1">
        <i class="fa-slab fa-regular fa-circle text-[0.55rem]" aria-hidden="true" />
        solid = discovered
      </span>
      <span class="inline-flex items-center gap-1 text-blue-600">
        <i class="fa-slab fa-regular fa-link" aria-hidden="true" />
        guide links
      </span>
      <span class="inline-flex items-center gap-1 text-grape-500">
        <i class="fa-slab fa-regular fa-lightbulb" aria-hidden="true" />
        AI inferred
      </span>
      <span class="inline-flex items-center gap-1 text-blaze-500">
        <i class="fa-slab fa-regular fa-lightbulb" aria-hidden="true" />
        suggested
      </span>
      <span class="inline-flex items-center gap-1 ml-auto text-carto-muted">
        Drag cards to rearrange
      </span>
    </div>
  </div>
</template>

<style scoped>
.map-canvas :deep(.vue-flow__node.draggable) {
  cursor: grab;
}

.map-canvas :deep(.vue-flow__node.draggable.dragging) {
  cursor: grabbing;
}

.map-canvas :deep(.vue-flow__edge),
.map-canvas :deep(.vue-flow__edge-path),
.map-canvas :deep(.vue-flow__connection-path) {
  pointer-events: none;
}

.map-canvas :deep(.vue-flow__minimap) {
  pointer-events: none !important;
}
</style>
