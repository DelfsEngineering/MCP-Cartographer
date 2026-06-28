import type { ConnectionForm } from '@/lib/api'

const STORAGE_KEY = 'mcp-cartographer:connections'
const STORAGE_VERSION = 1

export type StoredConnection = {
  id: string
  name: string
  endpoint: string
  headers: Record<string, string>
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
}

export type TenantRecord = {
  id: string
  name: string
  connections: StoredConnection[]
  lastConnectionId?: string
}

export type ConnectionStorage = {
  version: number
  activeTenantId: string
  tenants: Record<string, TenantRecord>
}

function defaultStorage(): ConnectionStorage {
  const id = 'default'
  return {
    version: STORAGE_VERSION,
    activeTenantId: id,
    tenants: {
      [id]: { id, name: 'Default', connections: [] },
    },
  }
}

function formToHeaders(form: ConnectionForm): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const { key, value } of form.headers) {
    const k = key.trim()
    if (k && value) headers[k] = value
  }
  return headers
}

export function formToStoredConnection(form: ConnectionForm, existingId?: string): StoredConnection {
  const now = new Date().toISOString()
  return {
    id: existingId ?? crypto.randomUUID(),
    name: form.name.trim(),
    endpoint: form.endpoint.trim(),
    headers: formToHeaders(form),
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
  }
}

export function storedConnectionToForm(conn: StoredConnection): ConnectionForm {
  const entries = Object.entries(conn.headers)
  return {
    name: conn.name,
    endpoint: conn.endpoint,
    headers: entries.length
      ? entries.map(([key, value]) => ({ key, value }))
      : [{ key: '', value: '' }],
  }
}

export function loadConnectionStorage(): ConnectionStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultStorage()
    const parsed = JSON.parse(raw) as ConnectionStorage
    if (parsed.version !== STORAGE_VERSION || !parsed.tenants || !parsed.activeTenantId) {
      return defaultStorage()
    }
    if (!parsed.tenants[parsed.activeTenantId]) {
      parsed.activeTenantId = Object.keys(parsed.tenants)[0] ?? 'default'
    }
    return parsed
  } catch {
    return defaultStorage()
  }
}

export function saveConnectionStorage(storage: ConnectionStorage): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage))
}

export function listTenants(storage: ConnectionStorage): TenantRecord[] {
  return Object.values(storage.tenants).sort((a, b) => a.name.localeCompare(b.name))
}

export function getActiveTenant(storage: ConnectionStorage): TenantRecord {
  return storage.tenants[storage.activeTenantId] ?? defaultStorage().tenants.default
}

export function upsertConnection(
  storage: ConnectionStorage,
  form: ConnectionForm,
  connectionId?: string | null,
): { storage: ConnectionStorage; connection: StoredConnection } {
  const tenant = getActiveTenant(storage)
  const now = new Date().toISOString()
  const existing = connectionId
    ? tenant.connections.find((c) => c.id === connectionId)
    : undefined

  const connection: StoredConnection = existing
    ? {
        ...existing,
        name: form.name.trim(),
        endpoint: form.endpoint.trim(),
        headers: formToHeaders(form),
        updatedAt: now,
        lastUsedAt: now,
      }
    : formToStoredConnection(form)

  const connections = existing
    ? tenant.connections.map((c) => (c.id === connection.id ? connection : c))
    : [...tenant.connections, connection]

  const next: ConnectionStorage = {
    ...storage,
    tenants: {
      ...storage.tenants,
      [tenant.id]: {
        ...tenant,
        connections,
        lastConnectionId: connection.id,
      },
    },
  }
  saveConnectionStorage(next)
  return { storage: next, connection }
}

export function deleteStoredConnection(
  storage: ConnectionStorage,
  connectionId: string,
): ConnectionStorage {
  const tenant = getActiveTenant(storage)
  const connections = tenant.connections.filter((c) => c.id !== connectionId)
  const lastConnectionId =
    tenant.lastConnectionId === connectionId ? connections[0]?.id : tenant.lastConnectionId

  const next: ConnectionStorage = {
    ...storage,
    tenants: {
      ...storage.tenants,
      [tenant.id]: { ...tenant, connections, lastConnectionId },
    },
  }
  saveConnectionStorage(next)
  return next
}

export function setActiveTenant(storage: ConnectionStorage, tenantId: string): ConnectionStorage {
  if (!storage.tenants[tenantId]) return storage
  const next = { ...storage, activeTenantId: tenantId }
  saveConnectionStorage(next)
  return next
}

export function createTenant(storage: ConnectionStorage, name: string): ConnectionStorage {
  const trimmed = name.trim()
  if (!trimmed) return storage
  const id = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || crypto.randomUUID()
  const uniqueId = storage.tenants[id] ? `${id}-${crypto.randomUUID().slice(0, 8)}` : id
  const next: ConnectionStorage = {
    ...storage,
    activeTenantId: uniqueId,
    tenants: {
      ...storage.tenants,
      [uniqueId]: { id: uniqueId, name: trimmed, connections: [] },
    },
  }
  saveConnectionStorage(next)
  return next
}

export function getLastConnectionForm(storage: ConnectionStorage): ConnectionForm | null {
  const tenant = getActiveTenant(storage)
  const conn = tenant.lastConnectionId
    ? tenant.connections.find((c) => c.id === tenant.lastConnectionId)
    : tenant.connections[0]
  return conn ? storedConnectionToForm(conn) : null
}

export function getConnectionFormById(connectionId: string): ConnectionForm | null {
  const storage = loadConnectionStorage()
  for (const tenant of Object.values(storage.tenants)) {
    const conn = tenant.connections.find((c) => c.id === connectionId)
    if (conn) return storedConnectionToForm(conn)
  }
  return null
}
