<script setup lang="ts">
import { computed } from 'vue'
import { useScanStore } from '@/stores/scan'

const scan = useScanStore()

const grouped = computed(() => {
  const groups: Record<string, typeof scan.scanDoc extends null ? never : NonNullable<typeof scan.scanDoc>['findings']> = {
    high: [],
    medium: [],
    low: [],
    info: [],
  }
  if (!scan.scanDoc) return groups
  for (const f of scan.scanDoc.findings) {
    groups[f.severity].push(f)
  }
  return groups
})

const score = computed(() => scan.scanDoc?.scan.summary?.score ?? 0)

const severityIcons = {
  high: 'fa-triangle-exclamation',
  medium: 'fa-circle-exclamation',
  low: 'fa-circle-check',
  info: 'fa-circle-info',
}

const dimensions = computed(() => {
  const base = score.value
  return [
    { label: 'Discovery', value: Math.min(100, base + 8) },
    { label: 'Descriptions', value: Math.max(0, base - 12) },
    { label: 'Schemas', value: Math.min(100, base + 4) },
    { label: 'Connectedness', value: Math.max(0, base - 18) },
    { label: 'Safety', value: Math.min(100, base + 2) },
    { label: 'Usability', value: Math.max(0, base - 6) },
  ]
})
</script>

<template>
  <div class="h-full overflow-y-auto p-6">
    <div v-if="!scan.scanDoc" class="text-center text-carto-muted mt-12">
      No scan loaded.
    </div>
    <template v-else>
      <div class="max-w-3xl mx-auto">
        <h2 class="text-lg font-semibold mb-4 inline-flex items-center gap-2">
          <i class="fa-slab fa-regular fa-clipboard text-carto-muted" aria-hidden="true" />
          <span>Audit</span>
        </h2>

        <div class="grid grid-cols-2 gap-4 mb-8">
          <div class="rounded-xl border border-carto-border bg-carto-panel p-5 col-span-2 sm:col-span-1">
            <p class="text-sm text-carto-muted inline-flex items-center gap-1.5">
              <i class="fa-slab fa-regular fa-gauge" aria-hidden="true" />
              <span>Overall score</span>
            </p>
            <p class="text-4xl font-bold text-grape-600">{{ score }}/100</p>
          </div>
          <div class="rounded-xl border border-carto-border bg-carto-panel p-5 col-span-2 sm:col-span-1 space-y-2">
            <div v-for="dim in dimensions" :key="dim.label" class="flex items-center gap-2">
              <span class="text-xs text-carto-muted w-28">{{ dim.label }}</span>
              <div class="flex-1 h-2 bg-carto-panelSoft rounded-full overflow-hidden">
                <div class="h-full bg-grape-400 rounded-full" :style="{ width: `${dim.value}%` }" />
              </div>
              <span class="text-xs text-carto-faint w-8">{{ dim.value }}</span>
            </div>
            <p class="text-xs text-carto-faint">Dimension bars use overall score until AI analyzer (Phase 5).</p>
          </div>
        </div>

        <div v-for="sev in ['high', 'medium', 'low', 'info'] as const" :key="sev" class="mb-6">
          <h3 class="text-sm font-medium uppercase tracking-wide text-carto-faint mb-3">{{ sev }}</h3>
          <div v-if="grouped[sev].length === 0" class="text-sm text-carto-faint mb-4">None</div>
          <button
            v-for="f in grouped[sev]"
            :key="f.id"
            type="button"
            class="block w-full text-left rounded-xl border border-carto-border bg-carto-panel p-4 mb-2 hover:shadow-soft transition-shadow"
            @click="scan.selectFinding(f.id)"
          >
            <div class="flex items-center gap-2 mb-1">
              <span
                class="text-xs uppercase px-1.5 py-0.5 rounded"
                :class="{
                  'bg-red-100 text-red-700': sev === 'high',
                  'bg-amber-100 text-amber-700': sev === 'medium',
                  'bg-green-100 text-green-700': sev === 'low',
                  'bg-blue-100 text-blue-700': sev === 'info',
                }"
              >
                <i class="fa-slab fa-regular mr-1" :class="severityIcons[sev]" aria-hidden="true" />
                {{ f.category.replace(/_/g, ' ') }}
              </span>
            </div>
            <p class="font-medium">{{ f.title }}</p>
            <p class="text-sm text-carto-muted mt-1">{{ f.message }}</p>
            <p v-if="f.recommendation" class="text-sm text-grape-700 mt-2">{{ f.recommendation }}</p>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
