<script setup lang="ts">
import { computed } from 'vue'
import type { VisualGraphNode } from '@mcp-cartographer/shared'
import { useScanStore } from '@/stores/scan'
import { getNodeTheme } from '@/lib/nodeTheme'
import NodeTypeIcon from './NodeTypeIcon.vue'

const props = defineProps<{
  visual: VisualGraphNode
  isOneHopNeighbor?: boolean
}>()

const scan = useScanStore()
const selected = computed(() => scan.selectedNodeId === props.visual.id)
const theme = computed(() => getNodeTheme(props.visual.type))
const nodeStyle = computed(() => {
  if (selected.value) {
    return {
      backgroundColor: theme.value.color,
      borderColor: theme.value.color,
      borderLeftColor: theme.value.color,
    }
  }
  if (props.isOneHopNeighbor) {
    return {
      backgroundColor: '#EDE9FE',
      borderColor: '#A78BFA',
      borderLeftColor: theme.value.color,
    }
  }
  return { borderLeftColor: theme.value.color }
})

function selectCard() {
  scan.selectNode(props.visual.id)
}

function selectCardFromPointer(event: PointerEvent) {
  if (event.button !== 0) return
  selectCard()
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="rounded-xl border-2 shadow-node px-3 py-2 min-w-[180px] max-w-[220px] transition-shadow border-l-[5px]"
    :class="[
      theme.container,
      selected ? `ring-2 ${theme.selectedRing} shadow-soft` : '',
      !selected && props.isOneHopNeighbor ? 'ring-2 ring-grape-400 shadow-soft' : '',
      visual.isOrphaned ? 'border-dashed' : '',
    ]"
    :style="nodeStyle"
    @pointerdown="selectCardFromPointer"
    @click.stop="selectCard"
    @keydown.enter.stop.prevent="selectCard"
    @keydown.space.stop.prevent="selectCard"
  >
    <div class="flex items-center gap-2">
      <span
        class="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
        :class="selected ? 'bg-white text-carto-text' : theme.iconWrap"
      >
        <NodeTypeIcon :type="visual.type" class="w-4 h-4" />
      </span>
      <span
        class="text-[10px] font-semibold uppercase tracking-wide"
        :class="selected ? 'text-white/90' : theme.typeLabel"
      >
        {{ theme.label }}
      </span>
    </div>
    <p
      class="font-medium text-sm mt-1.5 truncate"
      :class="selected ? 'text-white' : 'text-carto-text'"
      :title="visual.label"
    >{{ visual.label }}</p>
    <p
      v-if="visual.subtitle"
      class="text-xs mt-0.5 line-clamp-2"
      :class="selected ? 'text-white/80' : 'text-carto-muted'"
    >{{ visual.subtitle }}</p>
    <div class="flex items-center gap-2 mt-2 flex-wrap">
      <span
        v-if="visual.score != null"
        class="text-xs"
        :class="selected ? 'text-white/80' : 'text-carto-muted'"
      >Score {{ visual.score }}</span>
      <span
        v-if="visual.issueCount"
        class="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700"
      >{{ visual.issueCount }} issues</span>
      <span
        v-if="visual.isRisky"
        class="text-xs px-1.5 py-0.5 rounded bg-blaze-50 text-blaze-600"
      >risk</span>
      <span
        v-if="visual.isOrphaned"
        class="text-xs px-1.5 py-0.5 rounded bg-carto-panelSoft text-carto-muted"
      >orphan</span>
      <span
        v-for="badge in visual.badges?.filter((b) => !['orphan', 'risk'].includes(b))"
        :key="badge"
        class="text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700"
      >{{ badge }}</span>
    </div>
  </div>
</template>
