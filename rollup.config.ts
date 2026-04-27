import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import sourceMaps from 'rollup-plugin-sourcemaps'
import typescript from 'rollup-plugin-typescript2'
import json from 'rollup-plugin-json'
import copy from 'rollup-plugin-copy'
import executable from 'rollup-plugin-executable'
import shebang from '@robmarr/rollup-plugin-shebang'

const externalPkgs = [
  /^aws-cdk-lib(\/.*)?$/,
  /^constructs(\/.*)?$/,
  /^@aws-cdk(\/.*)?$/
]

export default [{
  input: `src/cdk/index.ts`,
  external: (id) => id === 'crypto' || id === 'path' || externalPkgs.some((x) => (x instanceof RegExp ? x.test(id) : x === id)),
  output: [
    { dir: 'dist/cdk', format: 'esm', sourcemap: true },
    { dir: 'dist/cdk/cjs', format: 'cjs', sourcemap: true },
  ],
  plugins: [
    json(),
    resolve({ preferBuiltins: true, extensions: ['.ts', '.tsx', '.js', '.json'] }),
    commonjs(),
    typescript({
      useTsconfigDeclarationDir: true,
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      tsconfigOverride: {
        compilerOptions: {
          target: 'ES2020'
        },
      },
    }),
    sourceMaps(),
  ],
}, {
  input: `src/jest.config.ts`,
  output: [
    { dir: 'dist/lib', name: 'jest.config.js', format: 'umd' },
  ],
  plugins: [
    // Allow json resolution
    json(),
    resolve({ extensions: ['.ts', '.tsx', '.js', '.json'] }),
    // Compile TypeScript files
    typescript({
      useTsconfigDeclarationDir: true,
      include: ['src/**/*.ts', 'src/**/*.tsx'],
    }),
    // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
    commonjs(),

    // Resolve source maps to the original source
    sourceMaps()
  ],
}, {
  input: `src/build-handlers.ts`,
  output: [
    { file: 'dist/build-handlers.js', format: 'commonjs' },
  ],
  external: ['path', 'fs', 'esbuild', './esbuild-plugins'],
  plugins: [
    resolve({ preferBuiltins: true, extensions: ['.ts', '.tsx', '.js', '.json'] }),
    commonjs(),
    typescript({
      useTsconfigDeclarationDir: true,
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      tsconfigOverride: {
        compilerOptions: {
          target: 'ES2020'
        }
      }
    }),
    sourceMaps(),
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
        { src: 'src/cdk/tsconfig.json', dest: 'dist/cdk/' },
        { src: 'src/cdk/.eslintrc', dest: 'dist/cdk/' },
        { src: 'src/cdk/jest.config.js', dest: 'dist/cdk/' },
      ]
    }),
    // Allow json resolution
    json(),
    resolve({ extensions: ['.ts', '.tsx', '.js', '.json'] }),
    commonjs({ transformMixedEsModules: true }),
    typescript({
      useTsconfigDeclarationDir: true,
      include: ['src/**/*.ts', 'src/**/*.tsx'],
    }),
    // Resolve source maps to the original source
    sourceMaps(),
    shebang(),
    executable(),
  ],
}]
