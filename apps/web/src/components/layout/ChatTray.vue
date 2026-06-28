<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { getSuggestedQuestions } from '@mcp-cartographer/scan-core'
import { getConnectionFormById } from '@/lib/connection-storage'
import type { ConnectionForm } from '@/lib/api'
import { useScanStore } from '@/stores/scan'
import { useSettingsStore } from '@/stores/settings'
import { useChatStore } from '@/stores/chat'

const scan = useScanStore()
const settings = useSettingsStore()
const chat = useChatStore()

const input = ref('')
const threadEl = ref<HTMLElement | null>(null)

const hasLiveConnection = computed(() =>
  Boolean(
    scan.activeConnectionId
    || scan.liveConnectionForm?.endpoint?.trim()
    || scan.scanDoc?.scan.connectionId,
  ),
)

function resolveChatConnection(): ConnectionForm | null {
  if (scan.activeConnectionId) {
    const saved = getConnectionFormById(scan.activeConnectionId)
    if (saved?.endpoint?.trim()) return saved
  }
  if (scan.liveConnectionForm?.endpoint?.trim()) return scan.liveConnectionForm
  return null
}

const suggested = computed(() => {
  const base = scan.scanDoc ? getSuggestedQuestions(scan.scanDoc) : []
  if (hasLiveConnection.value && base.length < 6) {
    return [...base, 'Describe and smoke-test a read-only tool end-to-end']
  }
  return base
})

const canSend = computed(
  () => Boolean(scan.scanDoc && settings.hasKey && input.value.trim() && !chat.loading),
)

const inputPlaceholder = computed(() => {
  if (!scan.scanDoc) return 'Load a scan to start chatting…'
  if (!settings.hasKey) return 'Add OpenAI key in Settings…'
  if (chat.loading) return 'Waiting for response…'
  return 'Ask about this MCP…'
})

onMounted(() => {
  settings.refresh()
})

async function scrollToBottom() {
  await nextTick()
  if (threadEl.value) {
    threadEl.value.scrollTop = threadEl.value.scrollHeight
  }
}

watch(
  () => [chat.messages.length, chat.streamPhase, chat.streamText],
  () => {
    void scrollToBottom()
  },
)

function focusInput() {
  if (!settings.hasKey) {
    settings.openModal()
    return
  }
  if (!scan.scanDoc) {
    chat.error = 'Load or connect to a scan first — try Load sample in the header.'
    return
  }
}

async function submit() {
  if (!scan.scanDoc) {
    chat.error = 'Load or connect to a scan first.'
    return
  }
  if (!settings.hasKey) {
    settings.openModal()
    return
  }
  const trimmed = input.value.trim()
  if (!trimmed || chat.loading) return
  const text = trimmed
  input.value = ''
  await chat.send(
    text,
    scan.scanDoc,
    scan.selectedNodeId,
    resolveChatConnection(),
  )
}

function askSuggested(q: string) {
  if (!settings.hasKey) {
    settings.openModal()
    return
  }
  if (!scan.scanDoc) return
  input.value = q
  void submit()
}

function isStreamingMessage(id: string) {
  return chat.streamingMessageId === id
}
</script>

