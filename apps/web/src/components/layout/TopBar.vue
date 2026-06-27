<script setup lang="ts">
import { useScanStore } from '@/stores/scan'
import { useConnectionStore } from '@/stores/connection'

const scan = useScanStore()
const conn = useConnectionStore()

const score = () => scan.scanDoc?.scan.summary?.score
</script>

<template>
  <header class="h-14 border-b border-carto-border bg-carto-panel px-4 flex items-center gap-3 shrink-0">
    <div class="flex items-center gap-2 mr-4">
      <div class="w-8 h-8 rounded-lg bg-grape-500 flex items-center justify-center text-white text-sm font-bold">M</div>
      <span class="font-semibold text-carto-text">MCP Cartographer</span>
    </div>

    <div class="flex-1 flex items-center gap-2 text-sm text-carto-muted">
      <template v-if="scan.scanDoc">
        <span class="px-2 py-1 rounded-md bg-carto-panelSoft border border-carto-border">
          {{ scan.scanDoc.scan.serverName }}
        </span>
        <span
          v-if="scan.scanDoc.scan.summary"
          class="px-2 py-1 rounded-md font-medium"
          :class="score()! >= 70 ? 'bg-green-50 text-green-700' : score()! >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'"
        >
          Score {{ score() }}/100
        </span>
      </template>
      <span v-else class="text-carto-faint">No scan loaded</span>
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class="px-3 py-1.5 text-sm rounded-lg bg-grape-500 text-white hover:bg-grape-600"
        @click="conn.openModal()"
      >
        Connect
      </button>
      <button
        v-if="!scan.scanDoc"
        type="button"
        class="px-3 py-1.5 text-sm rounded-lg border border-carto-border hover:bg-carto-panelSoft"
        @click="scan.loadSampleScan()"
      >
        Load sample
      </button>
      <label
        class="px-3 py-1.5 text-sm rounded-lg border border-carto-border hover:bg-carto-panelSoft cursor-pointer"
      >
        Import scan
        <input
          type="file"
          accept=".json,application/json"
          class="hidden"
          @change="(e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (file) file.text().then((t) => scan.importScanJson(t))
          }"
        />
      </label>
      <div v-if="scan.scanDoc" class="relative group">
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-lg bg-blaze-500 text-white hover:bg-blaze-600"
        >
          Export
        </button>
        <div class="hidden group-hover:block absolute right-0 top-full mt-1 bg-carto-panel border border-carto-border rounded-lg shadow-soft py-1 z-50 min-w-[120px]">
          <button
            type="button"
            class="block w-full text-left px-3 py-1.5 text-sm hover:bg-carto-panelSoft"
            @click="scan.downloadReport('md')"
          >
            Markdown
          </button>
          <button
            type="button"
            class="block w-full text-left px-3 py-1.5 text-sm hover:bg-carto-panelSoft"
            @click="scan.downloadReport('json')"
          >
            JSON
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
