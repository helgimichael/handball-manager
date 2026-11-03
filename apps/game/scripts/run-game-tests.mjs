// Run the existing, explicitly selected suite without cmd.exe's 8191-character
// command limit. The manifest retains the existing canonical suite and lets
// package.json invoke this wrapper without recursively reading its own command.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const project = fileURLToPath(new URL('../', import.meta.url));
const files = JSON.parse(readFileSync(new URL('./game-test-files.json', import.meta.url), 'utf8'));
if (!Array.isArray(files) || files.length === 0 || !files.every(file => typeof file === 'string' && file.endsWith('.test.ts'))) throw new Error('Expected the canonical game test manifest.');
const args = ['--import', './scripts/register-asset-loader.cjs', '--import', 'tsx', '--test', ...files];
// Windows editor fixtures share files; serialize them for an isolated release run.
const concurrency = Number(process.env.HM_GAME_TEST_CONCURRENCY ?? 4);
if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('Invalid game test concurrency.');
args.splice(args.indexOf('--test') + 1, 0, `--test-concurrency=${concurrency}`);
const child = spawn(process.execPath, args, { cwd:project, stdio:'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
