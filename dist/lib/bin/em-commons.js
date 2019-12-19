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
Object.defineProperty(exports, "__esModule", { value: true });
var cross_spawn_1 = __importDefault(require("cross-spawn"));
process.on('unhandledRejection', function (err) {
    throw err;
});
var args = process.argv.slice(2);
var scriptIndex = args.findIndex(function (x) { return x === 'lint' || x === 'deploy' || x === 'tsc'; });
console.log('args: ', JSON.stringify(args));
var script = scriptIndex === -1 ? args[0] : args[scriptIndex];
console.log('script index: ', scriptIndex);
var scriptArgs = scriptIndex > 0 ? args.slice(scriptIndex) : [];
console.log('script args: ', scriptArgs);
var result;
if (script === 'lint') {
    console.log('running npx', __spreadArrays(['eslint', '-c', 'node_modules/em-ts-microservice-commons/dist/.eslintrc'], scriptArgs).join(' '));
    result = cross_spawn_1.default.sync('npx', __spreadArrays(['eslint', '-c', 'node_modules/em-ts-microservice-commons/dist/lib/.eslintrc'], scriptArgs), { stdio: 'inherit' });
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
process.exit(1);
//# sourceMappingURL=em-commons.js.map