import type { AppMode, ScanDocument } from '@mcp-cartographer/shared'

const STORAGE_KEY = 'mcp-cartographer:last-scan'
const STORAGE_VERSION = 2

export type NodePosition = { x: number; y: number }

export type GraphUiState = {
  showTools: boolean
  showResources: boolean
  showPrompts: boolean
  showSchemas: boolean
  showFindings: boolean
  showRisks: boolean
  showAiEdges: boolean
  focusMode: boolean
  /** User-dragged node positions for the current map (persisted with session). */
  nodePositions: Record<string, NodePosition>
}

export type ScanSessionUi = {
  mode: AppMode
  selectedNodeId: string | null
  selectedFindingId: string | null
  chatOpen: boolean
  activeConnectionId: string | null
  graph: GraphUiState
}

export type PersistedScanSession = {
  version: number
  savedAt: string
  scanDoc: ScanDocument
  ui: ScanSessionUi
}

export const defaultGraphUiState = (): GraphUiState => ({
  showTools: true,
  showResources: true,
  showPrompts: true,
  showSchemas: true,
  showFindings: true,
  showRisks: true,
  showAiEdges: true,
  focusMode: false,
  nodePositions: {},
})

export const defaultScanSessionUi = (): ScanSessionUi => ({
  mode: 'overview',
  selectedNodeId: null,
  selectedFindingId: null,
  chatOpen: true,
  activeConnectionId: null,
  graph: defaultGraphUiState(),
})

export function loadScanSession(): PersistedScanSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedScanSession & {
      ui?: Partial<ScanSessionUi>
    }
    if (!parsed.scanDoc || !parsed.ui) return null
    if (parsed.version !== 1 && parsed.version !== STORAGE_VERSION) return null

    const ui: ScanSessionUi = {
      ...defaultScanSessionUi(),
      ...parsed.ui,
      graph: {
        ...defaultGraphUiState(),
        ...parsed.ui.graph,
        nodePositions: parsed.ui.graph?.nodePositions ?? {},
      },
      activeConnectionId:
        parsed.ui.activeConnectionId
        ?? parsed.scanDoc.scan.connectionId
        ?? null,
    }

    return {
      version: STORAGE_VERSION,
      savedAt: parsed.savedAt,
      scanDoc: parsed.scanDoc,
      ui,
    }
  } catch {
    return null
  }
}

export function saveScanSession(session: Omit<PersistedScanSession, 'version' | 'savedAt'>): boolean {
  try {
    const payload: PersistedScanSession = {
      version: STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      scanDoc: session.scanDoc,
      ui: session.ui,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function clearScanSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function hasPersistedScanSession(): boolean {
  return loadScanSession() !== null
}
