<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useScanStore } from '@/stores/scan'
import CapabilityDetail from '@/components/inspector/CapabilityDetail.vue'

const STORAGE_KEY = 'carto-detail-drawer-height'
const MIN_HEIGHT = 120
const MAX_HEIGHT_RATIO = 0.85
const DEFAULT_HEIGHT = () => Math.min(Math.floor(window.innerHeight * 0.5), 384)

const scan = useScanStore()

const finding = computed(() => scan.selectedFinding)
const showCapability = computed(
  () => scan.selectedNode && !finding.value && scan.selectedNode.type !== 'finding',
)

function loadHeight(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const n = Number(raw)
      if (!Number.isNaN(n)) return clampHeight(n)
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_HEIGHT()
}

function clampHeight(height: number): number {
  const max = Math.floor(window.innerHeight * MAX_HEIGHT_RATIO)
  return Math.min(max, Math.max(MIN_HEIGHT, Math.round(height)))
}

const panelHeight = ref(DEFAULT_HEIGHT())

function persistHeight() {
  try {
    localStorage.setItem(STORAGE_KEY, String(panelHeight.value))
  } catch {
    // ignore storage errors
  }
}

function onWindowResize() {
  panelHeight.value = clampHeight(panelHeight.value)
}

onMounted(() => {
  panelHeight.value = loadHeight()
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
})

let resizeStartY = 0
let resizeStartHeight = 0

function onResizeStart(event: MouseEvent) {
  event.preventDefault()
  resizeStartY = event.clientY
  resizeStartHeight = panelHeight.value

  const onMove = (moveEvent: MouseEvent) => {
    const delta = resizeStartY - moveEvent.clientY
    panelHeight.value = clampHeight(resizeStartHeight + delta)
  }

  const onEnd = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onEnd)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    persistHeight()
  }

  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onEnd)
}
</script>

<template>
  <div
    v-if="finding || showCapability"
    class="shrink-0 flex flex-col bg-carto-panel border-t border-carto-border"
    :style="{ height: `${panelHeight}px` }"
  >
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize inspector"
      class="h-2.5 shrink-0 cursor-ns-resize flex items-center justify-center touch-none group hover:bg-carto-panelSoft active:bg-carto-panelSoft"
      @mousedown="onResizeStart"
    >
      <div class="flex flex-col gap-0.5 items-center pointer-events-none" aria-hidden="true">
        <span class="block w-10 h-0.5 rounded-full bg-carto-border group-hover:bg-carto-muted transition-colors" />
        <span class="block w-10 h-0.5 rounded-full bg-carto-border group-hover:bg-carto-muted transition-colors" />
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-hidden">
      <div v-if="finding" class="h-full px-4 py-3 overflow-y-auto">
        <div class="flex items-start justify-between gap-2">
          <div>
            <span
              class="text-xs font-medium uppercase px-1.5 py-0.5 rounded"
              :class="{
                'bg-red-100 text-red-700': finding.severity === 'high',
                'bg-amber-100 text-amber-700': finding.severity === 'medium',
                'bg-green-100 text-green-700': finding.severity === 'low',
                'bg-blue-100 text-blue-700': finding.severity === 'info',
              }"
            >{{ finding.severity }}</span>
            <h3 class="font-medium mt-1">{{ finding.title }}</h3>
            <p class="text-sm text-carto-muted mt-1">{{ finding.message }}</p>
            <p v-if="finding.recommendation" class="text-sm text-grape-700 mt-2">
              {{ finding.recommendation }}
            </p>
          </div>
          <button
            type="button"
            class="text-carto-faint hover:text-carto-muted"
            aria-label="Close finding detail"
            @click="scan.clearSelection()"
          >
            <i class="fa-slab fa-regular fa-xmark" aria-hidden="true" />
          </button>
        </div>
      </div>
      <CapabilityDetail v-else />
    </div>
  </div>
</template>
