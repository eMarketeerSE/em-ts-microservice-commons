#!/usr/bin/env node
"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = __importStar(require("fs"));
var utils_1 = require("./utils");
process.on('unhandledRejection', function (err) {
    throw err;
});
var args = process.argv.slice(2);
var supportedCommands = ['lint', 'deploy', 'tsc', 'jest'];
var scriptIndex = args.findIndex(function (x) { return supportedCommands.indexOf(x) !== -1; });
var script = scriptIndex === -1 ? args[0] : args[scriptIndex];
var scriptArgs = args.slice(scriptIndex + 1);
var result;
try {
    if (script === 'lint') {
        utils_1.copyTsConfig();
        result = utils_1.runCommand('npx eslint -c node_modules/em-ts-microservice-commons/dist/.eslintrc', scriptArgs);
    }
    if (script === 'deploy') {
        utils_1.generateServerlessConfig();
        utils_1.copyTsConfig();
        result = utils_1.runCommand('npx cross-env NODE_OPTIONS=--max_old_space_size=4096 npx serverless deploy --config generated.serverless.yml', scriptArgs);
        fs.unlinkSync('./tsconfig.json');
    }
    if (script === 'tsc') {
        utils_1.copyTsConfig();
        result = utils_1.runCommand('npx tsc --noEmit', scriptArgs);
    }
    if (script === 'jest') {
        utils_1.copyTsConfig();
        result = utils_1.runCommand('npx jest --config node_modules/em-ts-microservice-commons/dist/jest.config.json', scriptArgs);
    }
}
finally {
    utils_1.cleanup();
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