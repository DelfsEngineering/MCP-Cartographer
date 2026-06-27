import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ConnectionForm } from '@/lib/api'
import { fetchDevConnection, runMcpScan, testConnection } from '@/lib/api'
import { useScanStore } from './scan'

const emptyForm = (): ConnectionForm => ({
  name: '',
  endpoint: '',
  headers: [{ key: '', value: '' }],
})

export const useConnectionStore = defineStore('connection', () => {
  const modalOpen = ref(false)
  const form = ref<ConnectionForm>(emptyForm())
  const testing = ref(false)
  const scanning = ref(false)
  const statusMessage = ref<string | null>(null)
  const error = ref<string | null>(null)
  const lastTest = ref<{ toolCount?: number; resourceCount?: number; promptCount?: number } | null>(null)

  function openModal() {
    modalOpen.value = true
    error.value = null
    statusMessage.value = null
  }

  function closeModal() {
    modalOpen.value = false
  }

  function addHeaderRow() {
    form.value.headers.push({ key: '', value: '' })
  }

  function removeHeaderRow(index: number) {
    form.value.headers.splice(index, 1)
    if (form.value.headers.length === 0) {
      form.value.headers.push({ key: '', value: '' })
    }
  }

  async function loadDevDefaults() {
    const dev = await fetchDevConnection()
    if (dev) {
      form.value = dev
      statusMessage.value = 'Loaded dev connection from server .env'
    } else {
      error.value = 'No dev connection configured. Add MCP_DEV_* vars to .env'
    }
  }

  async function test() {
    testing.value = true
    error.value = null
    statusMessage.value = 'Testing connection…'
    lastTest.value = null
    try {
      const result = await testConnection(form.value)
      if (!result.ok) {
        error.value = result.error ?? 'Connection test failed'
        statusMessage.value = null
        return false
      }
      lastTest.value = {
        toolCount: result.toolCount,
        resourceCount: result.resourceCount,
        promptCount: result.promptCount,
      }
      statusMessage.value = `Connected (${result.transportUsed}). Found ${result.toolCount ?? 0} tools, ${result.resourceCount ?? 0} resources, ${result.promptCount ?? 0} prompts.`
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      statusMessage.value = null
      return false
    } finally {
      testing.value = false
    }
  }

  async function scan() {
    const scanStore = useScanStore()
    scanning.value = true
    error.value = null
    statusMessage.value = 'Running scan…'
    try {
      const result = await runMcpScan(form.value)
      if (!result.ok || !result.scan) {
        error.value = result.error ?? 'Scan failed'
        statusMessage.value = null
        return false
      }
      scanStore.applyLiveScan(result.scan)
      statusMessage.value = `Scan complete via ${result.transportUsed}`
      closeModal()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      statusMessage.value = null
      return false
    } finally {
      scanning.value = false
    }
  }

  async function testAndScan() {
    const ok = await test()
    if (ok) await scan()
  }

  return {
    modalOpen,
    form,
    testing,
    scanning,
    statusMessage,
    error,
    lastTest,
    openModal,
    closeModal,
    addHeaderRow,
    removeHeaderRow,
    loadDevDefaults,
    test,
    scan,
    testAndScan,
  }
})
