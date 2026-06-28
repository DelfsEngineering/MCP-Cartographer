import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  clearOpenAiApiKey,
  hasOpenAiApiKey,
  loadSettings,
  markOpenAiKeyValidated,
  setOpenAiApiKey,
  type AppSettings,
} from '@/lib/settings-storage'
import { validateOpenAiKey } from '@/lib/api'

export const useSettingsStore = defineStore('settings', () => {
  const modalOpen = ref(false)
  const settings = ref<AppSettings>(loadSettings())
  const draftKey = ref('')
  const validating = ref(false)
  const statusMessage = ref<string | null>(null)
  const error = ref<string | null>(null)

  const hasKey = computed(() => hasOpenAiApiKey(settings.value))
  const keyHint = computed(() => {
    const key = settings.value.openaiApiKey
    if (!key) return null
    if (key.length <= 8) return '••••••••'
    return `${key.slice(0, 7)}…${key.slice(-4)}`
  })

  function refresh() {
    settings.value = loadSettings()
    draftKey.value = settings.value.openaiApiKey
  }

  function openModal() {
    modalOpen.value = true
    error.value = null
    statusMessage.value = null
    refresh()
  }

  function closeModal() {
    modalOpen.value = false
  }

  function saveKey() {
    const trimmed = draftKey.value.trim()
    if (!trimmed) {
      error.value = 'Enter an OpenAI API key or use Clear to remove the saved key'
      return false
    }
    settings.value = setOpenAiApiKey(trimmed)
    statusMessage.value = 'API key saved in this browser’s localStorage'
    error.value = null
    return true
  }

  function clearKey() {
    settings.value = clearOpenAiApiKey()
    draftKey.value = ''
    statusMessage.value = 'OpenAI API key removed from this browser'
    error.value = null
  }

  async function testKey(): Promise<boolean> {
    const key = draftKey.value.trim() || settings.value.openaiApiKey
    if (!key) {
      error.value = 'Enter an API key first'
      return false
    }
    validating.value = true
    error.value = null
    statusMessage.value = 'Validating key with OpenAI…'
    try {
      const result = await validateOpenAiKey(key)
      if (!result.ok) {
        error.value = result.error ?? 'Invalid API key'
        statusMessage.value = null
        return false
      }
      settings.value = setOpenAiApiKey(key)
      settings.value = markOpenAiKeyValidated()
      draftKey.value = key
      statusMessage.value = 'API key is valid and saved'
      error.value = null
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      statusMessage.value = null
      return false
    } finally {
      validating.value = false
    }
  }

  return {
    modalOpen,
    settings,
    draftKey,
    validating,
    statusMessage,
    error,
    hasKey,
    keyHint,
    openModal,
    closeModal,
    saveKey,
    clearKey,
    testKey,
    refresh,
  }
})
