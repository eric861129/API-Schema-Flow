import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const packagesDirectory = fileURLToPath(new URL('../../packages/', import.meta.url))
const forbiddenDeepImport = /from\s+['"]@api-schema-flow\/[^'"]+\/src\//
const scalarTypeLeak = /@scalar\/openapi-parser/

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (['dist', 'node_modules', 'coverage'].includes(entry.name)) continue
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(child)))
    else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(child)
  }

  return files
}

async function main() {
  const packageFiles = await walk(packagesDirectory)
  const violations = []

  for (const file of packageFiles) {
    const content = await readFile(file, 'utf8')
    const relative = path.relative(root, file)

    if (forbiddenDeepImport.test(content)) {
      violations.push(`${relative}: deep workspace import`)
    }

    if (!relative.startsWith('packages/openapi/') && scalarTypeLeak.test(content)) {
      violations.push(`${relative}: Scalar parser leaked outside openapi package`)
    }
  }

  if (violations.length > 0) {
    throw new Error(`Package boundary violations:\n${violations.join('\n')}`)
  }

  console.log('Package boundaries are valid.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
