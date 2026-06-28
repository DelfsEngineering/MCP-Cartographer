const STORAGE_KEY = 'mcp-cartographer:settings'
const STORAGE_VERSION = 1

export type AppSettings = {
  version: number
  openaiApiKey: string
  openaiKeyValidatedAt?: string
}

function defaultSettings(): AppSettings {
  return { version: STORAGE_VERSION, openaiApiKey: '' }
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings()
    const parsed = JSON.parse(raw) as AppSettings
    if (parsed.version !== STORAGE_VERSION || typeof parsed.openaiApiKey !== 'string') {
      return defaultSettings()
    }
    return parsed
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function setOpenAiApiKey(apiKey: string): AppSettings {
  const next: AppSettings = {
    ...loadSettings(),
    openaiApiKey: apiKey.trim(),
    openaiKeyValidatedAt: undefined,
  }
  saveSettings(next)
  return next
}

export function markOpenAiKeyValidated(): AppSettings {
  const next: AppSettings = {
    ...loadSettings(),
    openaiKeyValidatedAt: new Date().toISOString(),
  }
  saveSettings(next)
  return next
}

export function clearOpenAiApiKey(): AppSettings {
  const next = defaultSettings()
  saveSettings(next)
  return next
}

export function hasOpenAiApiKey(settings: AppSettings = loadSettings()): boolean {
  return settings.openaiApiKey.length > 0
}
