import { streamOpenAiChat } from '../apps/api/src/assistant/chat.ts'

const API = 'http://127.0.0.1:3333'

async function main() {
  const dev = await fetch(`${API}/api/dev/connection`).then((r) => r.json())
  const scanRes = await fetch(`${API}/api/mcp/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dev.connection),
  }).then((r) => r.json())

  const events = []
  const result = await streamOpenAiChat(
    {
      apiKey: 'sk-invalid-test-key',
      messages: [{ role: 'user', content: 'What tools exist?' }],
      scan: scanRes.scan,
      connection: dev.connection,
    },
    (e) => {
      events.push(e)
      console.log('event', e)
    },
  )
  console.log('result', result)
  console.log('event count', events.length)
}

main().catch((e) => {
  console.error('fatal', e)
})
