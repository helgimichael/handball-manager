// Run every canonical selected game test once. Filesystem writers run separately
// so shared editor fixtures cannot race each other or readers on Windows.
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const project=fileURLToPath(new URL('../',import.meta.url));
const [command,...args]=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).scripts.test.split(/\s+/);
if(command!=='node'||!args.includes('--test'))throw Error('Expected canonical node test manifest');
const first=args.findIndex(a=>a.endsWith('.test.ts')),bootstrap=args.slice(0,first),files=args.slice(first);
if(files.some(f=>!f.endsWith('.test.ts')))throw Error('Unexpected test manifest argument');
const writers=files.filter(f=>f.startsWith('lib/editor/')||/\b(?:writeFile(?:Sync)?|mkdir(?:Sync)?|rename(?:Sync)?|unlink(?:Sync)?|rmSync|mkdtemp(?:Sync)?)\b/.test(readFileSync(new URL('../'+f,import.meta.url),'utf8')));
const readers=files.filter(f=>!writers.includes(f));
async function run(label,selected,concurrency){console.log(`${label}: ${selected.length} files, concurrency ${concurrency}`);const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[...bootstrap,`--test-concurrency=${concurrency}`,...selected],{cwd:project,stdio:'inherit'});child.once('error',reject);child.once('exit',resolve);});if(code!==0)process.exit(Number(code)||1);}
await run('Canonical reader/domain and Match Center suite',readers,4);
await run('Isolated filesystem/editor suite',writers,1);
console.log(`COMPLETE: all ${files.length} canonical game test files executed exactly once.`);
