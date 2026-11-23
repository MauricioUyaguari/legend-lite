// Spike 11: legend-lite's engine client as its DataCube plugin compiles it (wasm/data-cube-extension, since
// 2026-11-23; before, it was in legend-studio's packages/legend-application-data-cube/lib/stores/planner), reached the
// way DataCube reaches it: the client in the page's bundle, the assets file by a dynamic import. `@probe/planner` is
// an alias build.cjs sets to the plugin's lib.
import { LegendLiteEngineClient } from '@probe/planner/LegendLiteEngineClient.js';
import { LegendLiteEngineTransport } from '@probe/planner/LegendLiteEngineTransport.js';

// the client IS an engine server client (it extends V1_EngineServerClient and overrides request()), so every
// method of that class is here, answered by the module instead of a server
const transport = new LegendLiteEngineTransport(async () =>
  (await import('@probe/planner/LegendLiteEngineAssets.js')).createLegendLiteEngineConnection());
const client = new LegendLiteEngineClient(transport);

window.probe = async () => {
  const out = {};
  let t = performance.now();
  // an inherited method, not written for legend-lite: text in, query parameters, JSON out
  const lambdaJson = await client.grammarToJSON_lambda("|#>{local::db.main.cache1}#->filter(x|$x.region == 'EMEA')->select(~[region, amount])->from(local::rt)", '', undefined, undefined, false);
  out.firstMs = Math.round(performance.now() - t);
  out.lambdaType = lambdaJson._type;
  const col = (name, type) => ({ name, type: { _type: type } });
  const model = { _type: 'data', elements: [
    { _type: 'relational', filters: [], joins: [], name: 'db', package: 'local', schemas: [{ name: 'main', tables: [{ columns: [col('region', 'Varchar'), col('amount', 'Float')], name: 'cache1', primaryKey: [] }], views: [] }] },
    { _type: 'connection', name: 'conn', package: 'local', connectionValue: { _type: 'RelationalDatabaseConnection', authenticationStrategy: { _type: 'h2Default' }, databaseType: 'DuckDB', datasourceSpecification: { _type: 'duckDB', path: '/tmpFile' }, element: 'local::db', postProcessorWithParameter: [], type: 'DuckDB' } },
    { _type: 'runtime', name: 'rt', package: 'local', runtimeValue: { _type: 'engineRuntime', connectionStores: [], mappings: [], connections: [{ store: { path: 'local::db', type: 'STORE' }, storeConnections: [{ id: 'c0', connection: { _type: 'connectionPointer', connection: 'local::conn' } }] }] } }] };
  t = performance.now();
  // the model is given EMBEDDED, as DataCube synthesizes it: the client is what makes it acceptable to legend-lite
  const embedded = { ...model, elements: [model.elements[0], { ...model.elements[2], runtimeValue: { ...model.elements[2].runtimeValue,
    connections: [{ store: { path: 'local::db', type: 'STORE' }, storeConnections: [{ id: 'c0', connection: (({ postProcessorWithParameter, ...c }) => c)(model.elements[1].connectionValue) }] }] } }] };
  try {
    const plan = await client.generatePlan({ clientVersion: 'vX_X_X', function: lambdaJson, model: embedded, context: { _type: 'BaseExecutionContext', queryTimeOutInSeconds: null, enableConstraints: true }, parameterValues: [] });
    out.planMs = Math.round(performance.now() - t);
    out.sql = plan.rootExecutionNode.executionNodes.filter((n) => n._type === 'sql').at(-1)?.sqlQuery;
  } catch (error) {
    out.refused = { name: error.name, status: error.response?.status, message: error.message };
  }
  // a refusal is the error the engine server client throws (NetworkClientError), with legend-lite's message
  try {
    await client.generatePlan({ clientVersion: 'vX_X_X', function: { _type: 'lambda', body: [], parameters: [] }, model: embedded, context: { _type: 'BaseExecutionContext' }, parameterValues: [] });
    out.emptyLambda = 'answered';
  } catch (error) {
    out.emptyLambda = { name: error.name, status: error.response?.status, message: String(error.message).slice(0, 160) };
  }
  // a route legend-lite does not have: fails as on a server, and nothing is sent to one
  try {
    await client.grammarToJSON_valueSpecification('1 + 1');
    out.missingRoute = 'answered';
  } catch (error) {
    out.missingRoute = { name: error.name, status: error.response?.status };
  }
  out.requestsToAServer = performance.getEntriesByType('resource').filter((r) => r.name.includes('legend-lite.invalid')).length;
  return out;
};
window.probeReady = true;
