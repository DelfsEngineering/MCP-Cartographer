import * as esbuild from 'esbuild'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await esbuild.build({
  entryPoints: [resolve(root, 'api/server.ts')],
  outfile: resolve(root, 'api/_server.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  logLevel: 'info',
})

console.log('Bundled API handler → api/_server.cjs')
