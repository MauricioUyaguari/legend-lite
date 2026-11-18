// Spike 10: the two pieces of phase 1 that are new logic in legend-studio, written as they would be there and run
// against the EXACT model of spike 03 (which legend-lite refuses as sent):
//   liftEmbeddedConnections  the temporary shim for G1 and G2: a pure JSON transform of the model
//   hasCastlessPivot         the routing rule for G3: a pivot not directly wrapped in a cast stays on the engine
// Every case the rule sends to the planner must plan; the one it keeps on the engine is the cast-less pivot.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const [dir] = process.argv.slice(2);
const { load } = await import(pathToFileURL(resolve(dir, 'wasm-gc-module-runtime.js')).href);
const m = await load(resolve(dir, 'classes.wasm'), { stackDeobfuscator: { enabled: false },
  installImports(o) { o.teavmConsole = { putcharStdout() {}, putcharStderr() {} }; } });
const v1 = (path, q, body) => { const t = performance.now(); const raw = m.exports.pureV1OrError(path, q, body); const ms = performance.now() - t;
  if (!raw.startsWith('OK\n')) return { status: 'ERR', body: raw, ms };
  const r = raw.slice(3); const i = r.indexOf('\n'); const j = r.indexOf('\n', i + 1); return { status: +r.slice(0, i), body: r.slice(j + 1), ms }; };

const col = (name, t) => ({ name, type: { _type: t } });
// as probed from legend-studio's serializer: no sizes, no nullable, auth h2Default, datasource duckDB path /tmpFile
const model = { _type: 'data', elements: [
  { _type: 'relational', filters: [], joins: [], name: 'db', package: 'local',
    schemas: [{ name: 'main', tables: [{ columns: [col('name', 'Varchar'), col('region', 'Varchar'), col('age', 'Integer'), col('amount', 'Float'),
      col('price', 'Double'), col('d', 'Date'), col('ts', 'Timestamp'), col('flag', 'Bit'), col('dec', 'Decimal'), col('t', 'TinyInt'), col('s', 'SmallInt'), col('b', 'BigInt')],
      name: 'cache1', primaryKey: [] }], views: [] }] },
  { _type: 'runtime', name: 'rt', package: 'local', runtimeValue: { _type: 'engineRuntime', connectionStores: [], mappings: [],
    connections: [{ store: { path: 'local::db', type: 'STORE' }, storeConnections: [{ id: 'c0', connection: { _type: 'RelationalDatabaseConnection',
      authenticationStrategy: { _type: 'h2Default' }, databaseType: 'DuckDB', datasourceSpecification: { _type: 'duckDB', path: '/tmpFile' },
      element: 'local::db', type: 'DuckDB' } }] }] } }] };
const SRC = '#>{local::db.main.cache1}#';
const FROM = '->meta::pure::mapping::from(local::rt)';
const cases = {
  'bare source': `${SRC}${FROM}`,
  'filter+select+groupBy+count+sort+slice': `${SRC}->filter(x|$x.region == 'EMEA')->select(~[region, name, age, amount])->groupBy(~[region], ~[amount: x|$x.amount : x|$x->sum(), count: x|$x : x|$x->count()])->sort([~amount->descending()])->slice(0, 500)${FROM}`,
  'leaf extend + limit': `${SRC}->extend(~[twice: x|$x.amount * 2])->limit(100)${FROM}`,
  'group extend after groupBy': `${SRC}->groupBy(~[region], ~[amount: x|$x.amount : x|$x->sum()])->extend(~[share: x|$x.amount / 100])${FROM}`,
  'filters: in, isEmpty, not, and/or': `${SRC}->filter(x|($x.region->in(['EMEA','APAC']) && !($x.name->isEmpty())) || ($x.age >= 30))${FROM}`,
  'filters: case-insensitive contains/startsWith/endsWith': `${SRC}->filter(x|$x.name->toOne()->toLower()->contains('ab'->toLower()) && $x.name->toOne()->startsWith('A') && !($x.name->toOne()->endsWith('z')))${FROM}`,
  'filters: column vs column, dates, today/now': `${SRC}->filter(x|($x.amount > $x.price) && ($x.d >= %2024-01-01) && ($x.d <= today()) && ($x.ts < now()))${FROM}`,
  'aggregates: avg,min,max,uniq,first,last': `${SRC}->groupBy(~[region], ~[a: x|$x.amount : x|$x->average(), mn: x|$x.amount : x|$x->min(), mx: x|$x.amount : x|$x->max(), u: x|$x.name : x|$x->uniqueValueOnly(), f: x|$x.name : x|$x->first(), l: x|$x.name : x|$x->last()])${FROM}`,
  'aggregates: var/std pop+sample, joinStrings': `${SRC}->groupBy(~[region], ~[vp: x|$x.amount : x|$x->variancePopulation(), vs: x|$x.amount : x|$x->varianceSample(), sp: x|$x.amount : x|$x->stdDevPopulation(), ss: x|$x.amount : x|$x->stdDevSample(), j: x|$x.name : x|$x->joinStrings(',')])${FROM}`,
  'pivot discovery (limit 0, no cast)': `${SRC}->select(~[region, name, amount])->sort([~region->ascending()])->pivot(~[region], ~[amount: x|$x.amount : x|$x->sum(), count: x|$x : x|$x->count()])->limit(0)${FROM}`,
  'pivot + cast + groupBy + slice': `${SRC}->select(~[region, name, amount])->sort([~region->ascending()])->pivot(~[region], ~[amount: x|$x.amount : x|$x->sum()])->cast(@meta::pure::metamodel::relation::Relation<(name:String, 'EMEA__|__amount':Float, 'APAC__|__amount':Float)>)->groupBy(~[name], ~['EMEA__|__amount': x|$x.'EMEA__|__amount' : x|$x->sum()])->slice(0, 100)${FROM}`,
  'filler count agg + sum of count (grid drilldown)': `${SRC}->groupBy(~[region, name], ~[INTERNAL__filler_count_agg_column: x|$x : x|$x->count()])->groupBy(~[region], ~[c: x|$x.INTERNAL__filler_count_agg_column : x|$x->sum()])${FROM}`,
};

