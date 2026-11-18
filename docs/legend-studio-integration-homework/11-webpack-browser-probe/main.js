// Spike 11: the planner client as legend-studio compiled it (phase 1's M1), reached the way M2 will reach it:
// the client in the page's bundle, the assets file by a dynamic import. `@probe/planner` is an alias build.cjs sets
// to legend-studio's packages/legend-application-data-cube/lib/stores/planner.
import { LegendLitePlannerClient } from '@probe/planner/LegendLitePlannerClient.js';

const client = new LegendLitePlannerClient(async () =>
  (await import('@probe/planner/LegendLitePlannerAssets.js')).createLegendLitePlannerConnection());

window.probe = async () => {
  const out = {};
  let t = performance.now();
  const lambda = await client.pureV1('/api/pure/v1/grammar/grammarToJson/lambda', 'returnSourceInformation=false', "|#>{local::db.main.cache1}#->filter(x|$x.region == 'EMEA')->select(~[region, amount])->from(local::rt)");
  out.firstMs = Math.round(performance.now() - t);
  out.lambdaStatus = lambda.status;
  const col = (name, type) => ({ name, type: { _type: type } });
  const model = { _type: 'data', elements: [
    { _type: 'relational', filters: [], joins: [], name: 'db', package: 'local', schemas: [{ name: 'main', tables: [{ columns: [col('region', 'Varchar'), col('amount', 'Float')], name: 'cache1', primaryKey: [] }], views: [] }] },
    { _type: 'connection', name: 'conn', package: 'local', connectionValue: { _type: 'RelationalDatabaseConnection', authenticationStrategy: { _type: 'h2Default' }, databaseType: 'DuckDB', datasourceSpecification: { _type: 'duckDB', path: '/tmpFile' }, element: 'local::db', postProcessorWithParameter: [], type: 'DuckDB' } },
    { _type: 'runtime', name: 'rt', package: 'local', runtimeValue: { _type: 'engineRuntime', connectionStores: [], mappings: [], connections: [{ store: { path: 'local::db', type: 'STORE' }, storeConnections: [{ id: 'c0', connection: { _type: 'connectionPointer', connection: 'local::conn' } }] }] } }] };
  t = performance.now();
  const plan = await client.pureV1('/api/pure/v1/execution/generatePlan', '', JSON.stringify({ clientVersion: 'vX_X_X', function: JSON.parse(lambda.body), model, context: { _type: 'BaseExecutionContext', queryTimeOutInSeconds: null, enableConstraints: true }, parameterValues: [] }));
  out.planMs = Math.round(performance.now() - t);
  out.planStatus = plan.status;
  out.sql = plan.status === 200 ? JSON.parse(plan.body).rootExecutionNode.executionNodes.filter((n) => n._type === 'sql').at(-1)?.sqlQuery : plan.body.slice(0, 300);
  return out;
};
window.probeReady = true;
