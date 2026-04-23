// Ambient shim: em-commons doesn't depend on @eMarketeerSE/runtime-commons.
// Consuming services provide it at runtime; Rollup marks it external at build
// time; this declaration lets TS type-check the warmup file in isolation.
declare module '@eMarketeerSE/runtime-commons' {
  export const preloadMikroOrmModules: () => Promise<void>
}
