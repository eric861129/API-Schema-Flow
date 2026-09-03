import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { generateReservationWorkspace, outputPath } from './generate-web-workspace.mjs'

const directory = await mkdtemp(join(tmpdir(), 'api-schema-flow-web-fixture-'))
const candidate = join(directory, 'reservation-workspace.json')
try {
  await generateReservationWorkspace(candidate)
  const [expected, actual] = await Promise.all([readFile(outputPath), readFile(candidate)])
  if (!expected.equals(actual)) {
    throw new Error('Web fixture drift detected. Run: pnpm generate:web-fixture')
  }
  console.log('Web workspace fixture is deterministic and current.')
} finally {
  await rm(directory, { recursive: true, force: true })
}
