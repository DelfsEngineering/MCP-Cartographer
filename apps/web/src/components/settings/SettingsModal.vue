<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
</script>

<template>
  <div
    v-if="settings.modalOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
    @click.self="settings.closeModal()"
  >
    <div class="w-full max-w-md rounded-xl2 bg-carto-panel border border-carto-border shadow-soft">
      <div class="px-5 py-4 border-b border-carto-border flex items-center justify-between">
        <h2 class="font-semibold inline-flex items-center gap-2">
          <i class="fa-slab fa-regular fa-gear text-carto-muted" aria-hidden="true" />
          <span>Settings</span>
        </h2>
        <button
          type="button"
          class="text-carto-faint hover:text-carto-muted"
          aria-label="Close settings"
          @click="settings.closeModal()"
        >
          <i class="fa-slab fa-regular fa-xmark" aria-hidden="true" />
        </button>
      </div>

      <div class="p-5 space-y-4">
        <div class="text-sm px-3 py-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-100">
          Bring your own OpenAI key. It is stored in <strong>localStorage</strong> on this browser only and sent to your
          local API proxy when you use AI features — we do not host or manage keys.
        </div>

        <div>
          <label class="block text-xs font-medium text-carto-muted mb-1">OpenAI API key</label>
          <input
            v-model="settings.draftKey"
            type="password"
            autocomplete="off"
            class="w-full px-3 py-2 text-sm rounded-lg border border-carto-border bg-white font-mono"
            placeholder="sk-…"
          />
          <p v-if="settings.hasKey && !settings.draftKey" class="mt-1 text-xs text-carto-faint">
            Saved key: {{ settings.keyHint }}
          </p>
          <p class="mt-1 text-xs text-carto-faint">
            Create a key at
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" class="text-grape-600 hover:underline">platform.openai.com</a>.
          </p>
        </div>

        <div
          v-if="settings.statusMessage"
          class="text-sm px-3 py-2 rounded-lg bg-grape-50 text-grape-700 border border-grape-100"
        >
          {{ settings.statusMessage }}
        </div>
        <div
          v-if="settings.error"
          class="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-100"
        >
          {{ settings.error }}
        </div>
      </div>

      <div class="px-5 py-4 border-t border-carto-border flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-lg border border-carto-border hover:bg-carto-panelSoft text-carto-muted"
          :disabled="settings.validating"
          @click="settings.clearKey()"
        >
          <i class="fa-slab fa-regular fa-eraser mr-1.5" aria-hidden="true" />
          Clear
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-lg border border-carto-border hover:bg-carto-panelSoft"
          :disabled="settings.validating"
          @click="settings.saveKey()"
        >
          <i class="fa-slab fa-regular fa-floppy-disk mr-1.5" aria-hidden="true" />
          Save
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-lg bg-grape-500 text-white hover:bg-grape-600 disabled:opacity-50"
          :disabled="settings.validating"
          @click="settings.testKey()"
        >
          <i class="fa-slab fa-regular mr-1.5" :class="settings.validating ? 'fa-spinner fa-spin' : 'fa-flask'" aria-hidden="true" />
          {{ settings.validating ? 'Testing…' : 'Test & Save' }}
        </button>
      </div>
    </div>
  </div>
</template>
