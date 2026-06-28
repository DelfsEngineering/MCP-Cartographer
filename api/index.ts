import type { VercelRequest, VercelResponse } from '@vercel/node'

type HandlerModule = {
  default: (req: VercelRequest, res: VercelResponse) => Promise<void>
  config: { maxDuration: number }
}

// Bundled during build → api/_server.cjs
const server = require('./_server.cjs') as HandlerModule

export default server.default
export const config = server.config
