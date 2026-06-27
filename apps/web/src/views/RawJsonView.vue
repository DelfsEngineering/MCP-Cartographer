<script setup lang="ts">
import { computed } from 'vue'
import { useScanStore } from '@/stores/scan'
import { redactSecrets } from '@mcp-cartographer/scan-core'

const scan = useScanStore()

const json = computed(() => {
  if (!scan.scanDoc) return '{}'
  return redactSecrets(JSON.stringify(scan.scanDoc, null, 2))
})

function copy() {
  navigator.clipboard.writeText(json.value)
}
</script>

<template>
  <div class="h-full flex flex-col p-4">
    <div v-if="!scan.scanDoc" class="text-center text-carto-muted mt-12">No scan loaded.</div>
    <template v-else>
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-medium">Raw scan JSON</h2>
        <button
          type="button"
          class="text-sm px-3 py-1 rounded border border-carto-border hover:bg-carto-panelSoft"
          @click="copy"
        >
          Copy
        </button>
      </div>
      <pre class="flex-1 overflow-auto text-xs font-mono p-4 bg-carto-panel border border-carto-border rounded-xl">{{ json }}</pre>
    </template>
  </div>
</template>
