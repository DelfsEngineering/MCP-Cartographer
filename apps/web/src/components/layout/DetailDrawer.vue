<script setup lang="ts">
import { computed } from 'vue'
import { useScanStore } from '@/stores/scan'
import { redactSecrets } from '@mcp-cartographer/scan-core'

const scan = useScanStore()

const rawJson = computed(() => {
  if (!scan.scanDoc) return ''
  return redactSecrets(JSON.stringify(scan.scanDoc, null, 2))
})

const node = computed(() => scan.selectedNode)
const finding = computed(() => scan.selectedFinding)
</script>

<template>
  <div
    v-if="node || finding"
    class="shrink-0 border-t border-carto-border bg-carto-panel max-h-56 overflow-y-auto"
  >
    <div class="px-4 py-3">
      <template v-if="finding">
        <div class="flex items-start justify-between gap-2">
          <div>
            <span
              class="text-xs font-medium uppercase px-1.5 py-0.5 rounded"
              :class="{
                'bg-red-100 text-red-700': finding.severity === 'high',
                'bg-amber-100 text-amber-700': finding.severity === 'medium',
                'bg-green-100 text-green-700': finding.severity === 'low',
                'bg-blue-100 text-blue-700': finding.severity === 'info',
              }"
            >{{ finding.severity }}</span>
            <h3 class="font-medium mt-1">{{ finding.title }}</h3>
            <p class="text-sm text-carto-muted mt-1">{{ finding.message }}</p>
            <p v-if="finding.recommendation" class="text-sm text-grape-700 mt-2">
              {{ finding.recommendation }}
            </p>
          </div>
          <button type="button" class="text-carto-faint hover:text-carto-muted" @click="scan.clearSelection()">×</button>
        </div>
      </template>
      <template v-else-if="node">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs uppercase text-carto-faint">{{ node.type }}</span>
              <span
                v-for="badge in node.badges"
                :key="badge"
                class="text-xs px-1.5 py-0.5 rounded bg-blaze-50 text-blaze-600"
              >{{ badge }}</span>
              <span v-if="node.score != null" class="text-xs text-carto-muted">Score {{ node.score }}</span>
            </div>
            <h3 class="font-medium mt-0.5">{{ node.label }}</h3>
            <p v-if="node.subtitle" class="text-sm text-carto-muted mt-1">{{ node.subtitle }}</p>
            <details v-if="node.raw" class="mt-2">
              <summary class="text-xs text-carto-faint cursor-pointer">Raw data</summary>
              <pre class="text-xs mt-1 p-2 bg-carto-panelSoft rounded overflow-x-auto max-h-24">{{ rawJson.slice(0, 500) }}…</pre>
            </details>
          </div>
          <button type="button" class="text-carto-faint hover:text-carto-muted shrink-0" @click="scan.selectNode(null)">×</button>
        </div>
      </template>
    </div>
  </div>
</template>
