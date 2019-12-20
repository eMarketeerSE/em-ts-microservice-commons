import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import sourceMaps from 'rollup-plugin-sourcemaps'
import typescript from 'rollup-plugin-typescript2'
import json from 'rollup-plugin-json'
import copy from 'rollup-plugin-copy'
import executable from 'rollup-plugin-executable'
import { string } from 'rollup-plugin-string'

export default [{
  input: `src/webpack.config.ts`,
  output: [
    { name: 'webpack.config.js', format: 'umd' },
  ],
  plugins: [
    copy({
      targets: [
        { src: 'src/.eslintrc', dest: 'dist/' },
      ]
    }),
    // Allow json resolution
    json(),
    // Compile TypeScript files
    typescript({ useTsconfigDeclarationDir: true, objectHashIgnoreUnknownHack: true }),
    // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
    commonjs(),
    // Allow node_modules resolution, so you can use 'external' to control
    // which external modules to include in the bundle
    // https://github.com/rollup/rollup-plugin-node-resolve#usage
    resolve(),

    // Resolve source maps to the original source
    sourceMaps()
  ],
}, {
  input: `bin/em-commons.ts`,
  output: [
    { name: 'bin/em-commons.js', format: 'commonjs' },
  ],
  plugins: [
    executable(),
    copy({
      targets: [
        { src: 'src/.eslintrc', dest: 'dist/' },
      ]
    }),
    // Allow json resolution
    json(),
    string({
      // Required to be specified
      include: "**/*.yml",
    }),
    // Compile TypeScript files
    typescript({ useTsconfigDeclarationDir: true, objectHashIgnoreUnknownHack: true, include: '"*.js+(|x)"' }),
    // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
    commonjs(),
    // Allow node_modules resolution, so you can use 'external' to control
    // which external modules to include in the bundle
    // https://github.com/rollup/rollup-plugin-node-resolve#usage
    resolve(),

    // Resolve source maps to the original source
    sourceMaps()
  ],
}]
