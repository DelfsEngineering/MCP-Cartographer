<script setup lang="ts">
import { computed } from 'vue'
import { useScanStore } from '@/stores/scan'
import { useConnectionStore } from '@/stores/connection'

const scan = useScanStore()
const conn = useConnectionStore()

const recents = computed(() => scan.recentScans)

function formatWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isActive(scanId: string) {
  return scan.scanDoc?.scan.id === scanId
}

function openRecent(scanId: string) {
  scan.openRecentScan(scanId)
}

function canRetest(connectionId?: string) {
  if (!connectionId) return false
  return conn.savedConnections.some((c) => c.id === connectionId)
}

async function retest(connectionId: string, event: Event) {
  event.stopPropagation()
  if (conn.scanning) return
  await conn.scanConnection(connectionId)
}

function removeRecent(scanId: string, event: Event) {
  event.stopPropagation()
  if (!window.confirm('Remove this scan from recents?')) return
  scan.removeRecentScan(scanId)
}
</script>

<template>
  <div class="h-full overflow-y-auto p-6">
    <div class="max-w-4xl mx-auto">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 class="text-lg font-semibold">Recent scans</h1>
          <p class="text-sm text-carto-muted">Click a row to open saved results. Use <strong>Retest</strong> to run a fresh scan.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded-lg bg-grape-500 text-white hover:bg-grape-600 inline-flex items-center gap-1.5"
            @click="conn.openModalForNew()"
          >
            <i class="fa-slab fa-regular fa-plus" aria-hidden="true" />
            <span>New scan</span>
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded-lg border border-carto-border hover:bg-carto-panel inline-flex items-center gap-1.5"
            @click="scan.loadSampleScan()"
          >
            <i class="fa-slab fa-regular fa-flask" aria-hidden="true" />
            <span>Sample</span>
          </button>
          <label class="px-3 py-1.5 text-sm rounded-lg border border-carto-border hover:bg-carto-panel cursor-pointer inline-flex items-center gap-1.5">
            <i class="fa-slab fa-regular fa-file" aria-hidden="true" />
            <span>Import JSON</span>
            <input
              type="file"
              accept=".json,application/json"
              class="hidden"
              @change="(e) => {
                const f = (e.target as HTMLInputElement).files?.[0]
                if (f) f.text().then((t) => scan.importScanJson(t))
              }"
            />
          </label>
        </div>
      </div>

      <p v-if="conn.navError" class="mb-4 text-sm text-blaze-600">{{ conn.navError }}</p>
      <p v-if="scan.importError" class="mb-4 text-sm text-severity-high">{{ scan.importError }}</p>
      <p v-if="scan.persistError" class="mb-4 text-sm text-amber-600">{{ scan.persistError }}</p>

      <div
        v-if="recents.length === 0"
        class="border border-dashed border-carto-border rounded-lg p-8 text-center text-carto-muted text-sm"
      >
        No scans yet. Run <strong>New scan</strong> or import a JSON file.
      </div>

      <table v-else class="w-full text-sm border border-carto-border rounded-lg overflow-hidden">
        <thead class="bg-carto-panelSoft text-left text-carto-faint">
          <tr>
            <th class="px-3 py-2 font-medium">Server</th>
            <th class="px-3 py-2 font-medium">When</th>
            <th class="px-3 py-2 font-medium w-16">Score</th>
            <th class="px-3 py-2 font-medium w-16">Tools</th>
            <th class="px-3 py-2 font-medium w-20">Findings</th>
            <th class="px-3 py-2 font-medium w-20">Retest</th>
            <th class="px-3 py-2 w-10" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in recents"
            :key="entry.scanId"
            class="border-t border-carto-border cursor-pointer hover:bg-carto-panelSoft"
            :class="isActive(entry.scanId) ? 'bg-grape-50' : 'bg-carto-panel'"
            @click="openRecent(entry.scanId)"
          >
            <td class="px-3 py-2.5 font-medium">{{ entry.serverName }}</td>
            <td class="px-3 py-2.5 text-carto-muted">{{ formatWhen(entry.scannedAt) }}</td>
            <td class="px-3 py-2.5">{{ entry.score ?? '—' }}</td>
            <td class="px-3 py-2.5">{{ entry.toolCount ?? 0 }}</td>
            <td class="px-3 py-2.5">{{ entry.findingCount ?? 0 }}</td>
            <td class="px-3 py-2.5">
              <button
                v-if="canRetest(entry.connectionId)"
                type="button"
                class="text-xs px-2 py-0.5 rounded border border-carto-border hover:bg-carto-panelSoft disabled:opacity-50"
                :disabled="conn.scanning"
                @click="retest(entry.connectionId!, $event)"
              >
                <i
                  class="fa-slab fa-regular"
                  :class="conn.scanningConnectionId === entry.connectionId ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'"
                  aria-hidden="true"
                />
                <span class="sr-only">{{ conn.scanningConnectionId === entry.connectionId ? 'Scanning' : 'Retest' }}</span>
                <span v-if="conn.scanningConnectionId !== entry.connectionId">Retest</span>
              </button>
              <span v-else class="text-carto-faint text-xs">—</span>
            </td>
            <td class="px-3 py-2.5 text-right">
              <button
                type="button"
                class="text-carto-faint hover:text-blaze-600 px-1"
                title="Remove"
                aria-label="Remove recent scan"
                @click="removeRecent(entry.scanId, $event)"
              >
                <i class="fa-slab fa-regular fa-trash" aria-hidden="true" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
