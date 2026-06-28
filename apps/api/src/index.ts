import { config } from 'dotenv'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { buildApp } from './app.js'

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') })

const PORT = Number(process.env.PORT ?? 3333)
const HOST = process.env.HOST ?? '127.0.0.1'

const app = await buildApp()

try {
  await app.listen({ port: PORT, host: HOST })
  console.log(`MCP Cartographer API listening on http://${HOST}:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
