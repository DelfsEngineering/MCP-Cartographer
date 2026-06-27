<script setup lang="ts">
import { watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'

const conn = useConnectionStore()

watch(
  () => conn.modalOpen,
  async (open) => {
    if (open) {
      await conn.loadDevDefaults()
    }
  },
)
</script>

<template>
  <div
    v-if="conn.modalOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
    @click.self="conn.closeModal()"
  >
    <div class="w-full max-w-lg rounded-xl2 bg-carto-panel border border-carto-border shadow-soft max-h-[90vh] overflow-y-auto">
      <div class="px-5 py-4 border-b border-carto-border flex items-center justify-between">
        <h2 class="font-semibold">Connect to MCP server</h2>
        <button type="button" class="text-carto-faint hover:text-carto-muted text-xl leading-none" @click="conn.closeModal()">×</button>
      </div>

      <div class="p-5 space-y-4">
        <p class="text-sm text-carto-muted">
          Credentials are sent to your local API proxy only and are not saved to browser storage.
        </p>

        <div>
          <label class="block text-xs font-medium text-carto-muted mb-1">Connection name</label>
          <input
            v-model="conn.form.name"
            type="text"
            class="w-full px-3 py-2 text-sm rounded-lg border border-carto-border bg-white"
            placeholder="My MCP Server"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-carto-muted mb-1">Endpoint URL</label>
          <input
            v-model="conn.form.endpoint"
            type="url"
            class="w-full px-3 py-2 text-sm rounded-lg border border-carto-border bg-white font-mono text-xs"
            placeholder="https://example.com/mcp"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-medium text-carto-muted">Headers (ephemeral)</label>
            <button type="button" class="text-xs text-grape-600 hover:underline" @click="conn.addHeaderRow()">+ Add header</button>
          </div>
          <div class="space-y-2">
            <div
              v-for="(row, i) in conn.form.headers"
              :key="i"
              class="flex gap-2"
            >
              <input
                v-model="row.key"
                type="text"
                class="flex-1 px-2 py-1.5 text-xs rounded border border-carto-border font-mono"
                placeholder="Header name"
              />
              <input
                v-model="row.value"
                type="password"
                class="flex-[2] px-2 py-1.5 text-xs rounded border border-carto-border font-mono"
                placeholder="Value"
                autocomplete="off"
              />
              <button
                type="button"
                class="text-carto-faint hover:text-blaze-500 px-1"
                @click="conn.removeHeaderRow(i)"
              >×</button>
            </div>
          </div>
        </div>

        <button
          type="button"
          class="text-xs text-grape-600 hover:underline"
          @click="conn.loadDevDefaults()"
        >
          Load dev connection from .env
        </button>

        <div
          v-if="conn.statusMessage"
          class="text-sm px-3 py-2 rounded-lg bg-grape-50 text-grape-700 border border-grape-100"
        >
          {{ conn.statusMessage }}
        </div>
        <div
          v-if="conn.error"
          class="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-100"
        >
          {{ conn.error }}
        </div>
      </div>

      <div class="px-5 py-4 border-t border-carto-border flex gap-2 justify-end">
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-lg border border-carto-border hover:bg-carto-panelSoft"
          :disabled="conn.testing || conn.scanning"
          @click="conn.test()"
        >
          {{ conn.testing ? 'Testing…' : 'Test' }}
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-lg bg-blaze-500 text-white hover:bg-blaze-600 disabled:opacity-50"
          :disabled="conn.testing || conn.scanning"
          @click="conn.testAndScan()"
        >
          {{ conn.scanning ? 'Scanning…' : 'Connect & Scan' }}
        </button>
      </div>
    </div>
  </div>
</template>
