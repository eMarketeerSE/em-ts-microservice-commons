const esbuildPluginTsc = require('@emarketeer/esbuild-plugin-tsc')
const fs = require('fs')

const recapDevAutoWrapper = {
  name: 'recap-dev-auto-wrapper',
  setup(build) {
    build.onLoad({ filter: 'mysql2' }, async ({ path }) => {
      const originalSource = fs.readFileSync(path, 'utf8')

      return ({
        contents: `
          (function() {
    ${originalSource}
  })(...arguments);
  {
  mod = module.exports;
  const { mysqlQueryWrapper } = require('@recap.dev/client/dist/lib/module-trackers/mysql')
  module.exports = mysqlQueryWrapper(mod, 'mysql2');

  mod.Connection.prototype.query = mysqlQueryWrapper(mod.Connection.prototype.query);
  mod.Connection.prototype.execute = mysqlQueryWrapper(mod.Connection.prototype.execute);
  module.exports = mod;
  `,
      })
    })
  },
}

module.exports = [recapDevAutoWrapper, esbuildPluginTsc()]
