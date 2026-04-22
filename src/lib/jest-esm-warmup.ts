// Runs at worker module-load phase (before beforeAll) when
// EM_JEST_ESM_FRIENDLY=true. Populates runtime-commons' internal
// MikroORM / MySqlDriver closure variables so its lazy loader's
// `if (!MikroORM)` short-circuits during test execution — the
// dynamic import() never fires, so Jest's ESM teardown invariant
// can't race it.
import { preloadMikroOrmModules } from '@eMarketeerSE/runtime-commons'

await preloadMikroOrmModules()
