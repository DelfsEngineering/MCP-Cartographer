<script setup lang="ts">
import { useScanStore } from '@/stores/scan'
import type { AppMode } from '@mcp-cartographer/shared'

const scan = useScanStore()

const items: { id: AppMode; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◎' },
  { id: 'map', label: 'Map', icon: '⊞' },
  { id: 'inspector', label: 'Inspector', icon: '▣' },
  { id: 'tools', label: 'Tools', icon: '⚙' },
  { id: 'resources', label: 'Resources', icon: '📄' },
  { id: 'prompts', label: 'Prompts', icon: '💬' },
  { id: 'findings', label: 'Findings', icon: '⚑' },
  { id: 'raw', label: 'Raw JSON', icon: '{ }' },
]
</script>

<template>
  <nav class="w-60 shrink-0 border-r border-carto-border bg-carto-panelSoft flex flex-col py-3 px-2 overflow-y-auto">
    <p class="px-3 py-1 text-xs font-medium uppercase tracking-wide text-carto-faint mb-2">Explorer</p>
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-carto-muted hover:bg-carto-panel mb-0.5 text-left w-full"
      :class="scan.mode === item.id ? 'bg-grape-50 text-grape-700 border border-grape-100' : ''"
      @click="scan.setMode(item.id)"
    >
      <span class="w-5 text-center opacity-70">{{ item.icon }}</span>
      {{ item.label }}
    </button>
  </nav>
</template>
