/// <reference types="node" />
export declare const generateServerlessConfig: () => void;
export declare const cleanup: () => void;
export declare const runCommand: (command: string, additionalArgs?: string[]) => import("child_process").SpawnSyncReturns<Buffer>;