<template>
  <aside
    v-if="scan.chatOpen"
    class="w-[360px] shrink-0 border-l border-carto-border bg-carto-panel flex flex-col relative z-30 isolate pointer-events-auto"
  >
    <div class="h-12 px-4 flex items-center justify-between border-b border-carto-border shrink-0">
      <h2 class="font-medium text-sm">Ask the map</h2>
      <div class="flex items-center gap-2">
        <button
          v-if="chat.messages.length"
          type="button"
          class="text-xs text-carto-faint hover:text-carto-muted"
          :disabled="chat.loading"
          @click="chat.clear()"
        >
          <i class="fa-slab fa-regular fa-eraser mr-1.5" aria-hidden="true" />
          Clear
        </button>
        <button
          type="button"
          class="text-carto-faint hover:text-carto-muted"
          aria-label="Collapse chat"
          @click="scan.setChatOpen(false)"
        >
          <i class="fa-slab fa-regular fa-xmark" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div ref="threadEl" class="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
      <div v-if="!scan.scanDoc" class="text-sm text-carto-muted space-y-2">
        <p>Load or import a scan to ask questions about your MCP server map.</p>
        <button
          type="button"
          class="text-sm px-3 py-2 rounded-lg bg-grape-500 text-white hover:bg-grape-600"
          @click="scan.loadSampleScan()"
        >
          <i class="fa-slab fa-regular fa-flask mr-1.5" aria-hidden="true" />
          Load sample scan
        </button>
      </div>
      <template v-else>
        <div class="text-xs px-2 py-1 rounded-md bg-grape-50 text-grape-700 border border-grape-100 inline-block">
          {{ scan.scanDoc.scan.serverName }}
          <span v-if="scan.selectedNode"> · {{ scan.selectedNode.label }}</span>
          <span v-if="hasLiveConnection" class="text-grape-500">
            <i class="fa-slab fa-regular fa-plug ml-1" aria-hidden="true" />
            live
          </span>
        </div>

        <div
          v-if="!settings.hasKey"
          class="text-sm px-3 py-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-100"
        >
          <button type="button" class="text-left w-full hover:opacity-90" @click="settings.openModal()">
            Add your <span class="font-medium text-grape-700 underline">OpenAI API key</span> in Settings to enable chat.
          </button>
        </div>

        <div v-if="!chat.messages.length && !chat.loading" class="space-y-2">
          <p class="text-sm text-carto-muted">
            Ask about readiness, schemas, server instructions, resource templates, agent workflows, and live smoke tests.
            <span v-if="hasLiveConnection"> Live MCP connected — I can describe capabilities, read guides, and call tools.</span>
            <span v-else> Use scan describe for full schemas; connect & scan for live tests.</span>
          </p>
          <p class="text-xs font-medium text-carto-faint uppercase">Suggested</p>
          <button
            v-for="q in suggested"
            :key="q"
            type="button"
            class="block w-full text-left text-sm px-3 py-2 rounded-lg border border-carto-border hover:bg-carto-panelSoft text-carto-muted disabled:opacity-50"
            :disabled="chat.loading"
            @click="askSuggested(q)"
          >
            {{ q }}
          </button>
        </div>

        <div
          v-for="msg in chat.messages"
          :key="msg.id"
          class="text-sm rounded-lg px-3 py-2"
          :class="msg.role === 'user'
            ? 'bg-grape-50 text-grape-900 border border-grape-100 ml-4'
            : 'bg-carto-panelSoft border border-carto-border mr-2'"
        >
          <p class="text-[10px] font-medium uppercase tracking-wide mb-1 opacity-60">
            {{ msg.role === 'user' ? 'You' : 'Cartographer' }}
          </p>

          <div
            v-if="msg.role === 'assistant' && isStreamingMessage(msg.id) && chat.streamPhase === 'thinking'"
            class="flex items-center text-carto-muted py-1"
          >
            <span class="thinking-dots" aria-hidden="true">
              <span /><span /><span />
            </span>
            <i class="fa-slab fa-regular fa-magnifying-glass mr-1.5" aria-hidden="true" />
            <span class="text-sm">Analyzing scan…</span>
          </div>

          <div
            v-else-if="msg.role === 'assistant' && isStreamingMessage(msg.id) && chat.streamPhase === 'testing'"
            class="flex items-center text-carto-muted py-1"
          >
            <span class="thinking-dots" aria-hidden="true">
              <span /><span /><span />
            </span>
            <i class="fa-slab fa-regular fa-flask mr-1.5" aria-hidden="true" />
            <span class="text-sm">Inspecting{{ chat.streamDetail ? `: ${chat.streamDetail}` : '…' }}</span>
          </div>

          <div
            v-else-if="msg.content || (msg.role === 'assistant' && isStreamingMessage(msg.id))"
            class="whitespace-pre-wrap leading-relaxed"
          >
            {{ isStreamingMessage(msg.id) ? chat.streamText : msg.content }}<span
              v-if="msg.role === 'assistant' && isStreamingMessage(msg.id) && chat.streamPhase === 'streaming'"
              class="stream-cursor"
              aria-hidden="true"
            >▍</span>
          </div>
        </div>

        <div
          v-if="chat.error"
          class="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-100"
        >
          {{ chat.error }}
        </div>
      </template>
    </div>

    <form class="p-3 border-t border-carto-border shrink-0 bg-carto-panel" @submit.prevent="submit">
      <div v-if="chat.loading" class="text-xs text-carto-faint mb-2 flex items-center gap-1">
        <span class="thinking-dots scale-75 origin-left" aria-hidden="true">
          <span /><span /><span />
        </span>
        {{ chat.streamPhase === 'thinking'
          ? 'Thinking…'
          : chat.streamPhase === 'testing'
            ? `Inspecting${chat.streamDetail ? `: ${chat.streamDetail}` : '…'}`
            : 'Writing…' }}
      </div>
      <div class="flex gap-2">
        <input
          v-model="input"
          type="text"
          :readonly="chat.loading"
          :placeholder="inputPlaceholder"
          class="flex-1 px-3 py-2 text-sm rounded-lg border border-carto-border bg-white focus:ring-2 focus:ring-grape-200 focus:border-grape-400 outline-none"
          :class="(!scan.scanDoc || !settings.hasKey) ? 'cursor-pointer bg-carto-panelSoft' : ''"
          @focus="focusInput"
          @click="focusInput"
        />
        <button
          type="submit"
          class="px-3 py-2 text-sm rounded-lg bg-grape-500 text-white hover:bg-grape-600 disabled:opacity-50"
          :disabled="!canSend"
        >
          <i class="fa-slab fa-regular fa-paper-plane mr-1.5" aria-hidden="true" />
          Send
        </button>
      </div>
    </form>
  </aside>
  <button
    v-else
    type="button"
    class="w-12 shrink-0 border-l border-carto-border bg-carto-panel hover:bg-carto-panelSoft text-carto-muted text-xs relative z-30 isolate pointer-events-auto flex items-center justify-center"
    style="writing-mode: vertical-rl"
    aria-label="Open chat"
    @click="scan.setChatOpen(true)"
  >
    <span class="inline-flex items-center gap-1">
      <i class="fa-slab fa-regular fa-comments" aria-hidden="true" />
      <span>Chat</span>
    </span>
  </button>
</template>
