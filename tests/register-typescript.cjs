const fs = require('node:fs')
const ts = require('typescript')

function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, 'utf8')
  const result = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  })
  module._compile(result.outputText, filename)
}

require.extensions['.ts'] = compileTypeScript
require.extensions['.tsx'] = compileTypeScript
