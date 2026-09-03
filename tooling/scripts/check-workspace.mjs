import { access, readFile } from 'node:fs/promises'

const requiredPackages = [
  'domain',
  'diagnostics',
  'redaction',
  'config',
  'source-loader',
  'openapi',
  'arazzo',
  'flow',
  'inference',
  'review',
  'exporter-arazzo',
  'cli',
  'layout',
]

const requiredScripts = [
  'build',
  'typecheck',
  'lint',
  'format:check',
  'test',
  'test:integration',
  'test:flow-fixtures',
  'test:inference-benchmark',
  'test:inference-performance',
  'test:review',
  'test:export-arazzo',
  'test:review-export-fixtures',
  'boundaries:check',
  'ci:verify',
  'dev:web',
  'build:web',
  'test:web',
  'test:web:e2e',
  'check:web-bundle',
  'generate:web-fixture',
  'check:web-fixture',
]

async function main() {
  const rootPackage = JSON.parse(await readFile(new URL('../../package.json', import.meta.url)))

  for (const script of requiredScripts) {
    if (typeof rootPackage.scripts?.[script] !== 'string') {
      throw new Error(`Missing root script: ${script}`)
    }
  }

  await access(new URL('../../apps/web/package.json', import.meta.url))
  await access(new URL('../../apps/web/src/main.tsx', import.meta.url))

  for (const packageName of requiredPackages) {
    await access(new URL(`../../packages/${packageName}/package.json`, import.meta.url))
    await access(new URL(`../../packages/${packageName}/src/index.ts`, import.meta.url))
  }

  console.log('Workspace structure is valid.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
