import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import sourceMaps from 'rollup-plugin-sourcemaps'
import typescript from 'rollup-plugin-typescript2'
import json from 'rollup-plugin-json'
import copy from 'rollup-plugin-copy'
import executable from 'rollup-plugin-executable'
import shebang from '@robmarr/rollup-plugin-shebang'


export default [{
  input: `src/jest.config.ts`,
  output: [
    { dir: 'dist/lib', name: 'jest.config.js', format: 'umd' },
  ],
  plugins: [
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
  input: `src/em-commons.ts`,
  output: [
    { name: 'em-commons.js', format: 'commonjs', file: 'dist/lib/em-commons.js' },
  ],
  external: ['yaml'],
  plugins: [
    copy({
      targets: [
        { src: 'src/global.d.ts', dest: 'dist/' },
        { src: 'src/.eslintrc', dest: 'dist/' },
        { src: 'src/tsconfig.json', dest: 'dist/' },
        { src: 'src/jest.config.json', dest: 'dist/' },
        { src: 'src/esbuild-plugins.js', dest: 'dist/' },
      ]
    }),
    // Allow json resolution
    json(),
    typescript({ useTsconfigDeclarationDir: true, objectHashIgnoreUnknownHack: true }),
    // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
    resolve(),
    commonjs({ transformMixedEsModules: true }),
    // Allow node_modules resolution, so you can use 'external' to control
    // which external modules to include in the bundle
    // https://github.com/rollup/rollup-plugin-node-resolve#usage
    // Resolve source maps to the original source
    sourceMaps(),
    shebang(),
    executable(),
  ],
}]
