#!/usr/bin/env node
"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var cross_spawn_1 = __importDefault(require("cross-spawn"));
var serverless_utils_1 = require("./serverless.utils");
var fs = __importStar(require("fs"));
process.on('unhandledRejection', function (err) {
    throw err;
});
var args = process.argv.slice(2);
var scriptIndex = args.findIndex(function (x) { return x === 'lint' || x === 'deploy' || x === 'tsc'; });
var script = scriptIndex === -1 ? args[0] : args[scriptIndex];
var scriptArgs = args.slice(scriptIndex + 1);
var result;
if (script === 'lint') {
    console.log('running npx', __spreadArrays(['eslint', '-c', 'node_modules/em-ts-microservice-commons/dist/.eslintrc'], scriptArgs).join(' '));
    result = cross_spawn_1.default.sync('npx', __spreadArrays(['eslint', '-c', 'node_modules/em-ts-microservice-commons/dist/.eslintrc'], scriptArgs), { stdio: 'inherit' });
}
if (script === 'deploy') {
    serverless_utils_1.generateConfig();
    console.log('running cross-env NODE_OPTIONS=--max_old_space_size=4096 npx serverless deploy --config generated.serverless.yml');
    fs.copyFileSync('node_modules/em-ts-microservice-commons/dist/tsconfig.json', '.');
    result = cross_spawn_1.default.sync('npx', __spreadArrays([
        'cross-env',
        'NODE_OPTIONS=--max_old_space_size=4096',
        'npx',
        'serverless',
        'deploy',
        '--config',
        'generated.serverless.yml'
    ], scriptArgs), { stdio: 'inherit' });
    fs.unlinkSync('./tsconfig.json');
    serverless_utils_1.cleanup();
}
if (result && result.signal) {
    if (result.signal === 'SIGKILL') {
        console.log('The build failed because the process exited too early. ' +
            'This probably means the system ran out of memory or someone called ' +
            '`kill -9` on the process.');
    }
    else if (result.signal === 'SIGTERM') {
        console.log('The build failed because the process exited too early. ' +
            'Someone might have called `kill` or `killall`, or the system could ' +
            'be shutting down.');
    }
    process.exit(result.status);
}
process.exit(0);
//# sourceMappingURL=em-commons.js.map