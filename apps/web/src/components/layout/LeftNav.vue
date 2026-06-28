<script setup lang="ts">
import { computed } from 'vue'
import { useScanStore } from '@/stores/scan'
import type { AppMode } from '@mcp-cartographer/shared'

const scan = useScanStore()

const explorerItems: { id: AppMode; label: string; icon: string }[] = [
  { id: 'overview', label: 'Recent', icon: 'fa-clock' },
  { id: 'map', label: 'Map', icon: 'fa-map' },
  { id: 'tools', label: 'Tools', icon: 'fa-wrench' },
  { id: 'resources', label: 'Resources', icon: 'fa-file' },
  { id: 'prompts', label: 'Prompts', icon: 'fa-comment' },
  { id: 'findings', label: 'Findings', icon: 'fa-bookmark' },
  { id: 'raw', label: 'Raw JSON', icon: 'fa-code' },
]

const hasScan = computed(() => Boolean(scan.scanDoc))
const showExplorer = computed(() => hasScan.value && scan.mode !== 'overview')

function onNavClick(mode: AppMode) {
  if (mode !== 'overview' && !hasScan.value) return
  scan.setMode(mode)
}
</script>

<template>
  <nav
    v-if="showExplorer"
    class="w-44 shrink-0 border-r border-carto-border bg-carto-panelSoft flex flex-col py-3 px-2 overflow-y-auto"
  >
    <p class="px-2 py-1 text-xs font-medium uppercase tracking-wide text-carto-faint mb-2">Scan</p>
    <button
      v-for="item in explorerItems"
      :key="item.id"
      type="button"
      class="rounded-lg px-3 py-2 text-sm mb-0.5 text-left w-full text-carto-muted hover:bg-carto-panel flex items-center gap-2"
      :class="scan.mode === item.id ? 'bg-grape-50 text-grape-700 border border-grape-100' : ''"
      @click="onNavClick(item.id)"
    >
      <i class="fa-slab fa-solid w-4 text-center text-sky-600" :class="item.icon" aria-hidden="true" />
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>
