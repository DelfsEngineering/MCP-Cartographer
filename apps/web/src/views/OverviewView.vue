<script setup lang="ts">
import { computed } from 'vue'
import { useScanStore } from '@/stores/scan'
import { useConnectionStore } from '@/stores/connection'
import type { RecentScanEntry } from '@/lib/recent-scans-storage'
import type { StoredConnection } from '@/lib/connection-storage'

const scan = useScanStore()
const conn = useConnectionStore()

type OverviewRow =
  | { kind: 'scan'; entry: RecentScanEntry }
  | { kind: 'connection'; connection: StoredConnection }

const overviewRows = computed<OverviewRow[]>(() => {
  const scannedConnectionIds = new Set(
    scan.recentScans
      .map((entry) => entry.connectionId)
      .filter((id): id is string => Boolean(id)),
  )

  const savedOnly = conn.savedConnections
    .filter((connection) => !scannedConnectionIds.has(connection.id))
    .map((connection): OverviewRow => ({ kind: 'connection', connection }))

  const scans = scan.recentScans.map((entry): OverviewRow => ({ kind: 'scan', entry }))

  return [...savedOnly, ...scans]
})

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

function isActiveScan(scanId: string) {
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

async function scanSaved(connectionId: string, event: Event) {
  event.stopPropagation()
  if (conn.scanning) return
  await conn.scanConnection(connectionId)
}

function removeRecent(scanId: string, event: Event) {
  event.stopPropagation()
  if (!window.confirm('Remove this scan from recents?')) return
  scan.removeRecentScan(scanId)
}

function removeSaved(connectionId: string, event: Event) {
  event.stopPropagation()
  if (!window.confirm('Remove this saved connection?')) return
  conn.deleteConnection(connectionId)
}
</script>

<template>
  <div class="h-full overflow-y-auto p-6">
    <div class="max-w-4xl mx-auto">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 class="text-lg font-semibold">Recent</h1>
          <p class="text-sm text-carto-muted">Saved connections and scan results. Click a scan to open it, or <strong>Scan</strong> a saved connection.</p>
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
        v-if="overviewRows.length === 0"
        class="border border-dashed border-carto-border rounded-lg p-8 text-center text-carto-muted text-sm"
      >
        No connections yet. Run <strong>New scan</strong> or import a JSON file.
      </div>

      <table v-else class="w-full text-sm border border-carto-border rounded-lg overflow-hidden">
        <thead class="bg-carto-panelSoft text-left text-carto-faint">
          <tr>
            <th class="px-3 py-2 font-medium">Server</th>
            <th class="px-3 py-2 font-medium">When</th>
            <th class="px-3 py-2 font-medium w-16">Score</th>
            <th class="px-3 py-2 font-medium w-16">Tools</th>
            <th class="px-3 py-2 font-medium w-20">Findings</th>
            <th class="px-3 py-2 font-medium w-20">Action</th>
            <th class="px-3 py-2 w-10" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in overviewRows"
            :key="row.kind === 'scan' ? row.entry.scanId : row.connection.id"
            class="border-t border-carto-border"
            :class="[
              row.kind === 'scan' ? 'cursor-pointer hover:bg-carto-panelSoft' : 'bg-carto-panel',
              row.kind === 'scan' && isActiveScan(row.entry.scanId) ? 'bg-grape-50' : row.kind === 'scan' ? 'bg-carto-panel' : '',
            ]"
            @click="row.kind === 'scan' ? openRecent(row.entry.scanId) : undefined"
          >
            <template v-if="row.kind === 'scan'">
              <td class="px-3 py-2.5 font-medium">{{ row.entry.serverName }}</td>
              <td class="px-3 py-2.5 text-carto-muted">{{ formatWhen(row.entry.scannedAt) }}</td>
              <td class="px-3 py-2.5">{{ row.entry.score ?? '—' }}</td>
              <td class="px-3 py-2.5">{{ row.entry.toolCount ?? 0 }}</td>
              <td class="px-3 py-2.5">{{ row.entry.findingCount ?? 0 }}</td>
              <td class="px-3 py-2.5">
                <button
                  v-if="canRetest(row.entry.connectionId)"
                  type="button"
                  class="text-xs px-2 py-0.5 rounded border border-carto-border hover:bg-carto-panelSoft disabled:opacity-50"
                  :disabled="conn.scanning"
                  @click="retest(row.entry.connectionId!, $event)"
                >
                  <i
                    class="fa-slab fa-regular"
                    :class="conn.scanningConnectionId === row.entry.connectionId ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'"
                    aria-hidden="true"
                  />
                  <span class="sr-only">{{ conn.scanningConnectionId === row.entry.connectionId ? 'Scanning' : 'Retest' }}</span>
                  <span v-if="conn.scanningConnectionId !== row.entry.connectionId">Retest</span>
                </button>
                <span v-else class="text-carto-faint text-xs">—</span>
              </td>
              <td class="px-3 py-2.5 text-right">
                <button
                  type="button"
                  class="text-carto-faint hover:text-blaze-600 px-1"
                  title="Remove"
                  aria-label="Remove recent scan"
                  @click="removeRecent(row.entry.scanId, $event)"
                >
                  <i class="fa-slab fa-regular fa-trash" aria-hidden="true" />
                </button>
              </td>
            </template>
            <template v-else>
              <td class="px-3 py-2.5 font-medium">
                {{ row.connection.name }}
                <span class="ml-2 text-xs font-normal text-carto-faint">Saved</span>
              </td>
              <td class="px-3 py-2.5 text-carto-muted">{{ formatWhen(row.connection.updatedAt) }}</td>
              <td class="px-3 py-2.5 text-carto-faint">—</td>
              <td class="px-3 py-2.5 text-carto-faint">—</td>
              <td class="px-3 py-2.5 text-carto-faint">—</td>
              <td class="px-3 py-2.5">
                <button
                  type="button"
                  class="text-xs px-2 py-0.5 rounded border border-carto-border bg-grape-50 text-grape-700 hover:bg-grape-100 disabled:opacity-50"
                  :disabled="conn.scanning"
                  @click="scanSaved(row.connection.id, $event)"
                >
                  <i
                    class="fa-slab fa-regular"
                    :class="conn.scanningConnectionId === row.connection.id ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'"
                    aria-hidden="true"
                  />
                  <span v-if="conn.scanningConnectionId !== row.connection.id">Scan</span>
                  <span v-else>Scanning…</span>
                </button>
              </td>
              <td class="px-3 py-2.5 text-right">
                <button
                  type="button"
                  class="text-carto-faint hover:text-blaze-600 px-1"
                  title="Remove"
                  aria-label="Remove saved connection"
                  @click="removeSaved(row.connection.id, $event)"
                >
                  <i class="fa-slab fa-regular fa-trash" aria-hidden="true" />
                </button>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
