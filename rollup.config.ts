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
    resolve({ preferBuiltins: true }),
    commonjs(),
    typescript({
      useTsconfigDeclarationDir: true,
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
    // Compile TypeScript files
    typescript({ useTsconfigDeclarationDir: true }),
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
  input: `src/build-handlers.ts`,
  output: [
    { file: 'dist/build-handlers.js', format: 'commonjs' },
  ],
  external: ['path', 'fs', 'esbuild', './esbuild-plugins'],
  plugins: [
    typescript({
      useTsconfigDeclarationDir: true,
      tsconfigOverride: {
        compilerOptions: {
          target: 'ES2020'
        }
      }
    }),
    resolve({ preferBuiltins: true }),
    commonjs(),
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
    typescript({ useTsconfigDeclarationDir: true }),
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
}, {
  input: 'src/lib/jest-esm-warmup.ts',
  external: ['@eMarketeerSE/runtime-commons'],
  output: [
    // .mjs so Node/Jest parse as ESM regardless of em-commons' CJS package
    // scope — a .js file here would fail: em-commons' package.json has no
    // "type": "module", so Node's nearest-package-scope rule treats .js as
    // CJS and rejects `import` + top-level await.
    { file: 'dist/lib/jest-esm-warmup.mjs', format: 'esm', sourcemap: true },
  ],
  plugins: [
    typescript({
      useTsconfigDeclarationDir: true,
      tsconfigOverride: {
        compilerOptions: {
          target: 'ES2022',
          module: 'esnext',
        },
      },
    }),
    sourceMaps(),
  ],
}]
