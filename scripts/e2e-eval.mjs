#!/usr/bin/env node
/**
 * End-to-end evaluation script for MCP Cartographer chat + inspection.
 * Usage: node scripts/e2e-eval.mjs [--chat]
 * Set OPENAI_API_KEY env var for live chat tests.
 */

const API = process.env.API_URL ?? 'http://127.0.0.1:3333'
const runChat = process.argv.includes('--chat')

const results = []
function pass(name) {
  results.push({ name, ok: true })
  console.log(`✓ ${name}`)
}
function fail(name, err) {
  results.push({ name, ok: false, err: String(err) })
  console.error(`✗ ${name}: ${err}`)
}

async function json(path, init) {
  const res = await fetch(`${API}${path}`, init)
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }
  return { res, data }
}

async function main() {
  console.log('MCP Cartographer E2E evaluation\n')

  // 1. Health
  try {
    const { res, data } = await json('/api/health')
    if (!res.ok || !data.ok) throw new Error(JSON.stringify(data))
    pass('API health')
  } catch (e) {
    fail('API health', e)
    process.exit(1)
  }

  // 2. Dev connection
  let devConn = null
  try {
    const { res, data } = await json('/api/dev/connection')
    if (!res.ok || !data.available) throw new Error('No dev connection')
    devConn = data.connection
    pass(`Dev connection: ${devConn.name}`)
  } catch (e) {
    fail('Dev connection', e)
  }

  // 3. MCP scan
  let scan = null
  if (devConn) {
    try {
      const { res, data } = await json('/api/mcp/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(devConn),
      })
      if (!res.ok || !data.ok || !data.scan) throw new Error(data.error ?? `HTTP ${res.status}`)
      scan = data.scan
      const size = JSON.stringify(scan).length
      const templates = scan.resourceTemplates?.length ?? 0
      const instructions = scan.serverMeta?.instructions?.length ?? 0
      pass(`MCP scan: ${scan.tools.length} tools, ${scan.resources.length} resources, ${templates} templates, instructions ${instructions} chars, payload ${(size / 1024).toFixed(0)}KB`)
      if (size > 500_000) {
        fail('Scan payload size', `Scan JSON is ${(size / 1024).toFixed(0)}KB — chat requests will be slow`)
      } else {
        pass('Scan payload size acceptable')
      }
    } catch (e) {
      fail('MCP scan', e)
    }
  }

  // 4. Chat stream — validation errors
  try {
    const { res, data } = await json('/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    })
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`)
    pass('Chat rejects missing apiKey/scan')
  } catch (e) {
    fail('Chat validation', e)
  }

  // 5. Chat stream — invalid key (NDJSON error)
  if (scan) {
    try {
      const res = await fetch(`${API}/api/ai/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: 'sk-invalid-test-key',
          messages: [{ role: 'user', content: 'What tools exist?' }],
          scan,
          connection: devConn,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const events = text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
      const types = events.map((e) => e.type)
      if (!types.includes('error')) throw new Error(`Expected error event, got: ${types.join(', ')}`)
      pass('Chat stream returns NDJSON error for invalid API key')
    } catch (e) {
      fail('Chat stream invalid key', e)
    }
  }

  // 6. Live chat with real key
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (runChat && apiKey && scan) {
    try {
      const res = await fetch(`${API}/api/ai/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          messages: [{
            role: 'user',
            content: 'Use scan_describe_capability to show the input schema for list_records_overview, then summarize what this MCP does in 2 sentences.',
          }],
          scan,
          connection: devConn,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const events = text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
      const errorEv = events.find((e) => e.type === 'error')
      if (errorEv) throw new Error(errorEv.error)
      const deltas = events.filter((e) => e.type === 'delta').map((e) => e.content).join('')
      const statuses = events.filter((e) => e.type === 'status')
      const hadTesting = statuses.some((s) => s.phase === 'testing')
      if (!events.some((e) => e.type === 'done')) throw new Error('No done event')
      if (!deltas.trim()) throw new Error('Empty assistant response')
      pass(`Live chat: ${deltas.length} chars, inspecting=${hadTesting}`)
      console.log('\n--- Assistant preview ---\n' + deltas.slice(0, 500) + '\n---\n')
    } catch (e) {
      fail('Live chat evaluation', e)
    }
  } else if (runChat) {
    console.log('⊘ Skipping live chat (set OPENAI_API_KEY and use --chat)')
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) {
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
