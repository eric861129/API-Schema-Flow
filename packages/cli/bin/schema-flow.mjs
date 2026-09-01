#!/usr/bin/env node

import { readFile } from 'node:fs/promises'

import { runCli } from '../dist/index.js'

const exitCode = await runCli(
  process.argv.slice(2),
  { readFile: (path) => readFile(path, 'utf8') },
  {
    stdout: (message) => process.stdout.write(message),
    stderr: (message) => process.stderr.write(message),
  },
)

process.exitCode = exitCode
