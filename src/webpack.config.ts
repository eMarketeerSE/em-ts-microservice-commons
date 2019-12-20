const path = require('path')
const slsw = require('serverless-webpack')

module.exports = {
  entry: slsw.lib.entries,
  externals: [/aws-sdk/],
  mode: 'development',
  target: 'node',
  resolve: {
    extensions: ['.js', '.json', '.ts', '.tsx', '.mjs']
  },
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        test: /\.ts(x?)$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: './node_modules/em-ts-microservice-commons/dist/tsconfig.json'
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
