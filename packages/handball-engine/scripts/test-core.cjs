const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'), {fileName: filename, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  }}).outputText, filename);
require('../src/v2/core/core.test.ts');
require('../src/v2/core/continuous.test.ts');
require('../src/v2/core/contact.test.ts');
require('../src/v2/core/wing.test.ts');
require('../src/v2/core/backcourt.test.ts');
require('../src/v2/core/referee.test.ts');
require('../src/v2/core/passive.test.ts');
require('../src/v2/core/ecosystem.test.ts');
require('../src/v2/core/offence.test.ts');
require('../src/v2/core/identity.test.ts');
require('../src/v2/core/defence.test.ts');
