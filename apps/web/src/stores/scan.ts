import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
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

export const useScanStore = defineStore('scan', () => {
  const scanDoc = ref<ScanDocument | null>(null)
  const mode = ref<AppMode>('overview')
  const selectedNodeId = ref<string | null>(null)
  const selectedFindingId = ref<string | null>(null)
  const chatOpen = ref(true)
  const importError = ref<string | null>(null)
  const secretWarning = ref<string[]>([])

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

  function applyLiveScan(doc: ScanDocument) {
    scanDoc.value = doc
    selectedNodeId.value = null
    selectedFindingId.value = null
    importError.value = null
    secretWarning.value = []
    mode.value = 'map'
  }

  function loadSampleScan() {
    scanDoc.value = enrichScanDocument(structuredClone(sampleScanDocument))
    selectedNodeId.value = null
    selectedFindingId.value = null
    importError.value = null
    secretWarning.value = []
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
      selectedNodeId.value = null
      selectedFindingId.value = null
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

  return {
    scanDoc,
    mode,
    selectedNodeId,
    selectedFindingId,
    chatOpen,
    importError,
    secretWarning,
    visualGraph,
    selectedNode,
    selectedFinding,
    loadSampleScan,
    applyLiveScan,
    importScanJson,
    clearSelection,
    selectNode,
    selectFinding,
    setMode,
    downloadReport,
  }
})
