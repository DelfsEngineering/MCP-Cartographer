import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatUIAction, ScanDocument } from '@mcp-cartographer/shared'
import { streamAiChat } from '@/lib/api'
import type { ConnectionForm } from '@/lib/api'
import { parseAssistantActions, type ChatMessage } from '@/lib/chat-actions'
import { loadSettings } from '@/lib/settings-storage'
import { useScanStore } from './scan'

export type StreamPhase = 'idle' | 'thinking' | 'testing' | 'streaming'

function newMessage(role: 'user' | 'assistant', content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  }
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const loading = ref(false)
  const streamPhase = ref<StreamPhase>('idle')
  const streamDetail = ref<string | null>(null)
  const streamingMessageId = ref<string | null>(null)
  /** Live token buffer — bound directly in UI for reliable streaming updates. */
  const streamText = ref('')
  const error = ref<string | null>(null)
  let abortController: AbortController | null = null

  function clear() {
    abortController?.abort()
    abortController = null
    messages.value = []
    error.value = null
    loading.value = false
    streamPhase.value = 'idle'
    streamDetail.value = null
    streamingMessageId.value = null
    streamText.value = ''
  }

  function applyActions(actions: ChatUIAction[]) {
    const scan = useScanStore()
    for (const action of actions) {
      switch (action.type) {
        case 'focus_node':
          scan.selectNode(action.nodeId)
          scan.setMode('map')
          break
        case 'highlight_nodes':
          if (action.nodeIds[0]) scan.selectNode(action.nodeIds[0])
          scan.setMode('map')
          break
        case 'open_finding':
          scan.selectFinding(action.findingId)
          break
        case 'switch_mode': {
          const mode =
            action.mode === 'audit' || action.mode === 'findings' ? 'findings' : action.mode
          scan.setMode(mode)
          break
        }
      }
    }
  }

  function commitStreamToMessage(messageId: string, content: string) {
    const idx = messages.value.findIndex((m) => m.id === messageId)
    if (idx === -1) return
    const current = messages.value[idx]
    messages.value.splice(idx, 1, { ...current, content })
  }

  async function send(
    text: string,
    scanDoc: ScanDocument,
    selectedNodeId?: string | null,
    connection?: ConnectionForm | null,
  ) {
    const trimmed = text.trim()
    if (!trimmed || loading.value) return

    const apiKey = loadSettings().openaiApiKey
    if (!apiKey) {
      error.value = 'Add your OpenAI API key in Settings first'
      return
    }

    messages.value.push(newMessage('user', trimmed))
    const assistantMsg = newMessage('assistant', '')
    messages.value.push(assistantMsg)
    streamingMessageId.value = assistantMsg.id
    streamText.value = ''

    loading.value = true
    streamPhase.value = 'thinking'
    error.value = null
    abortController?.abort()
    abortController = new AbortController()

    let fullContent = ''

    try {
      const history = messages.value
        .filter((m) => m.id !== assistantMsg.id)
        .map((m) => ({ role: m.role, content: m.content }))

      await streamAiChat(
        {
          apiKey,
          messages: history,
          scan: scanDoc,
          selectedNodeId,
          connection,
        },
        {
          onStatus: (phase, detail) => {
            streamPhase.value = phase
            streamDetail.value = detail ?? null
          },
          onDelta: (content) => {
            fullContent += content
            streamText.value += content
          },
          onDone: () => {
            const { displayContent, actions } = parseAssistantActions(fullContent)
            commitStreamToMessage(assistantMsg.id, displayContent)
            if (actions.length) applyActions(actions)
          },
          onError: (message) => {
            if (message === 'Request cancelled') return
            error.value = message
            const idx = messages.value.findIndex((m) => m.id === assistantMsg.id)
            if (idx !== -1 && !fullContent) {
              messages.value.splice(idx, 1)
            } else if (fullContent) {
              const { displayContent } = parseAssistantActions(fullContent)
              commitStreamToMessage(assistantMsg.id, displayContent)
            }
          },
        },
        abortController.signal,
      )
    } catch (e) {
      if (!abortController.signal.aborted) {
        error.value = e instanceof Error ? e.message : String(e)
        const idx = messages.value.findIndex((m) => m.id === assistantMsg.id)
        if (idx !== -1 && !fullContent) {
          messages.value.splice(idx, 1)
        }
      }
    } finally {
      loading.value = false
      streamPhase.value = 'idle'
      streamDetail.value = null
      streamingMessageId.value = null
      streamText.value = ''
      abortController = null
    }
  }

  return {
    messages,
    loading,
    streamPhase,
    streamDetail,
    streamingMessageId,
    streamText,
    error,
    clear,
    send,
  }
})
