const API = 'http://127.0.0.1:3333'

async function main() {
  const dev = await fetch(`${API}/api/dev/connection`).then((r) => r.json())
  const scanRes = await fetch(`${API}/api/mcp/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dev.connection),
  }).then((r) => r.json())

  const body = {
    apiKey: 'sk-invalid-test-key',
    messages: [{ role: 'user', content: 'What tools exist?' }],
    scan: scanRes.scan,
    connection: dev.connection,
  }

  const res = await fetch(`${API}/api/ai/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  console.log('status', res.status)
  const lines = text.split('\n').filter(Boolean)
  for (const line of lines) {
    console.log(JSON.parse(line))
  }
}

main().catch(console.error)
