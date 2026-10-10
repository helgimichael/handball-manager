// Read source at the retained v2.1 checkpoint into a private module loader.
// Does not checkout, stash, overwrite source files, or touch the motion worktree.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const pinned = new Map();
for (const file of ['actions','state','structure','transitions','interactions']) {
  const relative = `packages/handball-engine/src/v2/core/${file}.ts`;
  pinned.set(path.join(root, relative).toLowerCase(), execFileSync('git',['show',`357f311:${relative}`],{cwd:root,encoding:'utf8'}));
}
const production='apps/game/lib/career/productionMatch.ts';
pinned.set(path.join(root,production).toLowerCase(),execFileSync('git',['show',`357f311:${production}`],{cwd:root,encoding:'utf8'}));
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(pinned.get(filename.toLowerCase())??fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,filename);
process.env.HM_MOTION_PINNED='1';
require('./match-motion-diagnostics.ts');
