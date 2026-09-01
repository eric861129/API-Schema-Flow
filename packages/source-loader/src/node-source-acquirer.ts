import { lookup } from 'node:dns/promises'
import { readFile, realpath } from 'node:fs/promises'
import { isIP } from 'node:net'
import { extname, isAbsolute, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { DIAGNOSTIC_CODES, type Diagnostic } from '@api-schema-flow/diagnostics'

import { isBlockedIpAddress } from './ip-policy.js'
import type {
  SourceAcquirer,
  SourceAcquisitionContext,
  SourceAcquisitionResult,
} from './source-acquirer.js'
import { createSourceDocument } from './source-document.js'
import type { SourceLocation } from './source-location.js'

export interface NodeSourceAcquirerDependencies {
  readonly readFile?: (path: string) => Promise<Uint8Array>
  readonly realpath?: (path: string) => Promise<string>
  readonly resolveHostname?: (hostname: string) => Promise<readonly string[]>
  readonly fetch?: (input: string, init?: RequestInit) => Promise<Response>
}

function diagnostic(
  code: string,
  message: string,
  uri: string,
  details?: Readonly<Record<string, unknown>>,
): Diagnostic {
  return {
    code,
    severity: 'error',
    message,
    source: { uri, pointer: '#' },
    ...(details === undefined ? {} : { details }),
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function mediaTypeForPath(filePath: string): string | undefined {
  const extension = extname(filePath).toLowerCase()
  if (extension === '.json') return 'application/json'
  if (extension === '.yaml' || extension === '.yml') return 'application/yaml'
  return undefined
}

function decodeUtf8(bytes: Uint8Array, uri: string): string | Diagnostic {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (error) {
    return diagnostic(
      DIAGNOSTIC_CODES.SOURCE_INVALID_UTF8,
      'Source document is not valid UTF-8 text.',
      uri,
      { reason: errorMessage(error) },
    )
  }
}

export function isPathInsideRoot(candidate: string, root: string): boolean {
  const pathFromRoot = relative(root, candidate)
  return (
    pathFromRoot === '' ||
    (pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot))
  )
}

async function defaultResolveHostname(hostname: string): Promise<readonly string[]> {
  if (isIP(hostname) !== 0) return [hostname]
  const addresses = await lookup(hostname, { all: true, verbatim: true })
  return addresses.map(({ address }) => address)
}

function consumeCreatedSource(
  result: ReturnType<typeof createSourceDocument>,
  context: SourceAcquisitionContext,
): SourceAcquisitionResult {
  if (result.source === undefined) return result
  const budgetDiagnostics = context.budget.consumeDocument(
    result.source.uri,
    result.source.byteLength,
  )
  if (budgetDiagnostics.length > 0) return { diagnostics: budgetDiagnostics }
  return result
}

export function createNodeSourceAcquirer(
  dependencies: NodeSourceAcquirerDependencies = {},
): SourceAcquirer {
  const readFileDependency = dependencies.readFile ?? readFile
  const realpathDependency = dependencies.realpath ?? realpath
  const resolveHostname = dependencies.resolveHostname ?? defaultResolveHostname
  const fetchDependency = dependencies.fetch ?? ((input, init) => globalThis.fetch(input, init))

  async function acquireFile(
    location: Extract<SourceLocation, { readonly kind: 'file' }>,
    context: SourceAcquisitionContext,
  ): Promise<SourceAcquisitionResult> {
    try {
      const canonicalPath = await realpathDependency(location.path)
      const allowedRoots = await Promise.all(
        context.policy.allowedFileRoots.map((root) => realpathDependency(root)),
      )

      if (
        allowedRoots.length === 0 ||
        !allowedRoots.some((root) => isPathInsideRoot(canonicalPath, root))
      ) {
        return {
          diagnostics: [
            diagnostic(
              DIAGNOSTIC_CODES.SOURCE_PATH_BLOCKED,
              'Source file resolves outside every allowed root.',
              pathToFileURL(canonicalPath).href,
              { allowedRoots },
            ),
          ],
        }
      }

      const uri = pathToFileURL(canonicalPath).href
      const decoded = decodeUtf8(await readFileDependency(canonicalPath), uri)
      if (typeof decoded !== 'string') return { diagnostics: [decoded] }
      const mediaType = mediaTypeForPath(canonicalPath)
      return consumeCreatedSource(
        createSourceDocument({
          uri,
          contents: decoded,
          maxBytes: context.policy.maxDocumentBytes,
          ...(mediaType === undefined ? {} : { mediaType }),
        }),
        context,
      )
    } catch (error) {
      return {
        diagnostics: [
          diagnostic(
            DIAGNOSTIC_CODES.SOURCE_FETCH_FAILED,
            'Unable to read source file.',
            location.path,
            { reason: errorMessage(error) },
          ),
        ],
      }
    }
  }

  async function acquireUrl(
    location: Extract<SourceLocation, { readonly kind: 'url' }>,
    context: SourceAcquisitionContext,
  ): Promise<SourceAcquisitionResult> {
    let url: URL
    try {
      url = new URL(location.url)
    } catch (error) {
      return {
        diagnostics: [
          diagnostic(DIAGNOSTIC_CODES.SOURCE_FETCH_FAILED, 'Source URL is invalid.', location.url, {
            reason: errorMessage(error),
          }),
        ],
      }
    }

    if (url.username !== '' || url.password !== '') {
      return {
        diagnostics: [
          diagnostic(
            DIAGNOSTIC_CODES.SOURCE_URL_CREDENTIALS,
            'Credentials embedded in source URLs are not allowed.',
            url.href,
          ),
        ],
      }
    }

    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && context.policy.allowHttp)) {
      return {
        diagnostics: [
          diagnostic(
            DIAGNOSTIC_CODES.SOURCE_PROTOCOL_BLOCKED,
            `Source protocol ${url.protocol} is blocked by retrieval policy.`,
            url.href,
          ),
        ],
      }
    }

    try {
      const addresses = await resolveHostname(url.hostname)
      if (
        !context.policy.allowPrivateNetwork &&
        (addresses.length === 0 || addresses.some((address) => isBlockedIpAddress(address)))
      ) {
        return {
          diagnostics: [
            diagnostic(
              DIAGNOSTIC_CODES.SOURCE_PRIVATE_NETWORK_BLOCKED,
              'Source hostname resolves to a non-public network address.',
              url.href,
              { hostname: url.hostname, addresses },
            ),
          ],
        }
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), context.policy.timeoutMs)
      let response: Response
      try {
        response = await fetchDependency(url.href, {
          redirect: 'manual',
          credentials: 'omit',
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }

      if (response.status < 200 || response.status >= 300) {
        return {
          diagnostics: [
            diagnostic(
              DIAGNOSTIC_CODES.SOURCE_HTTP_STATUS,
              `Source URL returned HTTP ${response.status}.`,
              url.href,
              { status: response.status },
            ),
          ],
        }
      }

      const bytes = new Uint8Array(await response.arrayBuffer())
      const decoded = decodeUtf8(bytes, url.href)
      if (typeof decoded !== 'string') return { diagnostics: [decoded] }
      const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim()
      return consumeCreatedSource(
        createSourceDocument({
          uri: url.href,
          contents: decoded,
          maxBytes: context.policy.maxDocumentBytes,
          ...(contentType === undefined || contentType === '' ? {} : { mediaType: contentType }),
        }),
        context,
      )
    } catch (error) {
      return {
        diagnostics: [
          diagnostic(
            DIAGNOSTIC_CODES.SOURCE_FETCH_FAILED,
            'Unable to retrieve source URL.',
            url.href,
            { reason: errorMessage(error) },
          ),
        ],
      }
    }
  }

  return {
    resolveLocation(reference, parentUri) {
      const resolved = new URL(reference, parentUri)
      resolved.hash = ''
      return resolved.protocol === 'file:'
        ? { kind: 'file', path: fileURLToPath(resolved) }
        : { kind: 'url', url: resolved.href }
    },
    async acquire(location, context) {
      const depthDiagnostics = context.budget.checkReferenceDepth(
        location.kind === 'file'
          ? location.path
          : location.kind === 'url'
            ? location.url
            : location.uri,
        context.depth ?? 0,
      )
      if (depthDiagnostics.length > 0) return { diagnostics: depthDiagnostics }

      if (location.kind === 'file') return acquireFile(location, context)
      if (location.kind === 'url') return acquireUrl(location, context)

      const result = createSourceDocument({
        uri: location.uri,
        contents: location.content,
        maxBytes: context.policy.maxDocumentBytes,
        ...(location.mediaType === undefined ? {} : { mediaType: location.mediaType }),
      })
      return consumeCreatedSource(result, context)
    },
  }
}
