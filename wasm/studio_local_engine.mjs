/**
 * LEGEND-LITE AS LEGEND STUDIO'S LOCAL ENGINE (@legend-lite/studio-extension, wasm/studio-extension; Studio's local
 * mode, phase 0 of docs/LEGEND_STUDIO_TEXT_MODE_PLAN_2026_11_23.md): the plugin's engine, asked as Studio's local-mode
 * router asks a local engine (LegendStudioLocalEngine: answer(route, {query, body}), isAvailable(), isRefusal()), over
 * the package's worker and the engine module (//wasm:engine_planner_dir). Each answer is held to the module's own; a
 * model goes round Studio's text mode (parse, compose, parse again) and compiles.
 *
 *   bazel test //wasm:studio_local_engine_test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LegendLiteEngineTransport } from './engine-worker/src/LegendLiteEngineTransport.ts';
import { LegendLiteLocalEngine, isLegendLiteRefusal } from './studio-extension/src/LegendLiteLocalEngine.ts';
import { connect, direct, MODULE_URL } from './engine_worker_host.mjs';

const MODELS = {
  'a class and a function': `Class model::Person
{
  name: String[1];
  age: Integer[0..1];
}

function model::greet(p: model::Person[1]): String[1]
{
  'Hello ' + $p.name
}
`,
  // composed alike by legend-engine 4.152.1-SNAPSHOT and lite, and compiled by both (2026-11-24)
  'a store, a mapping, a connection and a runtime': `###Relational
Database store::TradesDb
(
  Table TRADES
  (
    ID INTEGER PRIMARY KEY,
    DESK VARCHAR(32),
    QTY INTEGER
  )
)

###Pure
Class model::Trade
{
  id: Integer[1];
  desk: String[0..1];
  qty: Integer[0..1];
}

###Mapping
Mapping model::TradeMapping
(
  model::Trade: Relational
  {
    ~mainTable [store::TradesDb]TRADES
    id: [store::TradesDb]TRADES.ID,
    desk: [store::TradesDb]TRADES.DESK,
    qty: [store::TradesDb]TRADES.QTY
  }
)

###Connection
RelationalDatabaseConnection model::TradesConnection
{
  store: store::TradesDb;
  type: H2;
  specification: LocalH2
  {
  };
  auth: DefaultH2;
}

###Runtime
Runtime model::TradesRuntime
{
  mappings:
  [
    model::TradeMapping
  ];
  connections:
  [
    store::TradesDb:
    [
      connection_1: model::TradesConnection
    ]
  ];
}
`,
};

const engine = () => new LegendLiteLocalEngine(() => new LegendLiteEngineTransport(connect));

test('its contract: a key, a label, and the routes of parse, compose and compile', () => {
  const e = engine();
  assert.equal(e.key, 'legend-lite');
  assert.deepEqual(e.supportedRoutes, [
    'grammar/grammarToJson/model',
    'grammar/jsonToGrammar/model',
    'compilation/compile',
  ]);
});

test('each model goes round text mode through the plugin, each answer the module\'s own, and compiles', async () => {
  const ask = await direct();
  const e = engine();
  try {
    assert.equal(await e.isAvailable(), true);
    for (const [name, text] of Object.entries(MODELS)) {
      const call = async (route, query, body) => {
        const answer = await e.answer(route, { query, body });
        const own = ask(`/api/pure/v1/${route}`, new URLSearchParams(query).toString(), body);
        assert.deepEqual(answer, { status: own.status, body: own.body }, `${name}: ${route}`);
        assert.equal(answer.status, 200, `${name}: ${route}: ${answer.body.slice(0, 300)}`);
        assert.equal(e.isRefusal(answer), false);
        return answer.body;
      };
      // Studio's text mode: the model composed, then the text parsed back
      const json = await call('grammar/grammarToJson/model', { returnSourceInformation: 'false' }, text);
      const composed = await call('grammar/jsonToGrammar/model', { renderStyle: 'STANDARD' }, json);
      const again = await call('grammar/grammarToJson/model', { returnSourceInformation: 'false' }, composed);
      assert.equal(again, json, `${name}: the model is the same after a round trip`);
      await call('grammar/grammarToJson/model', { returnSourceInformation: 'true' }, composed);
      assert.equal(await call('compilation/compile', {}, json), '{"message":"OK","defects":[]}');
    }
  } finally {
    e.dispose();
  }
});

test('an error in the model is the engine\'s error answer, not a refusal', async () => {
  const e = engine();
  try {
    const answer = await e.answer('grammar/grammarToJson/model', { query: {}, body: 'Class model::A { name: String[1] }' });
    assert.equal(answer.status, 400);
    assert.equal(JSON.parse(answer.body).errorType, 'PARSER');
    assert.equal(e.isRefusal(answer), false);
  } finally {
    e.dispose();
  }
});

test('a refusal is an error answer that carries legend-lite\'s marker', () => {
  const marked = (refusal) => ({
    status: 400,
    body: JSON.stringify({ code: -1, errorType: 'COMPILATION', message: 'm', refusal, status: 'error' }),
  });
  assert.equal(isLegendLiteRefusal(marked({ kind: 'UNSUPPORTED' })), true);
  assert.equal(isLegendLiteRefusal(marked({ kind: 'RULED', row: 'S21' })), true);
  assert.equal(isLegendLiteRefusal({ status: 400, body: '{"code":-1,"message":"m","status":"error"}' }), false);
  assert.equal(isLegendLiteRefusal({ status: 200, body: '{"refusal":{"kind":"UNSUPPORTED"}}' }), false);
  assert.equal(isLegendLiteRefusal({ status: 500, body: 'not JSON' }), false);
});

test('a module that cannot load is not available, so Studio keeps the session on the engine server', async () => {
  const e = new LegendLiteLocalEngine(
    () => new LegendLiteEngineTransport(async () => ({ ...(await connect()), moduleUrl: `${MODULE_URL}.missing` })),
  );
  try {
    assert.equal(await e.isAvailable(), false);
  } finally {
    e.dispose();
  }
});

test('a failure of the worker or the module is an answer marked as a refusal, and the next call starts a new worker', async () => {
  let made = 0;
  const e = new LegendLiteLocalEngine(() => {
    made++;
    // the first transport's module cannot load; the next one is sound
    return made === 1
      ? new LegendLiteEngineTransport(async () => ({ ...(await connect()), moduleUrl: `${MODULE_URL}.missing` }))
      : new LegendLiteEngineTransport(connect);
  });
  try {
    const failed = await e.answer('grammar/grammarToJson/model', { query: {}, body: MODELS['a class and a function'] });
    assert.equal(failed.status, 500);
    assert.deepEqual(JSON.parse(failed.body).refusal, { kind: 'UNAVAILABLE' });
    assert.equal(e.isRefusal(failed), true, 'Studio reruns it on the engine server');
    const answered = await e.answer('grammar/grammarToJson/model', { query: {}, body: MODELS['a class and a function'] });
    assert.equal(answered.status, 200);
    assert.equal(made, 2, 'the failed transport was dropped');
  } finally {
    e.dispose();
  }
});
