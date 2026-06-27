<script setup lang="ts">
import { useScanStore } from '@/stores/scan'
import { useConnectionStore } from '@/stores/connection'

const scan = useScanStore()
const conn = useConnectionStore()
</script>

<template>
  <div class="h-full overflow-y-auto p-8">
    <div v-if="!scan.scanDoc" class="max-w-lg mx-auto text-center mt-16">
      <h1 class="text-2xl font-semibold mb-3">Start mapping your first MCP server</h1>
      <p class="text-carto-muted mb-6">
        Connect a remote endpoint, inspect a local MCP, or import a scan file.
      </p>
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          class="px-4 py-2 rounded-lg bg-grape-500 text-white hover:bg-grape-600"
          @click="conn.openModal()"
        >
          Connect to MCP
        </button>
        <button
          type="button"
          class="px-4 py-2 rounded-lg border border-carto-border hover:bg-carto-panel"
          @click="scan.loadSampleScan()"
        >
          Load sample scan
        </button>
        <label class="px-4 py-2 rounded-lg border border-carto-border hover:bg-carto-panel cursor-pointer">
          Import scan.json
          <input
            type="file"
            accept=".json"
            class="hidden"
            @change="(e) => {
              const f = (e.target as HTMLInputElement).files?.[0]
              if (f) f.text().then((t) => scan.importScanJson(t))
            }"
          />
        </label>
      </div>
      <p v-if="scan.importError" class="mt-4 text-sm text-severity-high">{{ scan.importError }}</p>
      <p v-if="scan.secretWarning.length" class="mt-2 text-sm text-amber-600">
        Warning: possible secrets detected in import ({{ scan.secretWarning.length }})
      </p>
    </div>

    <div v-else class="max-w-3xl mx-auto">
      <h1 class="text-xl font-semibold mb-1">{{ scan.scanDoc.scan.serverName }}</h1>
      <p class="text-carto-muted text-sm mb-6">Scan {{ scan.scanDoc.scan.id }}</p>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div
          v-for="(val, key) in {
            Tools: scan.scanDoc.scan.summary?.tools,
            Resources: scan.scanDoc.scan.summary?.resources,
            Prompts: scan.scanDoc.scan.summary?.prompts,
            Findings: scan.scanDoc.scan.summary?.findings,
          }"
          :key="key"
          class="rounded-xl border border-carto-border bg-carto-panel p-4 shadow-soft"
        >
          <p class="text-2xl font-semibold">{{ val ?? 0 }}</p>
          <p class="text-sm text-carto-muted">{{ key }}</p>
        </div>
      </div>

      <div
        class="rounded-xl border border-carto-border bg-carto-panel p-6 mb-6"
      >
        <p class="text-sm text-carto-muted mb-1">Overall readiness</p>
        <p class="text-4xl font-bold" :class="(scan.scanDoc.scan.summary?.score ?? 0) >= 60 ? 'text-grape-600' : 'text-blaze-600'">
          {{ scan.scanDoc.scan.summary?.score ?? 0 }}/100
        </p>
      </div>

      <div class="flex gap-3">
        <button
          type="button"
          class="px-4 py-2 rounded-lg bg-grape-500 text-white hover:bg-grape-600 text-sm"
          @click="scan.setMode('map')"
        >
          Open map
        </button>
        <button
          type="button"
          class="px-4 py-2 rounded-lg border border-carto-border hover:bg-carto-panelSoft text-sm"
          @click="scan.setMode('findings')"
        >
          View findings
        </button>
      </div>
    </div>
  </div>
</template>
