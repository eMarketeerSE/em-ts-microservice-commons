const TerserPlugin = require('terser-webpack-plugin')

const path = require('path')
const webpack = require('webpack')

const optionalDependencies = ['pg', 'mysql2']
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
    'mysql',
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
  target: 'node',
  resolveLoader: {
    modules: ['node_modules/@emarketeer/ts-microservice-commons/node_modules', 'node_modules']
  },
  resolve: {
    extensions: ['.js', '.json', '.ts', '.tsx', '.mjs', '.node']
  },
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js'
  },
  node: {
    __dirname: false
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        minify: TerserPlugin.swcMinify,
        terserOptions: {
          minify: true
        }
      })
    ]
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
          }
        ]
      },
      {
        test: /\.ts(x?)$/,
        include: path.resolve(__dirname, 'src'),
        use: [
          {
            loader: 'babel-loader',
            options: {
              plugins: [
                '@babel/plugin-syntax-typescript',
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
      },
      {
        test: /\.node$/,
        loader: 'native-addon-loader'
      }
    ]
  }
}
