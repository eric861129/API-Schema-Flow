import type { Diagnostic } from '@api-schema-flow/diagnostics'

import { cliUsage, forwardSourceOption } from './review-options.js'

export const EXPORT_ARAZZO_USAGE =
  'Usage: schema-flow export-arazzo <openapi-file-or-url> --decisions <decision-set.json> --workflow <workflow-plan.json> [--format yaml|json] [--output <path>] [--force] [--json] [--allow-path <dir>] [--allow-http] [--allow-private-network] [--max-documents <n>] [--max-total-bytes <n>] [--max-ref-depth <n>]'

export interface ExportArazzoCommandOptions {
  readonly target: string
  readonly decisionsPath: string
  readonly workflowPath: string
  readonly format: 'yaml' | 'json'
  readonly outputPath?: string
  readonly force: boolean
  readonly json: boolean
  readonly validateArguments: readonly string[]
}

export interface ParseExportArazzoArgumentsResult {
  readonly options?: ExportArazzoCommandOptions
  readonly diagnostics: readonly Diagnostic[]
}

export function parseExportArazzoArguments(
  argv: readonly string[],
): ParseExportArazzoArgumentsResult {
  if (argv[0] !== 'export-arazzo')
    return cliUsage<ExportArazzoCommandOptions>('Expected the export-arazzo command.')
  const target = argv[1]
  if (target === undefined || target.startsWith('--'))
    return cliUsage<ExportArazzoCommandOptions>(EXPORT_ARAZZO_USAGE)

  let decisionsPath: string | undefined
  let workflowPath: string | undefined
  let format: 'yaml' | 'json' = 'yaml'
  let outputPath: string | undefined
  let force = false
  let json = false
  const validateArguments = ['validate', target]

  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index]!
    if (argument === '--json') {
      json = true
      continue
    }
    if (argument === '--force') {
      force = true
      continue
    }
    if (argument === '--decisions' || argument === '--workflow' || argument === '--output') {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) {
        return cliUsage<ExportArazzoCommandOptions>(`${argument} requires a value.`)
      }
      if (argument === '--decisions') decisionsPath = value
      else if (argument === '--workflow') workflowPath = value
      else outputPath = value
      index += 1
      continue
    }
    if (argument === '--format') {
      const value = argv[index + 1]
      if (value !== 'yaml' && value !== 'json') {
        return cliUsage<ExportArazzoCommandOptions>('--format must be yaml or json.')
      }
      format = value
      index += 1
      continue
    }
    const forwarded = forwardSourceOption(argv, index, validateArguments)
    if (forwarded.error !== undefined) return cliUsage<ExportArazzoCommandOptions>(forwarded.error)
    if (forwarded.handled) {
      index = forwarded.nextIndex
      continue
    }
    return cliUsage<ExportArazzoCommandOptions>(`Unknown option ${argument}.`)
  }

  if (decisionsPath === undefined) {
    return cliUsage<ExportArazzoCommandOptions>(`${EXPORT_ARAZZO_USAGE}; --decisions is required.`)
  }
  if (workflowPath === undefined) {
    return cliUsage<ExportArazzoCommandOptions>(`${EXPORT_ARAZZO_USAGE}; --workflow is required.`)
  }
  if (force && outputPath === undefined)
    return cliUsage<ExportArazzoCommandOptions>('--force requires --output.')

  return {
    options: {
      target,
      decisionsPath,
      workflowPath,
      format,
      ...(outputPath === undefined ? {} : { outputPath }),
      force,
      json,
      validateArguments,
    },
    diagnostics: [],
  }
}
