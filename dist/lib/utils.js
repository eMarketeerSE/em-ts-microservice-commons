"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var YAML = __importStar(require("yaml"));
var lodash_1 = require("lodash");
var fs = __importStar(require("fs"));
var cross_spawn_1 = __importDefault(require("cross-spawn"));
var common_serverless_1 = require("./common.serverless");
var mergeCustomizer = function (objValue, srcValue) {
    if (lodash_1.isArray(objValue)) {
        return lodash_1.uniq(objValue.concat(srcValue));
    }
};
exports.generateServerlessConfig = function () {
    var serviceConfig = YAML.parse(fs.readFileSync('./serverless.yml', 'utf8'));
    var commonConfig = YAML.parse(common_serverless_1.config);
    var generatedConfig = lodash_1.mergeWith(commonConfig, serviceConfig, mergeCustomizer);
    fs.writeFileSync('./generated.serverless.yml', YAML.stringify(generatedConfig));
};
exports.copyTsConfig = function () {
    fs.copyFileSync('node_modules/em-ts-microservice-commons/dist/tsconfig.json', './tsconfig.json');
};
exports.cleanup = function () {
    if (fs.existsSync('./generated.serverless.yml')) {
        fs.unlinkSync('./generated.serverless.yml');
    }
    if (fs.existsSync('./tsconfig.json')) {
        fs.unlinkSync('./tsconfig.json');
    }
};
exports.runCommand = function (command, additionalArgs) {
    if (additionalArgs === void 0) { additionalArgs = []; }
    console.log('running ', command);
    var commandParts = command.split(' ');
    var program = commandParts[0];
    var args = commandParts.slice(1).concat(additionalArgs);
    return cross_spawn_1.default.sync(program, args, { stdio: 'inherit' });
};
//# sourceMappingURL=utils.js.map