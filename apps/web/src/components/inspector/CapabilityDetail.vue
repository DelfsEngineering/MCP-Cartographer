<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useScanStore } from '@/stores/scan'
import { getConnectionFormById } from '@/lib/connection-storage'
import type { ConnectionForm } from '@/lib/api'
import { readMcpResource, getMcpPrompt } from '@/lib/api'
import { resolveCapability } from '@/lib/resolve-capability'
import { formatJson, formatMcpPayload } from '@/lib/format-mcp-content'
import { listToolParameters } from '@/lib/schema-params'
import { getNodeTheme } from '@/lib/nodeTheme'
import MarkdownText from '@/components/common/MarkdownText.vue'
import NodeTypeIcon from '@/components/graph/NodeTypeIcon.vue'

const scan = useScanStore()

const activeTab = ref<'overview' | 'schema' | 'content' | 'raw'>('overview')
const liveContent = ref<string | null>(null)
const liveLoading = ref(false)
const liveError = ref<string | null>(null)

const node = computed(() => scan.selectedNode)
const capability = computed(() =>
  scan.scanDoc && node.value ? resolveCapability(scan.scanDoc, node.value) : null,
)
const nodeTheme = computed(() => (node.value ? getNodeTheme(node.value.type) : null))

const relatedFindings = computed(() => {
  if (!scan.scanDoc || !node.value) return []
  return scan.scanDoc.findings.filter((f) => f.targetNodeId === node.value!.id)
})

const hasLiveConnection = computed(
  () => Boolean(scan.liveConnectionForm?.endpoint?.trim() || scan.activeConnectionId),
)

function resolveConnection(): ConnectionForm | null {
  if (scan.activeConnectionId) {
    const saved = getConnectionFormById(scan.activeConnectionId)
    if (saved?.endpoint?.trim()) return saved
  }
  return scan.liveConnectionForm?.endpoint?.trim() ? scan.liveConnectionForm : null
}

const defaultTab = computed(() => {
  if (!capability.value) return 'overview'
  switch (capability.value.kind) {
    case 'schema':
      return 'schema'
    case 'resource':
    case 'resource_template':
    case 'prompt':
      return 'content'
    default:
      return 'overview'
  }
})

watch(
  () => node.value?.id,
  () => {
    activeTab.value = defaultTab.value
    liveContent.value = null
    liveError.value = null
    liveLoading.value = false
  },
)

async function fetchLiveContent() {
  const conn = resolveConnection()
  if (!conn || !capability.value) {
    liveError.value = 'Connect & scan to read live content from this MCP server'
    return
  }

  liveLoading.value = true
  liveError.value = null
  try {
    if (capability.value.kind === 'resource') {
      const result = await readMcpResource(conn, capability.value.record.uri)
      if (!result.ok) throw new Error(result.error ?? 'Read failed')
      liveContent.value = formatMcpPayload(result.data)
    } else if (capability.value.kind === 'resource_template') {
      liveError.value =
        'Templates need a concrete URI — use a resource instance URI or ask the chat assistant to read one.'
    } else if (capability.value.kind === 'prompt') {
      const result = await getMcpPrompt(conn, capability.value.record.name)
      if (!result.ok) throw new Error(result.error ?? 'Prompt resolve failed')
      liveContent.value = formatMcpPayload(result.data)
    }
  } catch (e) {
    liveError.value = e instanceof Error ? e.message : String(e)
    liveContent.value = null
  } finally {
    liveLoading.value = false
  }
}

const schemaJson = computed(() => {
  if (!capability.value) return ''
  if (capability.value.kind === 'tool') {
    return formatJson({
      inputSchema: capability.value.record.inputSchema,
      outputSchema: capability.value.record.outputSchema,
      annotations: capability.value.record.annotations,
    })
  }
  if (capability.value.kind === 'schema') {
    return formatJson(capability.value.schema)
  }
  if (capability.value.kind === 'prompt') {
    return formatJson(capability.value.record.arguments)
  }
  return ''
})

