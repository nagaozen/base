import { readdir } from 'node:fs/promises'

import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

const config = [
  {
    input: 'src/index.mjs',
    output: [
      {
        dir: 'dist',
        format: 'esm',
        entryFileNames: 'index.mjs',
        sourcemap: true
      },
      {
        dir: 'dist',
        format: 'cjs',
        entryFileNames: 'index.cjs.js',
        sourcemap: true
      }
    ],
    plugins: [resolve(), commonjs()],
    external: []
  }
]

function appendConfigEntriesFor (submodule) {
  config.push({
    input: `src/lib/${submodule}/index.mjs`,
    output: [
      {
        dir: `dist/${submodule}`,
        format: 'esm',
        entryFileNames: '[name].mjs',
        sourcemap: true
      },
      {
        dir: `dist/${submodule}`,
        format: 'cjs',
        entryFileNames: '[name].cjs.js',
        sourcemap: true
      }
    ],
    plugins: [resolve(), commonjs()],
    external: []
  })
}

const entries = await readdir('./src/lib', { withFileTypes: true })
const submodules = entries.filter(f => f.isDirectory()).map(f => f.name)
submodules.forEach(submodule => appendConfigEntriesFor(submodule))

export default config
