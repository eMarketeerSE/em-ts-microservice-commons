"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var YAML = __importStar(require("yaml"));
var lodash_1 = require("lodash");
var common_serverless_1 = require("./common.serverless");
var fs = __importStar(require("fs"));
exports.generateConfig = function () {
    var serviceConfig = YAML.parse(fs.readFileSync('./serverless.yml', 'utf8'));
    var commonConfig = YAML.parse(common_serverless_1.config);
    var generatedConfig = lodash_1.merge(commonConfig, serviceConfig);
    fs.writeFileSync('./generated.serverless.yml', YAML.stringify(generatedConfig));
};
exports.cleanup = function () {
    // fs.unlinkSync('./generated.serverless.yml')
};
//# sourceMappingURL=serverless.utils.js.map