const toolParameters = computed(() => {
  if (capability.value?.kind !== 'tool') return []
  return listToolParameters(capability.value.record.inputSchema)
})

const capabilityDescription = computed(() => {
  if (!capability.value) return null
  switch (capability.value.kind) {
    case 'tool':
    case 'resource':
    case 'resource_template':
    case 'prompt':
      return capability.value.record.description ?? null
    default:
      return null
  }
})

const overviewMeta = computed(() => {
  if (!capability.value) return []
  const rows: Array<{ label: string; value: string }> = []
  switch (capability.value.kind) {
    case 'tool':
      rows.push({ label: 'Name', value: capability.value.record.name })
      if (toolParameters.value.length) {
        rows.push({ label: 'Parameters', value: String(toolParameters.value.length) })
      }
      if (capability.value.record.riskLevel && capability.value.record.riskLevel !== 'none') {
        rows.push({ label: 'Risk', value: capability.value.record.riskLevel })
      }
      break
    case 'resource':
      rows.push({ label: 'URI', value: capability.value.record.uri })
      if (capability.value.record.mimeType) {
        rows.push({ label: 'MIME', value: capability.value.record.mimeType })
      }
      rows.push({ label: 'Orphaned', value: capability.value.record.isOrphaned ? 'Yes' : 'No' })
      break
    case 'resource_template':
      rows.push({ label: 'URI template', value: capability.value.record.uriTemplate })
      if (capability.value.record.mimeType) {
        rows.push({ label: 'MIME', value: capability.value.record.mimeType })
      }
      break
    case 'prompt':
      rows.push({ label: 'Name', value: capability.value.record.name })
      break
    case 'schema':
      if (capability.value.toolName) {
        rows.push({ label: 'Used by', value: capability.value.toolName })
      }
      break
    case 'server':
      rows.push({ label: 'Server', value: scan.scanDoc?.scan.serverName ?? '—' })
      if (scan.scanDoc?.serverMeta?.instructions) {
        rows.push({ label: 'Instructions', value: `${scan.scanDoc.serverMeta.instructions.length} chars` })
      }
      break
  }
  return rows
})

const rawJson = computed(() => {
  if (!capability.value) return ''
  if (capability.value.kind === 'tool') return formatJson(capability.value.record)
  if (capability.value.kind === 'resource') return formatJson(capability.value.record)
  if (capability.value.kind === 'resource_template') return formatJson(capability.value.record)
  if (capability.value.kind === 'prompt') return formatJson(capability.value.record)
  if (capability.value.kind === 'schema') return formatJson(capability.value.schema)
  return formatJson(node.value?.raw)
})

const showContentTab = computed(
  () =>
    capability.value?.kind === 'resource'
    || capability.value?.kind === 'resource_template'
    || capability.value?.kind === 'prompt'
    || (capability.value?.kind === 'server' && scan.scanDoc?.serverMeta?.instructions),
)

const serverInstructions = computed(() => scan.scanDoc?.serverMeta?.instructions)
</script>

