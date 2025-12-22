// Example usage of spawn_guard
const { spawn } = require('child_process');
const guard = require('./spawn_guard');

const cmd = 'uvx';

if (!guard.isAvailable(cmd, { useDiskCache: true })) {
  console.log(`[example] '${cmd}' not available; skipping spawn and logging a one-line warning.`);
  process.exit(0);
}

const child = spawn(cmd, ['--version'], { stdio: 'inherit' });
child.on('exit', (code) => console.log('child exit', code));