/** G1 + G2: each connection embedded in a runtime becomes its own element, the runtime pointing at it. */
function liftEmbeddedConnections(model) {
  if (model._type !== 'data') return model;
  const lifted = [];
  const elements = model.elements.map((element) => {
    if (element._type !== 'runtime') return element;
    let n = 0;
    const connections = (element.runtimeValue.connections ?? []).map((sc) => ({ ...sc,
      storeConnections: sc.storeConnections.map((ic) => {
        if (ic.connection._type === 'connectionPointer') return ic;
        const name = `${element.name}__${ic.id}__${n++}`;
        const value = ic.connection._type === 'RelationalDatabaseConnection'
          ? { ...ic.connection, postProcessorWithParameter: ic.connection.postProcessorWithParameter ?? [] }
          : ic.connection;
        lifted.push({ _type: 'connection', name, package: element.package, connectionValue: value });
        return { ...ic, connection: { _type: 'connectionPointer', connection: `${element.package}::${name}` } };
      }) }));
    return { ...element, runtimeValue: { ...element.runtimeValue, connections } };
  });
  return { ...model, elements: [...elements, ...lifted] };
}

const named = (fn, name) => fn === name || fn?.endsWith(`::${name}`);
/** G3: true when the query holds a pivot whose enclosing call is not a cast. */
function hasCastlessPivot(node, enclosing) {
  if (node === null || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some((n) => hasCastlessPivot(n, enclosing));
  if (node._type === 'func') {
    if (named(node.function, 'pivot') && !named(enclosing, 'cast')) return true;
    return (node.parameters ?? []).some((p) => hasCastlessPivot(p, node.function));
  }
  if (node._type === 'lambda') return hasCastlessPivot(node.body, undefined);
  return false;
}

const before = JSON.stringify(model);
const shimmed = liftEmbeddedConnections(model);
console.log(`the model is not mutated: ${JSON.stringify(model) === before}`);
console.log(`elements after the shim: ${shimmed.elements.map((e) => `${e._type} ${e.package}::${e.name}`).join(', ')}`);
const lam = (q) => v1('/api/pure/v1/grammar/grammarToJson/lambda', 'returnSourceInformation=false', '|' + q);
let planned = 0, kept = 0, failed = 0;
for (const [name, q] of Object.entries(cases)) {
  const fn = JSON.parse(lam(q).body);
  if (hasCastlessPivot(fn)) { kept++; console.log(`[ENGINE, by the routing rule] ${name}`); continue; }
  const input = { clientVersion: 'vX_X_X', function: fn, model: shimmed, context: { _type: 'BaseExecutionContext', queryTimeOutInSeconds: null, enableConstraints: true }, parameterValues: [] };
  const exact = v1('/api/pure/v1/execution/generatePlan', '', JSON.stringify({ ...input, model }));
  const p = v1('/api/pure/v1/execution/generatePlan', '', JSON.stringify(input));
  const sql = p.status === 200 ? (JSON.parse(p.body).rootExecutionNode?.executionNodes ?? []).filter((k) => k._type === 'sql').at(-1)?.sqlQuery : undefined;
  if (sql === undefined) { failed++; console.log(`[FAILED ${p.status}] ${name}\n   ${p.body.slice(0, 300)}`); continue; }
  planned++;
  console.log(`[PLANNER ${p.ms.toFixed(1)} ms; unshimmed: ${exact.status}] ${name}`);
}
console.log(`\n${planned} planned by the planner, ${kept} kept on the engine by the rule, ${failed} failed`);
