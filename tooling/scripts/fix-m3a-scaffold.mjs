import { readFile, writeFile } from 'node:fs/promises'

const path = 'tooling/scripts/scaffold-m3a-implementation.mjs'
const source = await readFile(path, 'utf8')
const fixed = source.replace(
  'group: ci-${{ github.workflow }}-${{ github.ref }}',
  'group: ci-\\${{ github.workflow }}-\\${{ github.ref }}',
)

if (fixed === source) {
  throw new Error('Expected GitHub Actions interpolation marker was not found in the scaffold.')
}

await writeFile(path, fixed, 'utf8')
console.log('Escaped GitHub Actions interpolation in M3-A scaffold.')
