import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/main.css'
import { useScanStore } from './stores/scan'
import { useConnectionStore } from './stores/connection'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const scanStore = useScanStore()
scanStore.hydrateFromStorage()

const connectionStore = useConnectionStore()
if (scanStore.activeConnectionId) {
  connectionStore.activeConnectionId = scanStore.activeConnectionId
  const conn = connectionStore.savedConnections.find((c) => c.id === scanStore.activeConnectionId)
  if (conn) {
    connectionStore.loadSavedConnection(conn)
  }
}

app.mount('#app')
