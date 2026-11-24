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
import {
  LegendLiteEngineTransport,
  LegendLiteEngineError,
} from './engine-worker/src/LegendLiteEngineTransport.ts';
import { connect, direct, MODULE_URL } from './engine_worker_host.mjs';

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
