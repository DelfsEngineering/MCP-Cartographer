<script setup lang="ts">
import { computed } from 'vue'
import type { GraphNodeType } from '@mcp-cartographer/shared'

const props = defineProps<{
  type: GraphNodeType | string
}>()

const iconByType: Record<string, string> = {
  server: 'fa-server',
  tool: 'fa-wrench',
  resource: 'fa-file',
  prompt: 'fa-comment',
  schema: 'fa-table',
  concept: 'fa-lightbulb',
  finding: 'fa-bookmark',
  risk: 'fa-triangle-exclamation',
  probe_result: 'fa-flask',
}

const iconClass = computed(() => iconByType[props.type] ?? 'fa-circle')
</script>

<template>
  <i
    class="fa-slab fa-regular inline-block leading-none"
    :class="iconClass"
    aria-hidden="true"
  />
</template>
