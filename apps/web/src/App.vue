<script setup lang="ts">
import TopBar from './components/layout/TopBar.vue'
import LeftNav from './components/layout/LeftNav.vue'
import ChatTray from './components/layout/ChatTray.vue'
import DetailDrawer from './components/layout/DetailDrawer.vue'
import MainPanel from './components/layout/MainPanel.vue'
import ConnectionModal from './components/connection/ConnectionModal.vue'
import SettingsModal from './components/settings/SettingsModal.vue'
</script>

<template>
  <div class="h-screen bg-carto-bg text-carto-text flex flex-col">
    <TopBar />
    <div class="flex flex-1 overflow-hidden min-w-0 relative">
      <LeftNav />
      <main class="flex-1 overflow-hidden flex flex-col min-w-0 relative z-0">
        <MainPanel />
        <DetailDrawer />
      </main>
      <ChatTray />
    </div>
    <ConnectionModal />
    <SettingsModal />
  </div>
</template>
