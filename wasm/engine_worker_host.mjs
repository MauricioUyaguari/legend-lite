/**
 * The engine module in a worker, hosted in Node as a page hosts it, for the lanes of @legend-lite/engine-worker and
 * @legend-lite/studio-extension (engine_worker.mjs, studio_local_engine.mjs): a connection to a fresh worker thread
 * running the package's own worker file (dressed as a module worker, engine_worker_shim.mjs), and the module asked
 * directly, in this thread, for the answers to hold them to.
 */
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { runfileDirUrl } from '../tools/js/runfiles.mts';
import { unfoldLegendLiteEngineAnswer } from './engine-worker/src/LegendLiteEngineTransport.ts';

const dir = runfileDirUrl('WASM_ENGINE_PLANNER');
export const RUNTIME_URL = new URL('wasm-gc-module-runtime.js', dir).href;
export const MODULE_URL = fileURLToPath(new URL('classes.wasm', dir));
const WORKER_URL = new URL('./engine-worker/src/LegendLiteEngine.worker.ts', import.meta.url).href;
const SHIM = new URL('./engine_worker_shim.mjs', import.meta.url);

// a worker takes the process's Node options; its V8 options (the WebAssembly ones) are the process's already
const NODE_ARGS = process.execArgv.filter((a) => !a.startsWith('--experimental-wasm-'));

/** A connection to a fresh worker thread, as LegendLiteEngineAssets creates one in a page. */
export const connect = async () => {
  const worker = new Worker(SHIM, { workerData: { workerUrl: WORKER_URL }, execArgv: NODE_ARGS });
  return {
    port: {
      send: (request) => worker.postMessage(request),
      listen: (onResponse, onFailure) => {
        worker.on('message', onResponse);
        worker.on('error', (error) => onFailure(error.message));
      },
      close: () => void worker.terminate(),
    },
    runtimeUrl: RUNTIME_URL,
    moduleUrl: MODULE_URL,
  };
};

/** The module asked directly, in this thread: (path, query, body) to its unfolded answer. */
export const direct = async () => {
  const { load } = await import(RUNTIME_URL);
  const module = await load(MODULE_URL, {
    stackDeobfuscator: { enabled: false },
    installImports(o) {
      o.teavmConsole = { putcharStdout() {}, putcharStderr() {} };
    },
  });
  return (path, query, body) => unfoldLegendLiteEngineAnswer(module.exports.pureV1OrError(path, query, body));
};