<template>
  <div v-if="!node || !capability" class="text-sm text-carto-muted p-4">
    Select a tool, resource, or prompt to inspect details.
  </div>
  <div v-else class="flex flex-col min-h-0 h-full">
    <div class="px-4 py-3 border-b border-carto-border shrink-0">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span
              v-if="nodeTheme"
              class="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
              :class="[nodeTheme.typeLabel, nodeTheme.container]"
            >
              <span class="inline-flex items-center justify-center w-4 h-4 rounded" :class="nodeTheme.iconWrap">
                <NodeTypeIcon :type="node.type" class="w-2.5 h-2.5" />
              </span>
              {{ nodeTheme.label }}
            </span>
            <span
              v-for="badge in node.badges"
              :key="badge"
              class="text-xs px-1.5 py-0.5 rounded bg-blaze-50 text-blaze-600"
            >{{ badge }}</span>
          </div>
          <h3 class="font-medium mt-1 truncate">{{ node.label }}</h3>
          <MarkdownText
            v-if="node.subtitle"
            :text="node.subtitle"
            class="text-sm text-carto-muted mt-0.5"
          />
        </div>
        <button
          type="button"
          class="text-carto-faint hover:text-carto-muted shrink-0"
          aria-label="Clear selection"
          @click="scan.selectNode(null)"
        >
          <i class="fa-slab fa-regular fa-xmark" aria-hidden="true" />
        </button>
      </div>

      <div class="flex gap-1 mt-3 flex-wrap">
        <button
          type="button"
          class="text-xs px-2 py-1 rounded-md"
          :class="activeTab === 'overview' ? 'bg-grape-50 text-grape-700 border border-grape-100' : 'text-carto-muted hover:bg-carto-panelSoft'"
          @click="activeTab = 'overview'"
        >
          Overview
        </button>
        <button
          v-if="capability.kind === 'tool' || capability.kind === 'schema' || capability.kind === 'prompt'"
          type="button"
          class="text-xs px-2 py-1 rounded-md"
          :class="activeTab === 'schema' ? 'bg-grape-50 text-grape-700 border border-grape-100' : 'text-carto-muted hover:bg-carto-panelSoft'"
          @click="activeTab = 'schema'"
        >
          {{ capability.kind === 'prompt' ? 'Arguments' : 'JSON Schema' }}
        </button>
        <button
          v-if="showContentTab"
          type="button"
          class="text-xs px-2 py-1 rounded-md"
          :class="activeTab === 'content' ? 'bg-grape-50 text-grape-700 border border-grape-100' : 'text-carto-muted hover:bg-carto-panelSoft'"
          @click="activeTab = 'content'"
        >
          Contents
        </button>
        <button
          type="button"
          class="text-xs px-2 py-1 rounded-md"
          :class="activeTab === 'raw' ? 'bg-grape-50 text-grape-700 border border-grape-100' : 'text-carto-muted hover:bg-carto-panelSoft'"
          @click="activeTab = 'raw'"
        >
          Raw
        </button>
      </div>
    </div>

    <div
      class="flex-1 min-h-0"
      :class="activeTab === 'content' ? 'flex flex-col overflow-hidden p-4' : 'overflow-y-auto p-4'"
    >
      <div v-if="activeTab === 'overview'" class="space-y-3">
        <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <template v-for="row in overviewMeta" :key="row.label">
            <dt class="text-carto-faint">{{ row.label }}</dt>
            <dd class="font-mono text-xs break-all">{{ row.value }}</dd>
          </template>
        </dl>
        <MarkdownText v-if="capabilityDescription" :text="capabilityDescription" class="text-sm text-carto-muted" />
        <div v-if="capability.kind === 'tool'" class="space-y-2">
          <p class="text-xs font-medium text-carto-faint uppercase">Parameters</p>
          <div v-if="toolParameters.length" class="rounded-lg border border-carto-border overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-carto-panelSoft text-xs text-carto-faint">
                <tr>
                  <th class="text-left font-medium px-2 py-1.5">Name</th>
                  <th class="text-left font-medium px-2 py-1.5">Type</th>
                  <th class="text-left font-medium px-2 py-1.5">Required</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="param in toolParameters"
                  :key="param.name"
                  class="border-t border-carto-border align-top"
                >
                  <td class="px-2 py-1.5 font-mono text-xs">{{ param.name }}</td>
                  <td class="px-2 py-1.5 font-mono text-xs text-carto-muted">{{ param.type }}</td>
                  <td class="px-2 py-1.5 text-xs text-carto-muted">{{ param.required ? 'Yes' : 'No' }}</td>
                </tr>
              </tbody>
            </table>
            <div
              v-for="param in toolParameters.filter((p) => p.description)"
              :key="`${param.name}-desc`"
              class="px-2 py-1.5 border-t border-carto-border text-xs text-carto-muted"
            >
              <span class="font-mono text-carto-text">{{ param.name }}</span>
              <MarkdownText
                :text="param.description ?? ''"
                class="mt-1 text-xs text-carto-muted"
              />
            </div>
          </div>
          <p v-else class="text-sm text-carto-muted">No input parameters defined.</p>
        </div>
        <div v-if="relatedFindings.length" class="space-y-2">
          <p class="text-xs font-medium text-carto-faint uppercase">Findings</p>
          <button
            v-for="f in relatedFindings"
            :key="f.id"
            type="button"
            class="block w-full text-left text-sm px-2 py-1.5 rounded border border-carto-border hover:bg-carto-panelSoft"
            @click="scan.selectFinding(f.id)"
          >
            <span class="text-xs uppercase text-carto-faint">{{ f.severity }}</span>
            {{ f.title }}
          </button>
        </div>
      </div>

      <div v-else-if="activeTab === 'schema'">
        <pre class="text-xs p-3 bg-carto-panelSoft rounded-lg overflow-auto max-h-[min(60vh,28rem)] font-mono leading-relaxed">{{ schemaJson }}</pre>
      </div>

      <div v-else-if="activeTab === 'content'" class="flex flex-col flex-1 min-h-0 gap-3">
        <MarkdownText
          v-if="capability.kind === 'server' && serverInstructions"
          :text="serverInstructions"
          class="flex-1 min-h-0 text-sm p-3 bg-carto-panelSoft rounded-lg overflow-auto leading-relaxed"
        />
        <template v-else>
          <div class="flex items-center gap-2 flex-wrap shrink-0">
            <button
              v-if="capability.kind === 'resource' || capability.kind === 'prompt'"
              type="button"
              class="text-xs px-3 py-1.5 rounded-lg bg-grape-500 text-white hover:bg-grape-600 disabled:opacity-50"
              :disabled="liveLoading"
              @click="fetchLiveContent"
            >
              <i
                class="fa-slab fa-regular mr-1.5"
                :class="liveLoading ? 'fa-spinner fa-spin' : hasLiveConnection ? 'fa-plug' : 'fa-plug-circle-xmark'"
                aria-hidden="true"
              />
              {{ liveLoading ? 'Loading…' : hasLiveConnection ? 'Read from live MCP' : 'No live connection' }}
            </button>
            <span v-if="!hasLiveConnection" class="text-xs text-carto-faint">
              Connect & scan to fetch resource bodies and resolved prompts
            </span>
          </div>
          <p v-if="liveError" class="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 shrink-0">
            {{ liveError }}
          </p>
          <p
            v-if="!liveContent && capability.kind === 'resource' && capability.record.contentPreview"
            class="text-xs text-carto-faint shrink-0"
          >
            Scan preview (stale):
          </p>
          <MarkdownText
            v-if="liveContent"
            :text="liveContent"
            class="flex-1 min-h-0 text-sm p-3 bg-carto-panelSoft rounded-lg overflow-auto leading-relaxed"
          />
          <MarkdownText
            v-else-if="capability.kind === 'resource' && capability.record.contentPreview"
            :text="capability.record.contentPreview"
            class="flex-1 min-h-0 text-sm p-3 bg-carto-panelSoft rounded-lg overflow-auto leading-relaxed"
          />
          <p
            v-else-if="capability.kind !== 'resource_template'"
            class="text-sm text-carto-muted shrink-0"
          >
            Click “Read from live MCP” to load the full contents.
          </p>
        </template>
      </div>

      <div v-else-if="activeTab === 'raw'">
        <pre class="text-xs p-3 bg-carto-panelSoft rounded-lg overflow-auto max-h-[min(60vh,28rem)] font-mono leading-relaxed">{{ rawJson }}</pre>
      </div>
    </div>
  </div>
</template>
