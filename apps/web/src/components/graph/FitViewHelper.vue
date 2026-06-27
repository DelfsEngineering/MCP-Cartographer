<script setup lang="ts">
import { watch, onMounted } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useScanStore } from '@/stores/scan'

const scan = useScanStore()
const { fitView } = useVueFlow()

function doFit() {
  setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 80)
}

// Only auto-fit when a new scan is loaded — never on node click or filter tweaks.
watch(() => scan.scanDoc?.scan.id, doFit)
onMounted(doFit)

defineExpose({ doFit })
</script>

<template>
  <span class="hidden" aria-hidden="true" />
</template>
