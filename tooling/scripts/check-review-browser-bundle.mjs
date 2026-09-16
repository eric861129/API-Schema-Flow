import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const browserEntry = path.join(root, 'packages', 'review', 'dist', 'browser.js')

const prohibitedMatchers = [
  {
    pattern: /node:(?:crypto|fs|path|url|os|http|https)/,
    marker: (match) => match[0],
  },
  {
    pattern:
      /@api-schema-flow\/(?:openapi|arazzo|source-loader|inference|cli|exporter-[a-z0-9-]+|mock-runtime|execution)/,
    marker: (match) => match[0],
  },
  {
    pattern:
      /(?:^|[/\\])node_modules[/\\](?:\.pnpm[/\\])?(?:fastify|hono|msw)(?:@[^/\\]+)?(?:[/\\]|$)/m,
    marker: (match) => {
      const packageMatch = match[0].match(/(?:fastify|hono|msw)/)
      return packageMatch?.[0] ?? match[0]
    },
  },
  {
    pattern: /(?:from\s+|import\s*\(|require\s*\()['"](?:fastify|hono|msw)(?:[/"'])/,
    marker: (match) => match[0].match(/(?:fastify|hono|msw)/)?.[0] ?? match[0],
  },
]

function findProhibitedMarker(value) {
  for (const { pattern, marker } of prohibitedMatchers) {
    const match = value.match(pattern)
    if (match !== null) return marker(match)
  }
  return undefined
}

function assertBrowserSafe(value) {
  const marker = findProhibitedMarker(value)
  if (marker !== undefined) {
    throw new Error(`Prohibited Review browser dependency marker: ${marker}`)
  }
}

function flattenBuildOutput(result) {
  const results = Array.isArray(result) ? result : [result]
  return results.flatMap(({ output }) => output ?? [])
}

async function loadViteBuild() {
  const requireFromWeb = createRequire(path.join(root, 'apps', 'web', 'package.json'))
  const viteEntry = requireFromWeb.resolve('vite')
  const vite = await import(pathToFileURL(viteEntry).href)
  return vite.build
}

async function main() {
  assertBrowserSafe(await readFile(browserEntry, 'utf8'))

  const build = await loadViteBuild()
  let result
  try {
    result = await build({
      root,
      configFile: false,
      publicDir: false,
      logLevel: 'silent',
      build: {
        write: false,
        emptyOutDir: false,
        target: 'es2022',
        minify: false,
        sourcemap: false,
        lib: {
          entry: browserEntry,
          formats: ['es'],
          fileName: 'review-browser',
        },
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
    const marker = findProhibitedMarker(message)
    if (marker !== undefined) {
      throw new Error(`Prohibited Review browser dependency marker: ${marker}`, { cause: error })
    }
    throw error
  }

  const output = flattenBuildOutput(result)
  const inspectionText = output
    .flatMap((item) => {
      if (item.type !== 'chunk') return [item.fileName]
      return [
        item.fileName,
        item.code,
        ...(item.imports ?? []),
        ...(item.dynamicImports ?? []),
        ...(item.moduleIds ?? []),
        ...Object.keys(item.modules ?? {}),
      ]
    })
    .join('\n')

  assertBrowserSafe(inspectionText)
  console.log('Review browser bundle contains no prohibited dependency markers.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
