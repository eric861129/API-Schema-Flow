import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const directory = resolve(process.argv[2] ?? 'apps/web/dist')
const forbidden =
  /node:(?:fs|path|os|crypto|http|https)|@api-schema-flow\/(?:openapi|arazzo|source-loader|inference|review|exporter-arazzo|cli|mock-runtime|execution)|\brequire\(['"](?:fs|path|os|crypto)['"]\)/

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const child = join(path, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(child)))
    else if (entry.isFile() && /\.(?:js|mjs|html)$/.test(entry.name)) files.push(child)
  }
  return files
}

for (const file of await walk(directory)) {
  const content = await readFile(file, 'utf8')
  if (forbidden.test(content)) throw new Error('Forbidden browser dependency marker in ' + file)
}
console.log('Web bundle contains no prohibited Node-only dependency markers.')
