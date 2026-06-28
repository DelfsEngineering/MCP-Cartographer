import { defineStore, storeToRefs } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { AppMode, Finding, ScanDocument, VisualGraphNode } from '@mcp-cartographer/shared'
import {
  enrichScanDocument,
  exportJsonReport,
  exportMarkdownReport,
  toVisualGraph,
  validateScanDocument,
  detectSecrets,
  sampleScanDocument,
} from '@mcp-cartographer/scan-core'
import {
  clearScanSession,
  loadScanSession,
  saveScanSession,
} from '@/lib/scan-storage'
import {
  loadRecentScans,
  upsertRecentScan,
  removeRecentScan as removeStoredRecentScan,
  getRecentScan,
  type RecentScanEntry,
} from '@/lib/recent-scans-storage'
import { useChatStore } from './chat'
import { useGraphStore } from './graph'
import { cloneConnectionForm, type ConnectionForm } from '@/lib/api'

let persistTimer: ReturnType<typeof setTimeout> | null = null

export const useScanStore = defineStore('scan', () => {
  const scanDoc = ref<ScanDocument | null>(null)
  const mode = ref<AppMode>('overview')
  const selectedNodeId = ref<string | null>(null)
  const selectedFindingId = ref<string | null>(null)
  const chatOpen = ref(true)
  const importError = ref<string | null>(null)
  const secretWarning = ref<string[]>([])
  const restoredFromStorage = ref(false)
  const persistError = ref<string | null>(null)
  const activeConnectionId = ref<string | null>(null)
  /** Connection used for the current live scan (even if not saved to localStorage). */
  const liveConnectionForm = ref<ConnectionForm | null>(null)
  const recentScans = ref<RecentScanEntry[]>(loadRecentScans())
  const activeScanId = ref<string | null>(null)

  const visualGraph = computed(() =>
    scanDoc.value ? toVisualGraph(scanDoc.value) : null,
  )

  const selectedNode = computed<VisualGraphNode | null>(() => {
    if (!selectedNodeId.value || !visualGraph.value) return null
    return visualGraph.value.nodes.find((n) => n.id === selectedNodeId.value) ?? null
  })

  const selectedFinding = computed<Finding | null>(() => {
    if (!selectedFindingId.value || !scanDoc.value) return null
    return scanDoc.value.findings.find((f) => f.id === selectedFindingId.value) ?? null
  })

  function recordRecent(doc: ScanDocument) {
    recentScans.value = upsertRecentScan(doc)
    activeScanId.value = doc.scan.id
  }

  function openRecentScan(scanId: string) {
    const entry = recentScans.value.find((s) => s.scanId === scanId) ?? getRecentScan(scanId)
    if (!entry) return false

    useChatStore().clear()
    useGraphStore().clearNodePositions()
    scanDoc.value = entry.scanDoc
    activeScanId.value = scanId
    activeConnectionId.value = entry.connectionId ?? null
    selectedNodeId.value = null
    selectedFindingId.value = null
    importError.value = null
    mode.value = 'map'
    return true
  }

  function removeRecentScan(scanId: string) {
    recentScans.value = removeStoredRecentScan(scanId)
    if (activeScanId.value === scanId || scanDoc.value?.scan.id === scanId) {
      scanDoc.value = null
      activeScanId.value = null
      activeConnectionId.value = null
      mode.value = 'overview'
      clearScanSession()
    }
  }

  function schedulePersist() {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistTimer = null
      persistSession()
    }, 250)
  }

  function persistSession() {
    if (!scanDoc.value) {
      clearScanSession()
      persistError.value = null
      return
    }

    const graph = useGraphStore()
    const ok = saveScanSession({
      scanDoc: scanDoc.value,
      ui: {
        mode: mode.value,
        selectedNodeId: selectedNodeId.value,
        selectedFindingId: selectedFindingId.value,
        chatOpen: chatOpen.value,
        activeConnectionId: activeConnectionId.value,
        graph: graph.getUiState(),
      },
    })
    persistError.value = ok ? null : 'Could not save scan to localStorage (storage may be full)'
  }

  function hydrateFromStorage(): boolean {
    const session = loadScanSession()
    if (!session) return false

    const result = validateScanDocument(session.scanDoc)
    if (!result.ok) {
      clearScanSession()
      return false
    }

    scanDoc.value = result.doc
    activeScanId.value = result.doc.scan.id
    recordRecent(result.doc)
    mode.value = session.ui.mode === 'overview' ? 'overview' : session.ui.mode
    selectedNodeId.value = session.ui.selectedNodeId
    selectedFindingId.value = session.ui.selectedFindingId
    chatOpen.value = session.ui.chatOpen
    activeConnectionId.value = session.ui.activeConnectionId
    useGraphStore().applyUiState(session.ui.graph)
    importError.value = null
    secretWarning.value = []
    restoredFromStorage.value = true
    return true
  }

  function applyLiveScan(
    doc: ScanDocument,
    options?: { connectionId?: string | null; connectionForm?: ConnectionForm | null; mode?: AppMode },
  ) {
    useChatStore().clear()
    useGraphStore().clearNodePositions()
    const connectionId = options?.connectionId ?? null
    liveConnectionForm.value = options?.connectionForm?.endpoint?.trim()
      ? cloneConnectionForm(options.connectionForm)
      : null
    scanDoc.value = connectionId
      ? { ...doc, scan: { ...doc.scan, connectionId } }
      : doc
    activeConnectionId.value = connectionId
    selectedNodeId.value = null
    selectedFindingId.value = null
    importError.value = null
    secretWarning.value = []
    mode.value = options?.mode ?? 'map'
    recordRecent(scanDoc.value)
  }

  function loadSampleScan() {
    useChatStore().clear()
    useGraphStore().clearNodePositions()
    const doc = enrichScanDocument(structuredClone(sampleScanDocument))
    scanDoc.value = doc
    activeConnectionId.value = null
    liveConnectionForm.value = null
    selectedNodeId.value = null
    selectedFindingId.value = null
    importError.value = null
    secretWarning.value = []
    recordRecent(doc)
    mode.value = 'map'
  }

  function importScanJson(text: string) {
    importError.value = null
    secretWarning.value = detectSecrets(text)
    try {
      const parsed = JSON.parse(text)
      const result = validateScanDocument(parsed)
      if (!result.ok) {
        importError.value = result.error
        return false
      }
      scanDoc.value = result.doc
      activeConnectionId.value = null
      useGraphStore().clearNodePositions()
      useChatStore().clear()
      selectedNodeId.value = null
      selectedFindingId.value = null
      recordRecent(result.doc)
      mode.value = 'map'
      return true
    } catch {
      importError.value = 'Invalid JSON file'
      return false
    }
  }

  function clearSelection() {
    selectedNodeId.value = null
    selectedFindingId.value = null
  }

  function selectNode(nodeId: string | null) {
    selectedNodeId.value = nodeId
    selectedFindingId.value = null
  }

  function selectFinding(findingId: string) {
    selectedFindingId.value = findingId
    const finding = scanDoc.value?.findings.find((f) => f.id === findingId)
    if (finding?.targetNodeId) {
      selectedNodeId.value = finding.targetNodeId
      mode.value = 'map'
    }
  }

  function setMode(m: AppMode) {
    mode.value = m
  }

  function setChatOpen(open: boolean) {
    chatOpen.value = open
  }

  function clearScan() {
    useChatStore().clear()
    scanDoc.value = null
    activeConnectionId.value = null
    liveConnectionForm.value = null
    activeScanId.value = null
    selectedNodeId.value = null
    selectedFindingId.value = null
    mode.value = 'overview'
    useGraphStore().resetUiState()
    clearScanSession()
    persistError.value = null
  }

  function downloadReport(format: 'md' | 'json') {
    if (!scanDoc.value) return
    const content = format === 'md'
      ? exportMarkdownReport(scanDoc.value)
      : exportJsonReport(scanDoc.value)
    const blob = new Blob([content], {
      type: format === 'md' ? 'text/markdown' : 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mcp-scan-${scanDoc.value.scan.id}.${format === 'md' ? 'md' : 'json'}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const graphStore = useGraphStore()
  const {
    showTools,
    showResources,
    showPrompts,
    showSchemas,
    showFindings,
    showRisks,
    showAiEdges,
    focusMode,
  } = storeToRefs(graphStore)

  function setActiveConnectionId(connectionId: string | null) {
    activeConnectionId.value = connectionId
  }

  watch(
    [
      scanDoc,
      mode,
      selectedNodeId,
      selectedFindingId,
      chatOpen,
      activeConnectionId,
      showTools,
      showResources,
      showPrompts,
      showSchemas,
      showFindings,
      showRisks,
    showAiEdges,
    focusMode,
    () => graphStore.nodePositions,
  ],
    schedulePersist,
    { deep: true },
  )

  return {
    scanDoc,
    mode,
    selectedNodeId,
    selectedFindingId,
    chatOpen,
    importError,
    secretWarning,
    restoredFromStorage,
    persistError,
    activeConnectionId,
    liveConnectionForm,
    activeScanId,
    recentScans,
    visualGraph,
    selectedNode,
    selectedFinding,
    hydrateFromStorage,
    schedulePersist,
    openRecentScan,
    removeRecentScan,
    loadSampleScan,
    applyLiveScan,
    importScanJson,
    clearSelection,
    selectNode,
    selectFinding,
    setMode,
    setChatOpen,
    setActiveConnectionId,
    clearScan,
    downloadReport,
  }
})
