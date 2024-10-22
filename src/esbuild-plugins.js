const esbuildPluginTsc = require('@emarketeer/esbuild-plugin-tsc')

const recapDevAutoWrapper = {
  name: 'recap-dev-auto-wrapper',
  setup(build) {
    build.onLoad({ filter: 'mysql2' }, async (args) => ({
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
    }))
  },
}

module.exports = [recapDevAutoWrapper, esbuildPluginTsc()]
