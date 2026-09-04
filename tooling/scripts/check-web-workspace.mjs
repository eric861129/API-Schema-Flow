import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { generateReservationWorkspace, outputPath } from './generate-web-workspace.mjs'

const directory = await mkdtemp(join(tmpdir(), 'api-schema-flow-web-fixture-'))
const firstCandidate = join(directory, 'reservation-workspace-first.json')
const secondCandidate = join(directory, 'reservation-workspace-second.json')

try {
  await generateReservationWorkspace(firstCandidate)
  await generateReservationWorkspace(secondCandidate)

  const [expected, first, second] = await Promise.all([
    readFile(outputPath),
    readFile(firstCandidate),
    readFile(secondCandidate),
  ])

  if (!first.equals(second)) {
    throw new Error('Web fixture generation is non-deterministic across repeated runs.')
  }
  if (!expected.equals(first)) {
    throw new Error('Web fixture drift detected. Run: pnpm generate:web-fixture')
  }

  console.log('Review Workspace Snapshot 1.1 fixture is deterministic and current.')
} finally {
  await rm(directory, { recursive: true, force: true })
}
