const esbuildPluginTsc = require('@emarketeer/esbuild-plugin-tsc')
const fs = require('fs')
const { dirname } = require('path')

const recapDevAutoWrapper = {
  name: 'recap-dev-auto-wrapper',
  setup(build) {
    build.onLoad({ filter: /mysql2\/index.js/ }, async ({ path }) => {
      const originalSource = fs.readFileSync(path, 'utf8')

      return ({
        resolveDir: dirname(path),
        contents: `
          (function() {
    ${originalSource}
  })(...arguments);
  {
  let mod = module.exports;
  const { mysqlQueryWrapper } = require('@recap.dev/client')

  if (mod && mod.Connection && mod.Connection.prototype) {
    mod.Connection.prototype.query = mysqlQueryWrapper(mod.Connection.prototype.query);
    mod.Connection.prototype.execute = mysqlQueryWrapper(mod.Connection.prototype.execute);
  }
  module.exports = mod;
  }
  `,
      })
    })
  },
}

module.exports = [recapDevAutoWrapper, esbuildPluginTsc()]
