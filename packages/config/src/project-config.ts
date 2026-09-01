import { DIAGNOSTIC_CODES, type Diagnostic } from '@api-schema-flow/diagnostics'
import { z } from 'zod'

export interface FileProjectSource {
  readonly type: 'file'
  readonly path: string
}

export interface ProjectConfigV1 {
  readonly schemaVersion: '1.0'
  readonly project: {
    readonly name: string
  }
  readonly sources: readonly FileProjectSource[]
}

export interface ParseProjectConfigResult {
  readonly config?: ProjectConfigV1
  readonly diagnostics: readonly Diagnostic[]
}

const fileSourceSchema = z
  .object({
    type: z.literal('file'),
    path: z.string().trim().min(1),
  })
  .strict()

const projectConfigSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    project: z
      .object({
        name: z.string().trim().min(1),
      })
      .strict(),
    sources: z.array(fileSourceSchema),
  })
  .strict()

export function parseProjectConfig(
  input: unknown,
  sourceUri = 'schema-flow.config.json',
): ParseProjectConfigResult {
  const parsed = projectConfigSchema.safeParse(input)
  if (parsed.success) {
    return {
      config: parsed.data as ProjectConfigV1,
      diagnostics: [],
    }
  }

  return {
    diagnostics: [
      {
        code: DIAGNOSTIC_CODES.CONFIG_INVALID,
        severity: 'error',
        message: 'Project configuration does not match schema version 1.0.',
        source: { uri: sourceUri, pointer: '#' },
        details: {
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            code: issue.code,
            message: issue.message,
          })),
        },
      },
    ],
  }
}
