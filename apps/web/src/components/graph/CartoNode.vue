<script setup lang="ts">
import { computed } from 'vue'
import type { VisualGraphNode } from '@mcp-cartographer/shared'
import { useScanStore } from '@/stores/scan'

const props = defineProps<{
  visual: VisualGraphNode
}>()

const scan = useScanStore()
const selected = computed(() => scan.selectedNodeId === props.visual.id)

const accent = computed(() => {
  switch (props.visual.type) {
    case 'tool': return 'border-blaze-200 ring-blaze-100'
    case 'resource': return 'border-blue-200'
    case 'prompt': return 'border-grape-200'
    case 'schema': return 'border-emerald-200'
    case 'server': return 'border-grape-300 bg-grape-50'
    case 'finding': return 'border-severity-medium'
    case 'risk': return 'border-severity-high'
    default: return 'border-carto-border'
  }
})

const icon = computed(() => {
  const map: Record<string, string> = {
    server: '◉',
    tool: '⚙',
    resource: '📄',
    prompt: '💬',
    schema: '▦',
    finding: '⚑',
    risk: '⚠',
  }
  return map[props.visual.type] ?? '•'
})
</script>

<template>
  <div
    class="rounded-xl border bg-white shadow-node px-3 py-2 min-w-[180px] max-w-[220px] transition-shadow"
    :class="[
      accent,
      selected ? 'ring-2 ring-grape-500 shadow-soft' : '',
      visual.isOrphaned ? 'border-dashed' : '',
    ]"
  >
    <div class="flex items-center gap-2">
      <span class="text-sm opacity-70">{{ icon }}</span>
      <span class="text-xs uppercase text-carto-faint">{{ visual.type }}</span>
    </div>
    <p class="font-medium text-sm mt-1 truncate" :title="visual.label">{{ visual.label }}</p>
    <p v-if="visual.subtitle" class="text-xs text-carto-muted mt-0.5 line-clamp-2">{{ visual.subtitle }}</p>
    <div class="flex items-center gap-2 mt-2 flex-wrap">
      <span v-if="visual.score != null" class="text-xs text-carto-muted">Score {{ visual.score }}</span>
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
    </div>
  </div>
</template>
