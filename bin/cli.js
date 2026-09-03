#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = join(__dirname, '../src/stdio.ts');

const child = spawn(process.execPath, ['--experimental-strip-types', entry], {
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
