import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const packagesDirectory = fileURLToPath(new URL('../../packages/', import.meta.url))
const forbiddenDeepImport = /from\s+['"]@api-schema-flow\/[^'"]+\/src\//
const scalarTypeLeak = /@scalar\/openapi-parser/
const zodTypeLeak = /(?:from|import\()\s*['"]zod['"]/
const openApiPackageImport = /@api-schema-flow\/openapi(?:['"/])/
const arazzoPackageImport = /@api-schema-flow\/arazzo(?:['"/])/
const forbiddenFlowRuntimeImport =
  /(?:from|import\()\s*['"](?:react|@xyflow\/react|elkjs|fastify|hono|msw|@api-schema-flow\/(?:mock-runtime|execution|web|ui))(?:['"/])/
const forbiddenInferenceRuntimeImport =
  /(?:from|import\()\s*['"](?:@api-schema-flow\/(?:openapi|arazzo|source-loader|mock-runtime|execution|web|ui)|react|@xyflow\/react|elkjs|fastify|hono|msw)(?:['"/])/
const forbiddenReviewRuntimeImport =
  /(?:from\s+|import\s*\(\s*|import\s+)['"](?:@api-schema-flow\/(?:openapi|arazzo|source-loader|inference|exporter-arazzo|cli|mock-runtime|execution|web|ui)|react|@xyflow\/react|elkjs|fastify|hono|msw)(?:['"/])/
const forbiddenExporterRuntimeImport =
  /(?:from\s+|import\s*\(\s*|import\s+)['"](?:@api-schema-flow\/(?:openapi|inference|review|exporter-mermaid|exporter-report|cli|mock-runtime|execution|web|ui)|react|@xyflow\/react|elkjs|fastify|hono|msw)(?:['"/])/
const forbiddenInferenceDependencies = new Set([
  '@api-schema-flow/openapi',
  '@api-schema-flow/arazzo',
  '@api-schema-flow/source-loader',
  '@api-schema-flow/mock-runtime',
  '@api-schema-flow/execution',
  '@api-schema-flow/web',
  '@api-schema-flow/ui',
  'react',
  '@xyflow/react',
  'elkjs',
  'fastify',
  'hono',
  'msw',
])
const allowedReviewDependencies = new Set([
  '@api-schema-flow/diagnostics',
  '@api-schema-flow/domain',
  '@api-schema-flow/flow',
])
const allowedExporterDependencies = new Set([
  '@api-schema-flow/arazzo',
  '@api-schema-flow/diagnostics',
  '@api-schema-flow/domain',
  '@api-schema-flow/flow',
  '@api-schema-flow/source-loader',
  'yaml',
])
const forbiddenFlowDependencies = new Set([
  'react',
  '@xyflow/react',
  'elkjs',
  'fastify',
  'hono',
  'msw',
  '@api-schema-flow/mock-runtime',
  '@api-schema-flow/execution',
  '@api-schema-flow/web',
  '@api-schema-flow/ui',
])

async function walk(directory, options = {}) {
  const { includeDist = false, extension = '.ts' } = options
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (
      (!includeDist && entry.name === 'dist') ||
      ['node_modules', 'coverage'].includes(entry.name)
    ) {
      continue
    }
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(child, options)))
    else if (entry.isFile() && entry.name.endsWith(extension)) files.push(child)
  }

  return files
}

async function collectDeclarationViolations(directory, pattern, message) {
  const files = await walk(directory, { includeDist: true, extension: '.d.ts' })
  const violations = []

  for (const file of files) {
    if (pattern.test(await readFile(file, 'utf8'))) {
      violations.push(`${path.relative(root, file)}: ${message}`)
    }
  }

  return violations
}

async function collectInferenceDependencyViolations() {
  const packagePath = path.join(packagesDirectory, 'inference', 'package.json')
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
  const dependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {}),
    ...(packageJson.peerDependencies ?? {}),
  }

  return Object.keys(dependencies)
    .filter((dependency) => forbiddenInferenceDependencies.has(dependency))
    .sort()
    .map(
      (dependency) =>
        `packages/inference/package.json: forbidden Inference dependency ${dependency}`,
    )
}

async function collectFlowDependencyViolations() {
  const packagePath = path.join(packagesDirectory, 'flow', 'package.json')
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
  const dependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {}),
    ...(packageJson.peerDependencies ?? {}),
  }

  return Object.keys(dependencies)
    .filter((dependency) => forbiddenFlowDependencies.has(dependency))
    .sort()
    .map((dependency) => `packages/flow/package.json: forbidden Flow dependency ${dependency}`)
}

async function collectAllowedDependencyViolations(packageName, allowedDependencies) {
  const packagePath = path.join(packagesDirectory, packageName, 'package.json')
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
  const dependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {}),
    ...(packageJson.peerDependencies ?? {}),
  }

  return Object.keys(dependencies)
    .filter((dependency) => !allowedDependencies.has(dependency))
    .sort()
    .map(
      (dependency) =>
        `packages/${packageName}/package.json: forbidden ${packageName} dependency ${dependency}`,
    )
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

    if (!relative.startsWith('packages/config/') && zodTypeLeak.test(content)) {
      violations.push(`${relative}: Zod leaked outside config package`)
    }

    if (relative.startsWith('packages/arazzo/') && openApiPackageImport.test(content)) {
      violations.push(`${relative}: Arazzo package must not depend on OpenAPI package`)
    }

    if (relative.startsWith('packages/openapi/') && arazzoPackageImport.test(content)) {
      violations.push(`${relative}: OpenAPI package must not depend on Arazzo package`)
    }

    if (
      relative.startsWith('packages/inference/src/') &&
      forbiddenInferenceRuntimeImport.test(content)
    ) {
      violations.push(
        `${relative}: Inference core must not depend on parser, source, UI, server, mock, or execution runtimes`,
      )
    }

    if (relative.startsWith('packages/flow/src/') && forbiddenFlowRuntimeImport.test(content)) {
      violations.push(
        `${relative}: Flow core must not depend on UI, layout, server, mock, or execution runtimes`,
      )
    }

    if (relative.startsWith('packages/review/src/') && forbiddenReviewRuntimeImport.test(content)) {
      violations.push(`${relative}: Review core must only depend on Domain, Diagnostics, and Flow`)
    }

    if (
      relative.startsWith('packages/exporter-arazzo/src/') &&
      forbiddenExporterRuntimeImport.test(content)
    ) {
      violations.push(
        `${relative}: Arazzo exporter must not depend on parser implementations, inference, review, UI, server, mock, or execution runtimes`,
      )
    }
  }

  violations.push(
    ...(await collectDeclarationViolations(
      path.join(packagesDirectory, 'openapi', 'dist'),
      scalarTypeLeak,
      'Scalar type leaked through public declarations',
    )),
    ...(await collectDeclarationViolations(
      path.join(packagesDirectory, 'config', 'dist'),
      zodTypeLeak,
      'Zod type leaked through public declarations',
    )),
    ...(await collectFlowDependencyViolations()),
    ...(await collectInferenceDependencyViolations()),
    ...(await collectAllowedDependencyViolations('review', allowedReviewDependencies)),
    ...(await collectAllowedDependencyViolations('exporter-arazzo', allowedExporterDependencies)),
  )

  if (violations.length > 0) {
    throw new Error(`Package boundary violations:\n${violations.join('\n')}`)
  }

  console.log('Package boundaries are valid.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
