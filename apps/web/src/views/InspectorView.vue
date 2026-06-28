<script setup lang="ts">
import { computed } from 'vue'
import { useScanStore } from '@/stores/scan'
import type { AppMode } from '@mcp-cartographer/shared'
import { inspectorModeForNode } from '@/lib/resolve-capability'
import CapabilityDetail from '@/components/inspector/CapabilityDetail.vue'

const props = defineProps<{ tab: AppMode }>()

const scan = useScanStore()

const activeTab = computed(() => {
  if (props.tab === 'inspector') return 'tools'
  return props.tab
})

const tools = computed(() => scan.scanDoc?.tools ?? [])
const resources = computed(() => scan.scanDoc?.resources ?? [])
const templates = computed(() => scan.scanDoc?.resourceTemplates ?? [])
const prompts = computed(() => scan.scanDoc?.prompts ?? [])

const showDetail = computed(() => Boolean(scan.selectedNode && scan.selectedNode.type !== 'finding'))

const tabIcons = {
  tools: 'fa-wrench',
  resources: 'fa-file',
  prompts: 'fa-comment',
}

function selectNode(nodeId: string, mode?: 'tools' | 'resources' | 'prompts') {
  scan.selectNode(nodeId)
  if (mode) scan.setMode(mode)
}

function openRow(nodeId: string) {
  const node = scan.visualGraph?.nodes.find((n) => n.id === nodeId)
  const mode = node ? inspectorModeForNode(node) : null
  selectNode(nodeId, mode ?? activeTab.value as 'tools' | 'resources' | 'prompts')
}
</script>

<template>
  <div class="h-full flex min-h-0">
    <div
      class="overflow-y-auto border-r border-carto-border min-h-0 shrink-0"
      :class="showDetail ? 'w-[42%] max-w-md' : 'flex-1'"
    >
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
            <i class="fa-slab fa-regular mr-1.5" :class="tabIcons[t]" aria-hidden="true" />
            {{ t }}
            <span class="text-carto-faint ml-1">
              ({{
                t === 'tools' ? tools.length : t === 'resources' ? resources.length + templates.length : prompts.length
              }})
            </span>
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
              :class="scan.selectedNodeId === `node-tool-${tool.id}` ? 'bg-grape-50/60' : ''"
              @click="openRow(`node-tool-${tool.id}`)"
            >
              <td class="py-2 pr-4 font-mono text-xs">{{ tool.name }}</td>
              <td class="py-2 pr-4 text-carto-muted line-clamp-2">{{ tool.description || '—' }}</td>
              <td class="py-2">
                <span
                  v-if="tool.riskLevel && tool.riskLevel !== 'none'"
                  class="text-xs px-1.5 py-0.5 rounded bg-blaze-50 text-blaze-600"
                >
                  <i class="fa-slab fa-regular fa-triangle-exclamation mr-1" aria-hidden="true" />
                  {{ tool.riskLevel }}
                </span>
                <span v-else class="text-carto-faint">—</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-else-if="activeTab === 'resources'" class="space-y-4">
          <div v-if="templates.length">
            <p class="text-xs font-medium text-carto-faint uppercase mb-2">Templates</p>
            <table class="w-full text-sm">
              <tbody>
                <tr
                  v-for="tpl in templates"
                  :key="tpl.id"
                  class="border-b border-carto-border hover:bg-carto-panelSoft cursor-pointer"
                  :class="scan.selectedNodeId === `node-resource-template-${tpl.id}` ? 'bg-grape-50/60' : ''"
                  @click="openRow(`node-resource-template-${tpl.id}`)"
                >
                  <td class="py-2 pr-4 font-mono text-xs break-all">{{ tpl.uriTemplate }}</td>
                  <td class="py-2 text-carto-muted">{{ tpl.name ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <p class="text-xs font-medium text-carto-faint uppercase mb-2">Resources</p>
            <table class="w-full text-sm">
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
                  :class="scan.selectedNodeId === `node-resource-${res.id}` ? 'bg-grape-50/60' : ''"
                  @click="openRow(`node-resource-${res.id}`)"
                >
                  <td class="py-2 pr-4 font-mono text-xs break-all">{{ res.uri }}</td>
                  <td class="py-2 pr-4">{{ res.name ?? '—' }}</td>
                  <td class="py-2">{{ res.isOrphaned ? 'Yes' : 'No' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

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
              :class="scan.selectedNodeId === `node-prompt-${p.id}` ? 'bg-grape-50/60' : ''"
              @click="openRow(`node-prompt-${p.id}`)"
            >
              <td class="py-2 pr-4 font-mono text-xs">{{ p.name }}</td>
              <td class="py-2 text-carto-muted line-clamp-2">{{ p.description ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showDetail" class="flex-1 min-w-0 min-h-0 bg-carto-panel">
      <CapabilityDetail />
    </div>
    <div
      v-else-if="scan.scanDoc"
      class="hidden lg:flex flex-1 items-center justify-center text-sm text-carto-muted p-8 border-l border-carto-border"
    >
      Select a row to inspect schemas, contents, and raw metadata.
    </div>
  </div>
</template>
