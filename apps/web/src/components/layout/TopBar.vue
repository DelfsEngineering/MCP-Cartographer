<script setup lang="ts">
import { useScanStore } from '@/stores/scan'
import { useConnectionStore } from '@/stores/connection'
import { useSettingsStore } from '@/stores/settings'

const scan = useScanStore()
const conn = useConnectionStore()
const settings = useSettingsStore()

const score = () => scan.scanDoc?.scan.summary?.score

const canRetestCurrent = () => {
  const id = scan.activeConnectionId ?? scan.scanDoc?.scan.connectionId
  if (!id) return false
  return conn.savedConnections.some((c) => c.id === id)
}

const retestConnectionId = () =>
  scan.activeConnectionId ?? scan.scanDoc?.scan.connectionId ?? null

async function retestCurrent() {
  const id = retestConnectionId()
  if (!id || conn.scanning) return
  await conn.scanConnection(id)
}
</script>

<template>
  <header class="h-14 border-b border-carto-border bg-carto-panel px-4 flex items-center gap-3 shrink-0">
    <div class="flex items-center gap-2 mr-4">
      <div class="w-8 h-8 rounded-lg bg-grape-500 flex items-center justify-center text-white text-sm">
        <i class="fa-slab fa-regular fa-map" aria-hidden="true" />
      </div>
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
        v-if="scan.scanDoc && scan.mode !== 'overview'"
        type="button"
        class="px-3 py-1.5 text-sm rounded-lg border border-carto-border hover:bg-carto-panelSoft inline-flex items-center gap-1.5"
        @click="scan.setMode('overview')"
      >
        <i class="fa-slab fa-regular fa-arrow-left" aria-hidden="true" />
        <span>Recent</span>
      </button>
      <button
        type="button"
        class="px-3 py-1.5 text-sm rounded-lg border border-carto-border hover:bg-carto-panelSoft text-carto-muted inline-flex items-center gap-1.5"
        title="Settings"
        @click="settings.openModal()"
      >
        <i class="fa-slab fa-regular fa-gear" aria-hidden="true" />
        <span>Settings</span>
      </button>
      <button
        v-if="scan.scanDoc && canRetestCurrent()"
        type="button"
        class="px-3 py-1.5 text-sm rounded-lg border border-carto-border hover:bg-carto-panelSoft disabled:opacity-50 inline-flex items-center gap-1.5"
        :disabled="conn.scanning"
        @click="retestCurrent()"
      >
        <i class="fa-slab fa-regular" :class="conn.scanning ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'" aria-hidden="true" />
        <span>{{ conn.scanning ? 'Scanning…' : 'Retest' }}</span>
      </button>
      <button
        type="button"
        class="px-3 py-1.5 text-sm rounded-lg bg-grape-500 text-white hover:bg-grape-600 inline-flex items-center gap-1.5"
        @click="conn.openModalForNew()"
      >
        <i class="fa-slab fa-regular fa-plus" aria-hidden="true" />
        <span>New scan</span>
      </button>
      <div v-if="scan.scanDoc" class="relative group">
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-lg bg-blaze-500 text-white hover:bg-blaze-600 inline-flex items-center gap-1.5"
        >
          <i class="fa-slab fa-regular fa-arrow-up-from-bracket" aria-hidden="true" />
          <span>Export</span>
        </button>
        <div class="hidden group-hover:block absolute right-0 top-full mt-1 bg-carto-panel border border-carto-border rounded-lg shadow-soft py-1 z-50 min-w-[120px]">
          <button
            type="button"
            class="block w-full text-left px-3 py-1.5 text-sm hover:bg-carto-panelSoft"
            @click="scan.downloadReport('md')"
          >
            <i class="fa-slab fa-regular fa-file mr-1.5" aria-hidden="true" />
            Markdown
          </button>
          <button
            type="button"
            class="block w-full text-left px-3 py-1.5 text-sm hover:bg-carto-panelSoft"
            @click="scan.downloadReport('json')"
          >
            <i class="fa-slab fa-regular fa-code mr-1.5" aria-hidden="true" />
            JSON
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
