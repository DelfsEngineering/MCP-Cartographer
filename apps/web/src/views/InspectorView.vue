<script setup lang="ts">
import { computed } from 'vue'
import { useScanStore } from '@/stores/scan'
import type { AppMode } from '@mcp-cartographer/shared'

const props = defineProps<{ tab: AppMode }>()

const scan = useScanStore()

const activeTab = computed(() => {
  if (props.tab === 'inspector') return 'tools'
  return props.tab
})

const tools = computed(() => scan.scanDoc?.tools ?? [])
const resources = computed(() => scan.scanDoc?.resources ?? [])
const prompts = computed(() => scan.scanDoc?.prompts ?? [])

function openTool(name: string) {
  const tool = tools.value.find((t) => t.name === name)
  if (tool) {
    scan.selectNode(`node-tool-${tool.id}`)
    scan.setMode('map')
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div v-if="!scan.scanDoc" class="p-8 text-center text-carto-muted">
      No scan loaded.
    </div>
    <div v-else class="p-4">
      <div class="flex gap-2 mb-4 border-b border-carto-border pb-2">
        <button
          v-for="t in ['tools', 'resources', 'prompts'] as const"
          :key="t"
          type="button"
          class="px-3 py-1.5 text-sm rounded-lg capitalize"
          :class="activeTab === t ? 'bg-grape-50 text-grape-700 border border-grape-100' : 'text-carto-muted hover:bg-carto-panelSoft'"
          @click="scan.setMode(t)"
        >
          {{ t }}
        </button>
      </div>

      <table v-if="activeTab === 'tools'" class="w-full text-sm">
        <thead>
          <tr class="text-left text-carto-faint border-b border-carto-border">
            <th class="py-2 pr-4">Name</th>
            <th class="py-2 pr-4">Description</th>
            <th class="py-2">Risk</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="tool in tools"
            :key="tool.id"
            class="border-b border-carto-border hover:bg-carto-panelSoft cursor-pointer"
            @click="openTool(tool.name)"
          >
            <td class="py-2 pr-4 font-mono text-xs">{{ tool.name }}</td>
            <td class="py-2 pr-4 text-carto-muted">{{ tool.description || '—' }}</td>
            <td class="py-2">
              <span
                v-if="tool.riskLevel && tool.riskLevel !== 'none'"
                class="text-xs px-1.5 py-0.5 rounded bg-blaze-50 text-blaze-600"
              >{{ tool.riskLevel }}</span>
              <span v-else class="text-carto-faint">—</span>
            </td>
          </tr>
        </tbody>
      </table>

      <table v-else-if="activeTab === 'resources'" class="w-full text-sm">
        <thead>
          <tr class="text-left text-carto-faint border-b border-carto-border">
            <th class="py-2 pr-4">URI</th>
            <th class="py-2 pr-4">Name</th>
            <th class="py-2">Orphan</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="res in resources"
            :key="res.id"
            class="border-b border-carto-border hover:bg-carto-panelSoft cursor-pointer"
            @click="scan.selectNode(`node-resource-${res.id}`); scan.setMode('map')"
          >
            <td class="py-2 pr-4 font-mono text-xs">{{ res.uri }}</td>
            <td class="py-2 pr-4">{{ res.name ?? '—' }}</td>
            <td class="py-2">{{ res.isOrphaned ? 'Yes' : 'No' }}</td>
          </tr>
        </tbody>
      </table>

      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-left text-carto-faint border-b border-carto-border">
            <th class="py-2 pr-4">Name</th>
            <th class="py-2">Description</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in prompts"
            :key="p.id"
            class="border-b border-carto-border hover:bg-carto-panelSoft cursor-pointer"
            @click="scan.selectNode(`node-prompt-${p.id}`); scan.setMode('map')"
          >
            <td class="py-2 pr-4 font-mono text-xs">{{ p.name }}</td>
            <td class="py-2 text-carto-muted">{{ p.description ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
