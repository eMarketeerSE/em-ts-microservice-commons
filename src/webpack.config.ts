const path = require('path')
const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin')

const optionalDependencies = ['pg']
const additionalExternals = []

for (const optionalDependency of optionalDependencies) {
  try {
    require(optionalDependency)
  } catch (err) {
    additionalExternals.push(optionalDependency)
    console.log(`Adding missing depdendency ${optionalDependency} to externals`)
  }
}

module.exports = {
  externals: [
    /^aws-sdk.*/,
    'sqlite3',
    'mysql2',
    'mssql',
    'tedious',
    'mssql/lib/base',
    'mssql/package.json',
    'mariasql',
    'oracle',
    'strong-oracle',
    'oracledb',
    'pg-query-stream',
    ...additionalExternals
  ],
  mode: 'production',
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        cache: true,
        parallel: true,
        sourceMap: true,
        terserOptions: {
          // Preventing mangling of function names fixes "Received packet in the wrong sequence" bug
          // See https://github.com/mysqljs/mysql/issues/1655 and https://github.com/mysqljs/mysql/pull/2375/files
          keep_fnames: /Packet|ChangeUser|Handshake|Ping|Query|Quit|Sequence|Statistics/
        }
      })
    ]
  },
  target: 'node',
  resolveLoader: {
    modules: ['node_modules/@emarketeer/ts-microservice-commons/node_modules', 'node_modules']
  },
  resolve: {
    extensions: ['.js', '.json', '.ts', '.tsx', '.mjs']
  },
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js'
  },
  plugins: [new webpack.IgnorePlugin(/^pg-native$/)],
  module: {
    rules: [
      {
        test: /\.ts(x?)$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true
            }
          },
          {
            loader: 'babel-loader',
            options: {
              plugins: [
                '@babel/plugin-syntax-typescript',
                '@babel/plugin-syntax-optional-chaining',
                '@babel/plugin-syntax-numeric-separator',
                '@babel/plugin-syntax-async-generators',
                ['@babel/plugin-syntax-decorators', { decoratorsBeforeExport: true }],
                ['@babel/plugin-syntax-class-properties', { loose: true }],
                '@babel/plugin-syntax-object-rest-spread',
                '@recap.dev/babel-plugin'
              ]
            }
          }
        ]
      },
      {
        type: 'javascript/auto',
        test: /\.mjs$/,
        use: []
      }
    ]
  }
}
