import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { cloneConnectionForm, type ConnectionForm } from '@/lib/api'
import { fetchDevConnection, runMcpScan, testConnection } from '@/lib/api'
import {
  createTenant,
  deleteStoredConnection,
  getActiveTenant,
  getLastConnectionForm,
  listTenants,
  loadConnectionStorage,
  setActiveTenant,
  storedConnectionToForm,
  upsertConnection,
  type ConnectionStorage,
  type StoredConnection,
} from '@/lib/connection-storage'
import { parseMcpConfigText } from '@/lib/parse-mcp-config'
import { useScanStore } from './scan'

const emptyForm = (): ConnectionForm => ({
  name: '',
  endpoint: '',
  headers: [{ key: '', value: '' }],
})

function formIsValid(form: ConnectionForm): boolean {
  return Boolean(form.name.trim() && form.endpoint.trim())
}

export const useConnectionStore = defineStore('connection', () => {
  const modalOpen = ref(false)
  const form = ref<ConnectionForm>(emptyForm())
  const activeConnectionId = ref<string | null>(null)
  const testing = ref(false)
  const scanning = ref(false)
  const scanningConnectionId = ref<string | null>(null)
  const navError = ref<string | null>(null)
  const statusMessage = ref<string | null>(null)
  const error = ref<string | null>(null)
  const lastTest = ref<{ toolCount?: number; resourceCount?: number; promptCount?: number } | null>(null)
  const saveToLocalStorage = ref(true)
  const storage = ref<ConnectionStorage>(loadConnectionStorage())
  const pasteCandidates = ref<ConnectionForm[]>([])
  const pasteSkipped = ref<string[]>([])
  /** 'new' = fresh connection form; 'saved' = browsing/editing stored connections */
  const modalMode = ref<'new' | 'saved'>('new')

  const tenants = computed(() => listTenants(storage.value))
  const activeTenant = computed(() => getActiveTenant(storage.value))
  const savedConnections = computed(() =>
    [...activeTenant.value.connections].sort(
      (a, b) => new Date(b.lastUsedAt ?? b.updatedAt).getTime() - new Date(a.lastUsedAt ?? a.updatedAt).getTime(),
    ),
  )

  function refreshStorage() {
    storage.value = loadConnectionStorage()
  }

  function hydrateFromStorage() {
    refreshStorage()
    const last = getLastConnectionForm(storage.value)
    if (last) {
      const tenant = getActiveTenant(storage.value)
      const id = tenant.lastConnectionId ?? tenant.connections[0]?.id ?? null
      activeConnectionId.value = id
      form.value = last
    } else {
      newConnection()
    }
  }

  function openModal() {
    modalMode.value = 'saved'
    modalOpen.value = true
    error.value = null
    statusMessage.value = null
    hydrateFromStorage()
  }

  function openModalForNew() {
    modalMode.value = 'new'
    modalOpen.value = true
    error.value = null
    statusMessage.value = null
    newConnection()
  }

  function openModalForEdit(connectionId: string) {
    modalMode.value = 'saved'
    modalOpen.value = true
    error.value = null
    statusMessage.value = null
    selectSavedConnection(connectionId)
  }

  function closeModal() {
    modalOpen.value = false
    pasteCandidates.value = []
    pasteSkipped.value = []
  }

  function applyPastedForm(candidate: ConnectionForm) {
    activeConnectionId.value = null
    form.value = cloneConnectionForm(candidate)
    pasteCandidates.value = []
    statusMessage.value = `Loaded “${candidate.name}” from pasted config`
    error.value = null
  }

  function pasteFromText(text: string): boolean {
    const result = parseMcpConfigText(text)
    if (!result.ok) {
      error.value = result.error
      statusMessage.value = null
      return false
    }

    pasteSkipped.value = result.skipped
    if (result.connections.length === 1) {
      applyPastedForm(result.connections[0])
      if (result.skipped.length) {
        statusMessage.value += ` (skipped: ${result.skipped.join(', ')})`
      }
      return true
    }

    pasteCandidates.value = result.connections
    statusMessage.value = `Found ${result.connections.length} servers — pick one to load, or save all`
    error.value = null
    return true
  }

  async function pasteFromClipboard(): Promise<boolean> {
    try {
      const text = await navigator.clipboard.readText()
      return pasteFromText(text)
    } catch {
      error.value = 'Could not read clipboard. Paste into the box below instead.'
      return false
    }
  }

  function saveAllPasteCandidates(): number {
    if (!saveToLocalStorage.value) {
      error.value = 'Enable “Save to localStorage” to store connections'
      return 0
    }
    let saved = 0
    let next = storage.value
    for (const candidate of pasteCandidates.value) {
      if (!formIsValid(candidate)) continue
      const result = upsertConnection(next, candidate, null)
      next = result.storage
      saved += 1
    }
    storage.value = next
    if (saved > 0) {
      applyPastedForm(pasteCandidates.value[0])
      statusMessage.value = `Saved ${saved} connection(s) for tenant “${activeTenant.value.name}”`
      error.value = null
    }
    return saved
  }

  function newConnection() {
    modalMode.value = 'new'
    activeConnectionId.value = null
    form.value = emptyForm()
    error.value = null
    statusMessage.value = null
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

  function selectTenant(tenantId: string) {
    storage.value = setActiveTenant(storage.value, tenantId)
    const last = getLastConnectionForm(storage.value)
    if (last) {
      const tenant = getActiveTenant(storage.value)
      activeConnectionId.value = tenant.lastConnectionId ?? tenant.connections[0]?.id ?? null
      form.value = last
    } else {
      newConnection()
    }
    statusMessage.value = `Switched to tenant “${getActiveTenant(storage.value).name}”`
    error.value = null
  }

  function addTenant(name: string) {
    storage.value = createTenant(storage.value, name)
    newConnection()
    statusMessage.value = `Created tenant “${name.trim()}”`
    error.value = null
  }

  function selectSavedConnection(connectionId: string) {
    if (!connectionId) {
      newConnection()
      return
    }
    const conn = savedConnections.value.find((c) => c.id === connectionId)
    if (!conn) return
    loadSavedConnection(conn)
  }

  function loadSavedConnection(conn: StoredConnection) {
    activeConnectionId.value = conn.id
    form.value = storedConnectionToForm(conn)
    statusMessage.value = `Selected “${conn.name}”`
    error.value = null
  }

  function removeSavedConnection(connectionId: string) {
    storage.value = deleteStoredConnection(storage.value, connectionId)
    if (activeConnectionId.value === connectionId) {
      newConnection()
    }
    statusMessage.value = 'Connection removed from this browser'
    error.value = null
  }

  function deleteConnection(connectionId: string) {
    const scanStore = useScanStore()
    removeSavedConnection(connectionId)
    if (scanStore.activeConnectionId === connectionId) {
      scanStore.clearScan()
    }
    navError.value = null
  }

  function saveConnection(): boolean {
    if (!formIsValid(form.value)) {
      error.value = 'Connection name and endpoint URL are required'
      return false
    }
    saveToLocalStorage.value = true
    const { storage: next, connection } = upsertConnection(
      storage.value,
      form.value,
      activeConnectionId.value,
    )
    storage.value = next
    activeConnectionId.value = connection.id
    statusMessage.value = `Saved “${connection.name}” for tenant “${activeTenant.value.name}”`
    error.value = null
    const scanStore = useScanStore()
    scanStore.setMode('overview')
    closeModal()
    return true
  }

  function persistCurrentConnection() {
    if (!saveToLocalStorage.value || !formIsValid(form.value)) return
    const { storage: next, connection } = upsertConnection(
      storage.value,
      form.value,
      activeConnectionId.value,
    )
    storage.value = next
    activeConnectionId.value = connection.id
  }

  async function loadDevDefaults() {
    const dev = await fetchDevConnection()
    if (dev) {
      activeConnectionId.value = null
      form.value = dev
      statusMessage.value = 'Loaded dev connection from server .env (not saved until you Save or scan)'
      error.value = null
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

  async function scan(options?: { closeModal?: boolean; mode?: import('@mcp-cartographer/shared').AppMode }) {
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
      persistCurrentConnection()
      scanStore.applyLiveScan(result.scan, {
        connectionId: activeConnectionId.value,
        connectionForm: form.value,
        mode: options?.mode ?? 'map',
      })
      statusMessage.value = `Scan complete via ${result.transportUsed}`
      if (options?.closeModal !== false) {
        closeModal()
      }
      navError.value = null
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      statusMessage.value = null
      return false
    } finally {
      scanning.value = false
      scanningConnectionId.value = null
    }
  }

  async function scanConnection(connectionId: string) {
    const conn = savedConnections.value.find((c) => c.id === connectionId)
    if (!conn) return false

    loadSavedConnection(conn)
    scanningConnectionId.value = connectionId
    navError.value = null
    activeConnectionId.value = connectionId

    const ok = await scan({ closeModal: false, mode: 'map' })
    if (!ok) {
      navError.value = error.value ?? 'Scan failed'
    }
    return ok
  }

  async function testAndScan() {
    const ok = await test()
    if (ok) await scan({ closeModal: true })
  }

  hydrateFromStorage()

  return {
    modalOpen,
    form,
    activeConnectionId,
    testing,
    scanning,
    scanningConnectionId,
    navError,
    statusMessage,
    error,
    lastTest,
    saveToLocalStorage,
    tenants,
    activeTenant,
    savedConnections,
    pasteCandidates,
    pasteSkipped,
    modalMode,
    openModal,
    openModalForNew,
    openModalForEdit,
    closeModal,
    newConnection,
    addHeaderRow,
    removeHeaderRow,
    selectTenant,
    addTenant,
    selectSavedConnection,
    loadSavedConnection,
    removeSavedConnection,
    deleteConnection,
    saveConnection,
    pasteFromText,
    pasteFromClipboard,
    applyPastedForm,
    saveAllPasteCandidates,
    loadDevDefaults,
    test,
    scan,
    scanConnection,
    testAndScan,
  }
})
