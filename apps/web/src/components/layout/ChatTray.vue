<script setup lang="ts">
import { useScanStore } from '@/stores/scan'

const scan = useScanStore()
</script>

<template>
  <aside
    v-if="scan.chatOpen"
    class="w-[360px] shrink-0 border-l border-carto-border bg-carto-panel flex flex-col"
  >
    <div class="h-12 px-4 flex items-center justify-between border-b border-carto-border">
      <h2 class="font-medium text-sm">Ask the map</h2>
      <button
        type="button"
        class="text-carto-faint hover:text-carto-muted text-lg leading-none"
        aria-label="Collapse chat"
        @click="scan.chatOpen = false"
      >
        ×
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-3">
      <div
        v-if="!scan.scanDoc"
        class="text-sm text-carto-muted"
      >
        Load or import a scan to ask questions about your MCP server map.
      </div>
      <template v-else>
        <div class="text-xs px-2 py-1 rounded-md bg-grape-50 text-grape-700 border border-grape-100 inline-block">
          {{ scan.scanDoc.scan.serverName }}
          <span v-if="scan.selectedNode"> · {{ scan.selectedNode.label }}</span>
        </div>
        <p class="text-sm text-carto-muted">
          AI chat arrives in Phase 5 (OpenAI Responses API). For now, use the map, inspector, and audit views.
        </p>
        <div class="space-y-2">
          <p class="text-xs font-medium text-carto-faint uppercase">Suggested questions</p>
          <button
            v-for="q in ['Why is create_invoice scored weak?', 'Show orphaned resources', 'Which tools can write data?']"
            :key="q"
            type="button"
            class="block w-full text-left text-sm px-3 py-2 rounded-lg border border-carto-border hover:bg-carto-panelSoft text-carto-muted"
            disabled
          >
            {{ q }}
          </button>
        </div>
      </template>
    </div>

    <div class="p-3 border-t border-carto-border">
      <input
        type="text"
        disabled
        placeholder="Chat coming in Phase 5…"
        class="w-full px-3 py-2 text-sm rounded-lg border border-carto-border bg-carto-panelSoft text-carto-faint"
      />
    </div>
  </aside>
  <button
    v-else
    type="button"
    class="w-10 shrink-0 border-l border-carto-border bg-carto-panel hover:bg-carto-panelSoft text-carto-muted text-xs writing-mode-vertical"
    style="writing-mode: vertical-rl"
    @click="scan.chatOpen = true"
  >
    Chat
  </button>
</template>
