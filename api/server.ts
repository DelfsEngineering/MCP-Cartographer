import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildApp } from '../apps/api/src/app'

let appPromise: ReturnType<typeof buildApp> | null = null

async function getApp() {
  if (!appPromise) appPromise = buildApp()
  const app = await appPromise
  await app.ready()
  return app
}

async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp()
  app.server.emit('request', req, res)
}

export default handler

export const config = {
  maxDuration: 300,
}
