<script setup lang="ts">
import { useScanStore } from '@/stores/scan'
import MapCanvas from '@/components/graph/MapCanvas.vue'

const scan = useScanStore()
</script>

<template>
  <div class="h-full">
    <div v-if="!scan.scanDoc" class="h-full flex items-center justify-center text-carto-muted">
      <p>Load a scan to view the map.</p>
    </div>
    <MapCanvas v-else />
  </div>
</template>
