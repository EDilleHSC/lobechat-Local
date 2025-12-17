const { spawnSync } = require('child_process');

const CANDIDATES = [
  { cmd: 'python', args: ['--version'] },
  { cmd: 'python', args: ['-c', 'import sys, json; print(sys.version.split()[0])'] },
  { cmd: 'python3', args: ['--version'] },
  { cmd: 'python3', args: ['-c', 'import sys, json; print(sys.version.split()[0])'] },
  { cmd: 'py', args: ['-3', '--version'] },
  { cmd: 'py', args: ['-3', '-c', 'import sys, json; print(sys.version.split()[0])'] }
];

const MIN_MAJOR = 3;
const MIN_MINOR = 9;

function runCheck() {
  console.log('Runtime restore check: verifying Python presence and version...');

  for (const candidate of CANDIDATES) {
    try {
      const res = spawnSync(candidate.cmd, candidate.args, { encoding: 'utf8', timeout: 5000 });
      if (res.error) {
        // command not found or similar
        // console.log(`Candidate ${candidate.cmd} failed: ${res.error.message}`);
        continue;
      }

      const out = (res.stdout || '') + (res.stderr || '');
      if (!out || out.trim().length === 0) continue;

      // Extract version string like 3.12.0
      const verMatch = out.match(/(\d+\.\d+(?:\.\d+)?)/);
      if (!verMatch) continue;

      const versionStr = verMatch[1];
      const parts = versionStr.split('.').map(n => parseInt(n, 10));
      const major = parts[0] || 0;
      const minor = parts[1] || 0;

      console.log(`Found Python candidate: ${candidate.cmd} ${candidate.args.join(' ')} -> version ${versionStr}`);

      if (major > MIN_MAJOR || (major === MIN_MAJOR && minor >= MIN_MINOR)) {
        console.log(`Python version satisfies required >= ${MIN_MAJOR}.${MIN_MINOR} (${versionStr})`);
        console.log('Additionally, running import json check...');
        // Verify import json
        const imp = spawnSync(candidate.cmd, ['-c', 'import json; print("OK")'], { encoding: 'utf8', timeout: 5000 });
        if (imp.error) {
          console.error('Import test failed:', imp.error.message);
          continue;
        }
        const impOut = (imp.stdout || '') + (imp.stderr || '');
        if (impOut.indexOf('OK') !== -1) {
          console.log('Import json check passed. Runtime restore check SUCCESS.');
          process.exit(0);
        } else {
          console.error('Import json check did not return OK. Output:', impOut);
        }
      } else {
        console.warn(`Found Python ${versionStr} but does not meet minimum version >= ${MIN_MAJOR}.${MIN_MINOR}`);
      }
    } catch (e) {
      // ignore candidate
    }
  }

  console.error('\nRuntime restore check FAILED: No acceptable Python interpreter found.');
  console.error(`Requirements: Python >= ${MIN_MAJOR}.${MIN_MINOR}, and 'import json' must succeed.`);
  console.error('Suggested fixes: install Python 3.9+ and ensure `python` or `py -3` is on PATH, or configure CI runner accordingly.');
  process.exit(2);
}

runCheck();
