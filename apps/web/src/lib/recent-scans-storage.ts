import type { ScanDocument } from '@mcp-cartographer/shared'
import { validateScanDocument } from '@mcp-cartographer/scan-core'

const STORAGE_KEY = 'mcp-cartographer:recent-scans'
const STORAGE_VERSION = 1
const MAX_RECENTS = 40

export type RecentScanEntry = {
  scanId: string
  serverName: string
  scannedAt: string
  score?: number
  toolCount?: number
  resourceCount?: number
  promptCount?: number
  findingCount?: number
  connectionId?: string
  scanDoc: ScanDocument
}

type RecentScansStorage = {
  version: number
  scans: RecentScanEntry[]
}

export function entryFromScanDoc(doc: ScanDocument, scannedAt = new Date().toISOString()): RecentScanEntry {
  const summary = doc.scan.summary
  return {
    scanId: doc.scan.id,
    serverName: doc.scan.serverName,
    scannedAt: doc.scan.completedAt ?? doc.scan.startedAt ?? scannedAt,
    score: summary?.score,
    toolCount: summary?.tools ?? doc.tools.length,
    resourceCount: summary?.resources ?? doc.resources.length,
    promptCount: summary?.prompts ?? doc.prompts.length,
    findingCount: summary?.findings ?? doc.findings.length,
    connectionId: doc.scan.connectionId,
    scanDoc: doc,
  }
}

export function loadRecentScans(): RecentScanEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentScansStorage
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.scans)) return []

    const valid: RecentScanEntry[] = []
    for (const entry of parsed.scans) {
      const result = validateScanDocument(entry.scanDoc)
      if (result.ok) {
        valid.push({ ...entry, scanDoc: result.doc })
      }
    }
    return valid
  } catch {
    return []
  }
}

function saveRecentScans(scans: RecentScanEntry[]): boolean {
  try {
    const payload: RecentScansStorage = {
      version: STORAGE_VERSION,
      scans: scans.slice(0, MAX_RECENTS),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function upsertRecentScan(doc: ScanDocument): RecentScanEntry[] {
  const entry = entryFromScanDoc(doc)
  const existing = loadRecentScans().filter((s) => s.scanId !== entry.scanId)
  const next = [entry, ...existing].slice(0, MAX_RECENTS)
  saveRecentScans(next)
  return next
}

export function removeRecentScan(scanId: string): RecentScanEntry[] {
  const next = loadRecentScans().filter((s) => s.scanId !== scanId)
  saveRecentScans(next)
  return next
}

export function getRecentScan(scanId: string): RecentScanEntry | null {
  return loadRecentScans().find((s) => s.scanId === scanId) ?? null
}
