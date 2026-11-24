/**
 * LEGEND-LITE'S ENGINE MODULE IN A WORKER (@legend-lite/engine-worker, wasm/engine-worker): the package's own transport
 * and worker file, run as a host runs them, against the engine module (//wasm:engine_planner_dir). The worker is a Node
 * worker thread dressed as a module worker (engine_worker_shim.mjs); the transport is the package's TypeScript, loaded
 * as written. Each answer is held to the module's own answer to the same call, asked directly.
 *
 *   bazel test //wasm:engine_worker_test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { runfileDirUrl } from '../tools/js/runfiles.mts';
import {
  LegendLiteEngineTransport,
  LegendLiteEngineError,
  unfoldLegendLiteEngineAnswer,
} from './engine-worker/src/LegendLiteEngineTransport.ts';

const dir = runfileDirUrl('WASM_ENGINE_PLANNER');
const RUNTIME_URL = new URL('wasm-gc-module-runtime.js', dir).href;
const MODULE_URL = fileURLToPath(new URL('classes.wasm', dir));
const WORKER_URL = new URL('./engine-worker/src/LegendLiteEngine.worker.ts', import.meta.url).href;
const SHIM = new URL('./engine_worker_shim.mjs', import.meta.url);

// a worker takes the process's Node options; its V8 options (the WebAssembly ones) are the process's already
const NODE_ARGS = process.execArgv.filter((a) => !a.startsWith('--experimental-wasm-'));

/** A connection to a fresh worker thread, as LegendLiteEngineAssets creates one in a page. */
const connect = async () => {
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

/** The module asked directly, in this thread. */
const direct = async () => {
  const { load } = await import(RUNTIME_URL);
  const module = await load(MODULE_URL, {
    stackDeobfuscator: { enabled: false },
    installImports(o) {
      o.teavmConsole = { putcharStdout() {}, putcharStderr() {} };
    },
  });
  return (path, query, body) => unfoldLegendLiteEngineAnswer(module.exports.pureV1OrError(path, query, body));
};

const MODEL = `Class model::Person
{
  name: String[1];
  age: Integer[0..1];
}

function model::greet(p: model::Person[1]): String[1]
{
  'Hello ' + $p.name
}
`;

test('the transport answers each pure/v1 call through the worker as the module answers it', async () => {
  const ask = await direct();
  const transport = new LegendLiteEngineTransport(connect);
  try {
    const calls = [
      ['/api/pure/v1/grammar/grammarToJson/model', 'returnSourceInformation=true', MODEL],
      ['/api/pure/v1/grammar/grammarToJson/model', 'returnSourceInformation=false', MODEL],
      // a refusal is an answer, not a failure: its status and the engine's error JSON
      ['/api/pure/v1/grammar/grammarToJson/model', '', 'Class model::Broken { name: String[1] }'],
    ];
    const parsed = ask(...calls[1]);
    calls.push(['/api/pure/v1/grammar/jsonToGrammar/model', 'renderStyle=STANDARD', parsed.body]);
    calls.push(['/api/pure/v1/compilation/compile', '', parsed.body]);
    // several calls at once, each matched to its own answer
    const answers = await Promise.all(calls.map((c) => transport.pureV1(...c)));
    answers.forEach((answer, i) => assert.deepEqual(answer, ask(...calls[i]), calls[i][0]));
    assert.equal(answers[2].status, 400);
    assert.equal(JSON.parse(answers[2].body).errorType, 'PARSER');
    assert.equal(answers[3].body, MODEL);
    assert.equal(answers[4].body, '{"message":"OK","defects":[]}');
  } finally {
    transport.dispose();
  }
});

test('a module that cannot be loaded fails the call as legend-lite\'s own failure, not as an answer', async () => {
  const transport = new LegendLiteEngineTransport(async () => ({ ...(await connect()), moduleUrl: `${MODULE_URL}.missing` }));
  try {
    await assert.rejects(
      transport.pureV1('/api/pure/v1/grammar/grammarToJson/model', '', MODEL),
      (e) => e instanceof LegendLiteEngineError && e.kind === 'worker' && /classes\.wasm\.missing/.test(e.message),
    );
  } finally {
    transport.dispose();
  }
});
