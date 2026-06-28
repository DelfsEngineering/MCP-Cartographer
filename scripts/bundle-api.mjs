import * as esbuild from 'esbuild'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await esbuild.build({
  entryPoints: [resolve(root, 'api/index.ts')],
  outfile: resolve(root, 'api/handler.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  logLevel: 'info',
})

console.log('Bundled API handler → api/handler.cjs')
