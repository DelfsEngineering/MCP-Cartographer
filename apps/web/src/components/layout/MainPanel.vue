<script setup lang="ts">
import { useScanStore } from '@/stores/scan'
import OverviewView from '@/views/OverviewView.vue'
import MapView from '@/views/MapView.vue'
import InspectorView from '@/views/InspectorView.vue'
import AuditView from '@/views/AuditView.vue'
import RawJsonView from '@/views/RawJsonView.vue'

const scan = useScanStore()
</script>

<template>
  <div class="flex-1 overflow-hidden min-h-0">
    <OverviewView v-if="scan.mode === 'overview'" />
    <MapView v-else-if="scan.mode === 'map'" />
    <InspectorView v-else-if="['inspector', 'tools', 'resources', 'prompts'].includes(scan.mode)" :tab="scan.mode" />
    <AuditView v-else-if="scan.mode === 'findings'" />
    <RawJsonView v-else-if="scan.mode === 'raw'" />
  </div>
</template>
