#!/usr/bin/env node

import { runCli } from '../dist/index.js'

const exitCode = await runCli(process.argv.slice(2), {}, {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message),
})

process.exitCode = exitCode
