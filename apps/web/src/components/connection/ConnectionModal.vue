<script setup lang="ts">
import { ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'

const conn = useConnectionStore()
const newTenantName = ref('')
const showNewTenant = ref(false)
const showSavedPicker = ref(false)
const pasteText = ref('')

watch(
  () => conn.modalOpen,
  (open) => {
    if (open) {
      showSavedPicker.value = conn.modalMode === 'saved'
    }
  },
)

function submitNewTenant() {
  const name = newTenantName.value.trim()
  if (!name) return
  conn.addTenant(name)
  newTenantName.value = ''
  showNewTenant.value = false
}

function onConnectionSelect(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  conn.selectSavedConnection(value)
}

function onParsePaste() {
  conn.pasteFromText(pasteText.value)
}
</script>

<template>
  <div
    v-if="conn.modalOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
    @click.self="conn.closeModal()"
  >
    <div class="w-full max-w-lg rounded-xl2 bg-carto-panel border border-carto-border shadow-soft max-h-[90vh] overflow-y-auto">
      <div class="px-5 py-4 border-b border-carto-border flex items-center justify-between">
        <h2 class="font-semibold inline-flex items-center gap-2">
          <i class="fa-slab fa-regular fa-plug text-carto-muted" aria-hidden="true" />
          <span>Connect to MCP server</span>
        </h2>
        <button
          type="button"
          class="text-carto-faint hover:text-carto-muted"
          aria-label="Close connection dialog"
          @click="conn.closeModal()"
        >
          <i class="fa-slab fa-regular fa-xmark" aria-hidden="true" />
        </button>
      </div>

      <div class="p-5 space-y-4">
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
            class="w-full px-3 py-2 rounded-lg border border-carto-border bg-white font-mono text-xs"
            placeholder="https://example.com/mcp"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-medium text-carto-muted">Headers</label>
            <button type="button" class="text-xs text-grape-600 hover:underline" @click="conn.addHeaderRow()">
              <i class="fa-slab fa-regular fa-plus mr-1.5" aria-hidden="true" />
              Add header
            </button>
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
                aria-label="Remove header"
                @click="conn.removeHeaderRow(i)"
              >
                <i class="fa-slab fa-regular fa-xmark" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <details class="rounded-lg border border-carto-border bg-carto-panelSoft/50">
          <summary class="px-3 py-2 text-xs font-medium text-carto-muted cursor-pointer select-none">
            Import from Cursor / Claude config
          </summary>
          <div class="px-3 pb-3 space-y-2 border-t border-carto-border pt-2">
            <p class="text-xs text-carto-faint">
              Paste your <code class="font-mono">mcpServers</code> JSON below — name, URL, and headers fill in automatically.
            </p>
            <textarea
              v-model="pasteText"
              rows="5"
              class="w-full px-3 py-2 text-xs rounded-lg border border-carto-border font-mono bg-white"
              placeholder='{ "mcpServers": { "My Server": { "url": "https://...", "headers": { ... } } } }'
            />
            <button
              type="button"
              class="px-3 py-1.5 text-xs rounded-lg bg-grape-500 text-white"
              @click="onParsePaste"
            >
              Fill form
            </button>
            <div v-if="conn.pasteCandidates.length > 1" class="space-y-2 pt-1">
              <p class="text-xs text-carto-muted">Multiple servers found — pick one:</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="(candidate, i) in conn.pasteCandidates"
                  :key="i"
                  type="button"
                  class="px-2 py-1 text-xs rounded-lg border border-carto-border bg-white hover:bg-grape-50"
                  @click="conn.applyPastedForm(candidate)"
                >
                  {{ candidate.name }}
                </button>
              </div>
              <button
                type="button"
                class="text-xs text-grape-600 hover:underline"
                @click="conn.saveAllPasteCandidates()"
              >
                Save all {{ conn.pasteCandidates.length }} to this tenant
              </button>
            </div>
          </div>
        </details>

        <div v-if="conn.savedConnections.length > 0 && (showSavedPicker || conn.modalMode === 'saved')">
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs font-medium text-carto-muted">Saved connections</label>
            <button
              v-if="conn.modalMode === 'new'"
              type="button"
              class="text-xs text-grape-600 hover:underline"
              @click="conn.newConnection()"
            >
              Start fresh
            </button>
          </div>
          <select
            class="w-full px-3 py-2 text-sm rounded-lg border border-carto-border bg-white"
            :value="conn.activeConnectionId ?? ''"
            @change="onConnectionSelect"
          >
            <option value="">— Pick a saved connection —</option>
            <option v-for="saved in conn.savedConnections" :key="saved.id" :value="saved.id">
              {{ saved.name }} ({{ saved.endpoint }})
            </option>
          </select>
          <button
            v-if="conn.activeConnectionId"
            type="button"
            class="mt-1 text-xs text-blaze-600 hover:underline"
            @click="conn.removeSavedConnection(conn.activeConnectionId!)"
          >
            Delete selected
          </button>
        </div>
        <button
          v-else-if="conn.savedConnections.length > 0"
          type="button"
          class="text-xs text-grape-600 hover:underline"
          @click="showSavedPicker = true"
        >
          Use a saved connection instead
        </button>

        <details class="text-sm text-carto-muted">
          <summary class="text-xs cursor-pointer select-none text-carto-faint hover:text-carto-muted">
            Advanced
          </summary>
          <div class="mt-3 space-y-3 pl-1">
            <div>
              <label class="block text-xs font-medium text-carto-muted mb-1">Tenant</label>
              <div class="flex gap-2">
                <select
                  :value="conn.activeTenant.id"
                  class="flex-1 px-3 py-2 text-sm rounded-lg border border-carto-border bg-white"
                  @change="conn.selectTenant(($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="t in conn.tenants" :key="t.id" :value="t.id">
                    {{ t.name }}
                  </option>
                </select>
                <button
                  type="button"
                  class="px-3 py-2 text-xs rounded-lg border border-carto-border hover:bg-carto-panelSoft shrink-0"
                  @click="showNewTenant = !showNewTenant"
                >
                  + Tenant
                </button>
              </div>
              <div v-if="showNewTenant" class="flex gap-2 mt-2">
                <input
                  v-model="newTenantName"
                  type="text"
                  class="flex-1 px-3 py-2 text-sm rounded-lg border border-carto-border"
                  placeholder="Tenant name"
                  @keyup.enter="submitNewTenant"
                />
                <button
                  type="button"
                  class="px-3 py-2 text-xs rounded-lg bg-grape-500 text-white"
                  @click="submitNewTenant"
                >
                  Add
                </button>
              </div>
            </div>

            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="conn.saveToLocalStorage" type="checkbox" class="rounded border-carto-border" />
              Save to this browser (localStorage)
            </label>

            <p class="text-xs text-carto-faint">
              Saved connections stay in this browser only. Put real credentials in <code>.env</code>, not in git.
            </p>

            <button
              type="button"
              class="text-xs text-grape-600 hover:underline"
              @click="conn.loadDevDefaults()"
            >
              Load dev connection from .env
            </button>
          </div>
        </details>

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

      <div class="px-5 py-4 border-t border-carto-border flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-lg border border-carto-border hover:bg-carto-panelSoft"
          :disabled="conn.testing || conn.scanning"
          @click="conn.saveConnection()"
        >
          Save
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-lg border border-carto-border hover:bg-carto-panelSoft"
          :disabled="conn.testing || conn.scanning"
          @click="conn.test()"
        >
          <i class="fa-slab fa-regular mr-1.5" :class="conn.testing ? 'fa-spinner fa-spin' : 'fa-flask'" aria-hidden="true" />
          {{ conn.testing ? 'Testing…' : 'Test' }}
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-lg bg-blaze-500 text-white hover:bg-blaze-600 disabled:opacity-50"
          :disabled="conn.testing || conn.scanning"
          @click="conn.testAndScan()"
        >
          <i class="fa-slab fa-regular mr-1.5" :class="conn.scanning ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'" aria-hidden="true" />
          {{ conn.scanning ? 'Scanning…' : 'Connect & Scan' }}
        </button>
      </div>
    </div>
  </div>
</template>
