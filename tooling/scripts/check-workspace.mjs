import { access, readFile } from 'node:fs/promises'

const requiredPackages = [
  'domain',
  'diagnostics',
  'redaction',
  'config',
  'source-loader',
  'openapi',
  'arazzo',
  'cli',
]

const requiredScripts = [
  'build',
  'typecheck',
  'lint',
  'format:check',
  'test',
  'test:integration',
  'boundaries:check',
  'ci:verify',
]

async function main() {
  const rootPackage = JSON.parse(await readFile(new URL('../../package.json', import.meta.url)))

  for (const script of requiredScripts) {
    if (typeof rootPackage.scripts?.[script] !== 'string') {
      throw new Error(`Missing root script: ${script}`)
    }
  }

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
