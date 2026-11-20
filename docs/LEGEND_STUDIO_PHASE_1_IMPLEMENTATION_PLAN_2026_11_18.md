# Phase 1 implementation plan: DataCube's `generatePlan` answered in the tab (2026-11-18)

**Status:** M0 to M3 are written, checked and in pull requests ([Progress](#progress)). M2 and M3 ran in the
DataCube app against a real engine. M4's wider checks and M5 are not started. Two things changed after this plan
was written, and the milestones below describe the plan, not what was built:
[Changes since this plan](#changes-since-this-plan). It implements phase 1 of
[`LEGEND_STUDIO_INTEGRATION_PROPOSAL_2026_11_18.md`](LEGEND_STUDIO_INTEGRATION_PROPOSAL_2026_11_18.md)
(its section 7). Section 2 lists where reading the code changed that proposal.

**Read against:** legend-studio at `c40833edd`, legend-lite `main` at `4dfbb5b76`. File and line references
are to those commits, except in [Progress](#progress) and [Changes since this plan](#changes-since-this-plan),
which are against legend-lite `main` at `b75d6c73a` and legend-studio `finos/master` at `74e6f1d47`.

**Goal:** for a cached source, a local file or a cached Iceberg table, the SQL DataCube runs on its own
DuckDB-WASM comes from legend-lite's planner in the tab, behind settings that are off by default, with a
shadow mode that compares the two planners before anyone relies on the new one.

## Contents

- [Progress](#progress)
- [Changes since this plan](#changes-since-this-plan)
- [1. What gets built](#1-what-gets-built)
- [2. What reading the code changed](#2-what-reading-the-code-changed)
- [3. Milestones](#3-milestones)
  - [M0. The planner as a package (legend-lite)](#m0-the-planner-as-a-package-legend-lite)
  - [M1. The planner client (legend-studio, nothing calls it)](#m1-the-planner-client-legend-studio-nothing-calls-it)
  - [M2. The legend-lite mode (legend-studio, off by default)](#m2-the-legend-lite-mode-legend-studio-off-by-default)
  - [M3. Shadow mode (legend-studio)](#m3-shadow-mode-legend-studio)
  - [M4. The first run in a browser](#m4-the-first-run-in-a-browser)
  - [M5. Remove the temporary pieces (legend-lite)](#m5-remove-the-temporary-pieces-legend-lite)
- [4. Tests](#4-tests)
- [5. Repository mechanics](#5-repository-mechanics)
- [6. Decisions needed](#6-decisions-needed)
- [7. What this plan has not verified](#7-what-this-plan-has-not-verified)

---

## Progress

As of 2026-11-20. Two pull requests hold the work:

- **M0:** [neema2/legend-lite#120](https://github.com/neema2/legend-lite/pull/120), ready for review, rebased onto
  `main` at `b75d6c73a`.
- **M1 to M3:** [MauricioUyaguari/legend-studio#2](https://github.com/MauricioUyaguari/legend-studio/pull/2), a
  draft on the fork and not against `finos/legend-studio`, because it cannot build until the package is published
  (decision 1). Its base branch is `finos/master` at `74e6f1d47`. Three commits: the feature, then the two
  restructures described in [Changes since this plan](#changes-since-this-plan).

| | State | Where | Checked by |
|---|---|---|---|
| M0 | Written | legend-lite, branch `feat/planner-wasm-package` (worktree `.claude/worktrees/planner-wasm-package`): `//wasm:engine_planner_package`, `wasm/npm/`, `wasm/engine_planner_package.mjs`. Built from the engine module (`//wasm:engine_planner`): 9.34 MB raw, 3.45 MB gzipped | 22 tests pass: `//wasm:engine_planner_package_test` (every file `package.json` names is in the package, and the module loaded through the package's entry answers a `pure/v1` route), `//wasm:engine_routes_test`, `//tools/deps/...` and `//tools/js/...`. `//gates:local` was not run |
| M1 | Written | legend-studio, branch `datacube-legend-lite-planner` off `finos/master` at `74e6f1d47` (worktree `.claude/worktrees/datacube-legend-lite-planner`): `stores/planner/LegendLiteEngineClient.ts`, `LegendLiteEngineTransport.ts`, `LegendLiteEngine.worker.ts`, `LegendLiteEngineAssets.ts`, and a changeset | Type check clean; the copyright check passes; spike 11, below |
| M2 | Written | The same legend-studio branch: `stores/planner/LegendDataCubePlannerMode.ts`, the engine class, the base store, one setting key | Ran in the DataCube app, below |
| M3 | Written | The same legend-studio branch: `stores/planner/LegendLitePlannerShadow.ts`, the engine class, the base store, a second setting key, five events | Ran in the DataCube app, below |
| M1 to M3 | | | 71 unit tests for `stores/planner/` pass, 165 across the package's store tests. One lint error stands: the package is not a declared dependency (decision 1) |
| M4 | Partly done | | The app runs under M2 and M3 below are M4's steps 1 to 4, in one browser. A production build, other browsers, a cached source and an Iceberg table are not done |
| M5 | Not started | | |

**Spike 11** (`legend-studio-integration-homework/11-webpack-browser-probe/`) built the compiled client with
legend-studio's webpack, naming files as its production build does, and ran it in a browser (Chrome 156):

- Before the first request the page had fetched its own bundle and nothing of the planner.
- The worker started as a module worker from its hashed file, imported the runtime from its URL, and loaded the
  module.
- `grammarToJson/lambda` answered 200 in 104 ms, module load included. `generatePlan` answered 200 with the SQL:
  182 ms the first time, 13 ms the second.

Re-run on 2026-11-20 with the engine module and the client as it is now (a `V1_EngineServerClient`): an
inherited method (`grammarToJSON_lambda`) parsed a lambda; `generatePlan` with DataCube's embedded model answered
with SQL, 205 ms the first time and 7 ms the second; a refused request was a `NetworkClientError` with status 500
and legend-lite's message; a route legend-lite does not have was a `NetworkClientError` with status 404; no request
went to a server.

Two things it showed that the plan did not say:

- **webpack minifies the worker and the runtime** (the runtime from 34 KB to 16 KB). They are emitted as files of
  their own and not bundled, which is what matters, and both ran minified.
- **M1 lands without the planner package being a dependency.** The assets file is the only one that names the
  package, and nothing imports it yet, so webpack never reaches it. M2 is the first change that needs the
  dependency declared (decision 1).

**M2 in the DataCube app.** The dev app was run from the branch against a real engine (`localhost:6500`), with a
60-row CSV loaded as a local file source, in Chrome 156:

| Step | Result |
|---|---|
| Setting off, cube opened | `generatePlan` went to the engine; no planner file was fetched |
| Setting turned on in the settings panel, page reloaded, cube opened | The setting was read at start-up. The lazy chunk and the worker were fetched, no `generatePlan` went to the engine, and the grid drew its 60 rows from the planner's SQL |
| Sort by `amount`, descending | Planned by the planner (`ORDER BY t0.amount DESC NULLS FIRST LIMIT 500`), run on DataCube's DuckDB in 13 ms, rows in the right order |
| Horizontal pivot on `region` | Two queries, as the routing rule intends: the cast-less discovery query went to the engine, and the pivot with its cast was planned by the planner (a DuckDB `PIVOT`), 17 ms, three column groups drawn |
| Vertical pivot on `name` over that | The same split. The planner's SQL grouped the pivot (`uniqueValueOnly` as a `CASE` over `COUNT(DISTINCT)`), 7 rows |

This is the first time legend-lite's SQL was executed by DataCube's DuckDB (`duckdb-wasm` 1.31.0). Still not done:
the rows were checked by eye, not compared with the engine's query by query. That comparison is M3.

What the run showed:

- **`jsonToGrammar/valueSpecification` still goes to the engine on every query**, as the proposal said it would
  (phase 2).
- **The dev app does not start without a sign-in server.** With no `oidcConfig`, `LegendDataCubeWebApplication`
  reads `auth.user` of an undefined `auth`. That is on `master`, not from this branch. The run used a one-line
  local workaround, reverted afterwards.
- **Two display faults in DataCube's DuckDB result conversion, on `master`, whichever planner wrote the SQL**
  (`LegendDataCubeDuckDBEngine.runSQLQuery` formats `new Date(Number(value))` in local time): a date shows one
  day early in a time zone behind UTC, and a NULL date shows as `1969-12-31`. The proposal's time zone risk is
  real, and it is in the reader, not only in the SQL.
- **The setting is one boolean for now.** The shadow setting comes with M3.
- **M2 cannot build in CI.** The engine class now reaches the assets file, so webpack needs
  `@legend-lite/planner-wasm`, which exists only as a copy in the worktree's `node_modules`. Until it is published
  (decision 1), the branch builds only where that copy is.

**M3 in the DataCube app.** The same set-up, shadow setting on, with a CSV that has empty values in `amount`:

| Query | Planned for the user by | Shadow record |
|---|---|---|
| The opening page of rows | The engine | match, exact, 60 rows |
| Sort by `amount`, descending | The engine | match, exact. Both planners wrote `DESC NULLS FIRST` |
| Horizontal pivot on `region` | The engine | match, exact, 60 rows, 8 columns. The discovery query is not compared |
| Vertical pivot on `name` over that, sorted by `name` | The engine | match, exact, 7 rows, 11 columns, `uniqueValueOnly` included |

These are the first comparisons of legend-lite's SQL with the engine's on executed rows: four shapes, all equal,
on one small file. They are a start, not a corpus.

What M3 settled against the plan:

- **Five outcomes, not three:** match, different, inconclusive, refused, failed. A refusal (the planner does not
  plan the query) is kept apart from a failure (the planner could not be asked, or DuckDB could not run its SQL).
- **Rows are compared in any order, and the order is checked only where the query fixes it.** A sort with ties
  does not fix the order of whole rows, so two right answers can differ there. What it does fix is the order of
  the values of the sorted columns, and that is compared: the same rows with the sorted values in another order
  (empty values first against last, say) is recorded as different.
- **Different rows are inconclusive when the query's limit was reached.** DataCube ends a grid query with
  `slice(0, 500)`. When that limit binds and the sort has ties, or there is no sort, the query does not say which
  rows come back.
- **What is sent as telemetry holds counts, timings, flags and messages.** The query and both SQL texts are
  written to the browser's console only (decision 3 is still open). A refusal's message is the planner's own text
  and may name a column.
- **The record does not carry the planner's version.** The package exposes none yet (M0).

What M0 settled against the plan: the package is a directory (`bazel-bin/wasm/engine_planner_package`), laid out by
`copy_to_directory`, not a tarball; its `package.json` is `private`, so it cannot be published by accident; its
version is the fixed `0.1.0`, with no commit in it yet.

---

## Changes since this plan

Two changes, after M0 to M3 were first written. Neither changes what DataCube does. Sections 1 to 7 below are
the plan as written on 2026-11-18; where they differ from this section, this section is what was built.

### The package holds the engine module (2026-11-19)

legend-lite's edge program ([neema2/legend-lite#118](https://github.com/neema2/legend-lite/pull/118), the K2 ruling "product root, edge opt-in") moved legend-engine's routes out of
the planner module. On `main` at `b75d6c73a`:

- `//wasm:planner`, the product module, answers legend-lite's own operations and has no `pureV1OrError`.
- `//wasm:engine_planner`, the engine module (`com.legend.edge.wasm.EngineExports`), has `pureV1OrError` and
  execute's halves, and nothing else. It loads and answers on its own, with no product module beside it.

So M0 packages the engine module: `//wasm:engine_planner_package`, 9.34 MB raw and 3.45 MB gzipped, about the
size of the old module. The npm name stays `@legend-lite/planner-wasm`, so legend-studio's imports did not change.

On the engine module alone, spikes 03 and 10 give what they gave before: DataCube's exact model is refused for
the same two reasons (G1 and G2), and with the shim 10 of 12 DataCube-shaped queries plan, 1 is kept on the
engine by the routing rule and 1 fails (`last()`). Where the refusals are raised:

| Gap | Was | Now |
|---|---|---|
| G1 | `ConnectionReader.java:138` | Unchanged |
| G2 | `server/PureV1Api.java:1184` | `edge/PureV1Routes.java:539` |
| G7 | `server/PureV1Api.java:1255` | `edge/HostAnswers.java:234` (`jsonPlan`) |

### legend-lite's client is an engine server client (2026-11-20)

M1 was a transport with one raw method, `pureV1(path, query, body)`. It is now three layers:

| Layer | File | What it is |
|---|---|---|
| Engine client | `LegendLiteEngineClient.ts` | A subclass of `V1_EngineServerClient` that overrides `request()`, the one method every method of that class ends in, to ask the engine module instead of a server |
| Transport | `LegendLiteEngineTransport.ts` (was `LegendLitePlannerClient.ts`) | The worker, matching answers by id, the answer format. It knows no route |
| Worker and assets | `LegendLiteEngine.worker.ts`, `LegendLiteEngineAssets.ts` (were `LegendLitePlanner.worker.ts`, `LegendLitePlannerAssets.ts`) | Unchanged but for names |

What that changed elsewhere:

- **DataCube's engine class** asks either client the same way: `generatePlan(input)` on one instance or the
  other. It names legend-lite in the message when legend-lite is the one that failed.
- **The shim** (G1, G2) is applied in the client's `request()` for `generatePlan`, so callers send what they
  would send the engine server.
- **The mode and the routing rule** (G3) are in `LegendDataCubePlannerMode.ts` (was part of
  `LegendLitePlannerRequest.ts`). Choosing a planner is DataCube's decision, so it is not in the client.
- **A refusal is a `NetworkClientError`**, as the engine server client throws, with the same payload. A route
  legend-lite does not have fails the same way, with a 404. Shadow mode records a refusal with its status as its
  kind.
- **Nothing is ever sent to a server.** The client's `request()` does not reach the network, and nothing falls
  back to the engine server.
- **The client ignores** compression, credentials, tracing and aborting a request: they only make sense for a
  server.

The client inherits methods legend-lite does not answer. They fail clearly, but the type alone does not say which
routes work. It stays in the DataCube package: `legend-graph` is loaded by every app, and the client needs the
worker and the package.

---

## 1. What gets built

All legend-studio changes are in `packages/legend-application-data-cube`. Nothing in `legend-data-cube`,
`legend-graph` or `legend-query-builder` changes, so Query, Studio, Marketplace and the REPL are untouched.

*The table is as planned. The files as built are in [Changes since this plan](#changes-since-this-plan).*

| File (under `packages/legend-application-data-cube/src`) | New? | What it is |
|---|---|---|
| `stores/planner/LegendLitePlanner.worker.ts` | New | About 30 lines, self-contained. Loads the planner module once, answers one `pure/v1` request per message |
| `stores/planner/LegendLitePlannerAssets.ts` | New | The only file that names the planner's two files and creates the `Worker`. Loaded lazily |
| `stores/planner/LegendLitePlannerClient.ts` | New | Sends a request to a worker port, matches the answer by id, unfolds it |
| `stores/planner/LegendLitePlannerRequest.ts` | New | The model shim (G1, G2) and the routing rule (G3). Pure functions over JSON |
| `stores/planner/LegendLitePlannerShadow.ts` | New (M3) | The comparison of two results. A pure function |
| `stores/LegendDataCubeDataCubeEngine.ts` | Changed | The three identical DuckDB branches of `executeQuery` (`:1058-1142`) become one helper that reads the mode. `_generateExecutionPlan` (`:1718`) gains a planner argument |
| `stores/LegendDataCubeBaseStore.ts` | Changed | Two settings beside the two there (`:121-148`), and their start-up read |
| `__lib__/LegendDataCubeSetting.ts` | Changed | Two setting keys |
| `__lib__/LegendDataCubeEvent.ts` | Changed (M3) | Three shadow events |
| `package.json` | Changed | One dependency: the planner package |

legend-lite: one packaging target (M0). No compiler change is needed to start.

---

## 2. What reading the code changed

Six things differ from the proposal's section 7. None changes the recommendation.

1. **The setting cannot be one setting with three values.** DataCube's setting types are `BOOLEAN`,
   `NUMERIC`, `STRING` and `ACTION` (`legend-data-cube/.../DataCubeSettingService.tsx:62`). An enumerated type
   would have to be added to `legend-data-cube`, which Query and the REPL also load. So: **two boolean
   settings** in the app, giving the same three modes (section M2). A free-text `STRING` setting is the
   alternative; a typo there is a silent wrong mode unless refused.
2. **legend-lite's own `planner-worker.js` does not fit legend-studio's build.** It finds the module as
   `${base}classes.wasm` and `${base}wasm-gc-module-runtime.js`, fixed names beside a base URL
   (`engine-client/src/legend/planner-worker.ts:16-19`). legend-studio's webpack emits every asset under a
   hashed name in production (`legend-dev-utils/WebpackConfigUtils.js:272`). So legend-studio **owns a small
   worker that takes the two URLs explicitly**, and needs two files from legend-lite, not three. It depends
   on `load` and `pureV1OrError` only, which is the stable surface the proposal already chose.
3. **The runtime file must be served as a file, not bundled.** `wasm-gc-module-runtime.js` decides it is in
   Node by `typeof process !== "undefined"` and imports modules by a computed name (`import(module)`). Passed
   through webpack's JavaScript pipeline either could change behaviour. It is loaded with a native `import()`
   from its URL, the way DuckDB's worker is already loaded from a URL in this package
   (`LegendDataCubeDuckDBEngine.ts:83-95`).
4. **The mode logic does not live in `_generateExecutionPlan` alone.** Shadow mode has to run SQL, and that
   method only plans. The three DuckDB branches of `executeQuery` are the same code three times; they fold
   into one helper, and the mode is read there.
5. **The real module cannot be relied on in legend-studio's jest.** legend-studio's `engines` allows Node 20;
   the module needs Node 25, or Node 22 with `--experimental-wasm-exnref`. legend-studio's tests use a fake worker port;
   the real module is exercised by legend-lite's corpus (phase 0) and by the browser run (M4).
6. **The `last()` aggregate (G4) will show as a refusal** in the legend-lite mode until it is fixed. It is a
   DataCube aggregation operator, so a user can reach it.

Confirmed while planning (spike `legend-studio-integration-homework/10-shim-and-routing.mjs`, run against the
module built from `main`): the shim below turns DataCube's exact model, which is refused with a 500, into one
that plans; and the routing rule keeps exactly the cast-less pivot on the engine. Of the twelve
DataCube-shaped queries: ten planned by the planner, one kept on the engine by the rule, one failed (`last()`).

---

## 3. Milestones

Each lands on its own and leaves DataCube behaving as today until a setting is turned on.

### M0. The planner as a package (legend-lite)

*As planned. The package now holds the engine module: [Changes since this plan](#changes-since-this-plan).*

**Why first:** legend-studio's build resolves `@scope/package/file` paths; it cannot reach into
`bazel-bin`.

- A Bazel target in `//wasm` that lays out an npm-shaped package: `classes.wasm`,
  `wasm-gc-module-runtime.js`, `index.d.ts`, `LICENSE`, `NOTICE`, and a `package.json` whose `exports` names
  the two files and whose version carries the commit.
- `index.d.ts` declares only what legend-studio uses: `load(src, options)` and
  `exports.pureV1OrError(path, rawQuery, body): string`.
- **To start before anything is published:** build `//wasm:planner`, copy the two files into a folder with
  that `package.json`, and add it to legend-studio by local path (`yarn add
  @legend-lite/planner-wasm@portal:<folder>`). The lockfile change stays out of any pull request.

**Done when:** `yarn install` in legend-studio resolves the package and the two files are in it.
Publishing it (which registry, which scope, who releases) is decision 1 in section 6.

### M1. The planner client (legend-studio, nothing calls it)

*As planned. The code below is superseded by the client in
[MauricioUyaguari/legend-studio#2](https://github.com/MauricioUyaguari/legend-studio/pull/2), a subclass of
`V1_EngineServerClient`: [Changes since this plan](#changes-since-this-plan).*

**The worker** (`LegendLitePlanner.worker.ts`). Self-contained: no imports, so it can be emitted as a file
and started as a module worker.

```ts
type Request = { id: number; runtimeUrl: string; moduleUrl: string; path: string; query: string; body: string };
type PlannerModule = { exports: { pureV1OrError(path: string, rawQuery: string, body: string): string } };

let planner: Promise<PlannerModule> | undefined;
const scope = globalThis as unknown as {
  onmessage: ((e: MessageEvent<Request>) => void) | null;
  postMessage(message: unknown): void;
};

scope.onmessage = async (e) => {
  const { id, runtimeUrl, moduleUrl, path, query, body } = e.data;
  try {
    planner ??= import(runtimeUrl).then((runtime) =>
      runtime.load(moduleUrl, {
        stackDeobfuscator: { enabled: false },
        installImports(imports: Record<string, unknown>) {
          imports.teavmConsole = { putcharStdout() {}, putcharStderr() {} };
        },
      }),
    );
    scope.postMessage({ id, ok: true, answer: (await planner).exports.pureV1OrError(path, query, body) });
  } catch (error) {
    planner = undefined; // a failed load is retried by the next request
    scope.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
```

The `load` options are the ones legend-lite's own worker passes (`planner-worker.ts:20-26`).

**The assets file** (`LegendLitePlannerAssets.ts`). The one place `import.meta.url` and the `.wasm` import
appear, following `LegendDataCubeDuckDBEngine.ts:17-19, 83-95`. The package's `DuckDBWASM.d.ts` already
declares `*.wasm` imports.

```ts
import plannerModuleUrl from '@legend-lite/planner-wasm/classes.wasm';

// each URL is made on its own line, as DuckDB's worker URL is: written as `new Worker(new URL(...))`,
// webpack would bundle the worker instead of emitting the file
const workerUrl = new URL('./LegendLitePlanner.worker.js', import.meta.url).toString();
const runtimeUrl = new URL('@legend-lite/planner-wasm/wasm-gc-module-runtime.js', import.meta.url).toString();

export const createLegendLitePlannerPort = () => ({
  worker: new Worker(workerUrl, { type: 'module' }),
  runtimeUrl,
  // absolute, because the worker would resolve a relative URL against its own
  moduleUrl: new URL(plannerModuleUrl as string, document.baseURI).toString(),
});
```

**The client** (`LegendLitePlannerClient.ts`). Takes a port factory, so tests pass a fake and never load the
assets file.

- `pureV1(path, query, body): Promise<{ status: number; contentType: string; body: string }>`.
- Requests carry an increasing id; answers are matched by id; a worker `onerror` rejects every pending
  request.
- `unfoldPlannerAnswer(raw)`: `OK\n<status>\n<type>\n<body>` gives the three parts; `ERR\n<kind>\n<message>`
  throws an error carrying the kind and the message. Anything else throws, naming the first line.
- The worker is created on the first request, not at construction.

**Done when:** unit tests pass for the unfolding and the id matching, with a fake port. No other file imports
the client yet.

### M2. The legend-lite mode (legend-studio, off by default)

*As planned. The shim now lives in the client's `request()`, and the mode and routing rule in
`LegendDataCubePlannerMode.ts`: [Changes since this plan](#changes-since-this-plan).*

**The request helpers** (`LegendLitePlannerRequest.ts`). Both are the functions spike 10 ran.

```ts
/** G1 + G2: each connection embedded in a runtime becomes its own element, the runtime pointing at it. */
export function liftEmbeddedConnections(model: PlainObject): PlainObject

/** G3: true when the query holds a pivot whose enclosing call is not a cast. */
export function hasCastlessPivot(lambda: PlainObject): boolean
```

- `liftEmbeddedConnections` returns a new object and leaves its input alone. For each runtime element, each
  store connection whose `connection._type` is not `connectionPointer` is moved into a new
  `{ _type: 'connection', package, name, connectionValue }` element and replaced by a pointer to it. A
  relational connection also gets `postProcessorWithParameter: []` when it has none. A model that is not
  `_type: 'data'` is returned as it is.
- `hasCastlessPivot` walks the lambda's `func` nodes. It compares names as DataCube does, by full path or
  last segment (`DataCubeFunction.PIVOT` and `CAST`, `DataCubeQueryEngine.ts:39, 46`). DataCube wraps a pivot
  in a cast whenever it knows the columns (`DataCubeQueryBuilder.ts:191-194`), so the rule catches only the
  discovery query.
- Both are temporary. Each carries a comment naming the legend-lite gap that removes it.

**The engine class** (`LegendDataCubeDataCubeEngine.ts`).

1. `_generateExecutionPlan(query, model, parameterValues, options, planner)`: builds `input` exactly as today
   (`:1724-1740`). For `planner === 'engine'`, today's call. For `'legend-lite'`:
   ```ts
   const answer = await this._legendLitePlanner().pureV1(
     '/api/pure/v1/execution/generatePlan', '',
     JSON.stringify({ ...input, model: liftEmbeddedConnections(model) }),
   );
   if (answer.status !== 200) throw new Error(`[legend-lite planner] ${messageOf(answer.body)}`);
   return V1_deserializeExecutionPlan(JSON.parse(answer.body));
   ```
   The existing `catch` already turns any error into a `DataCubeExecutionError` carrying the input
   (`:1745-1750`), so a refusal reaches the user the way an engine failure does, with the planner named.
   **No fallback to the engine on a refusal.**
2. `_legendLitePlanner()`: creates the client on first use, with a factory that does
   `await import('./planner/LegendLitePlannerAssets.js')`. With both settings off, the module, the worker
   and the two files are never fetched.
3. `_executeOnDuckDB(query, source, options, queryCodePromise, startTime)`: replaces the three branches
   (`CachedDataCubeSource`, `LocalFileDataCubeSource`, `LakehouseProducerIcebergCachedDataCubeSource`). It
   picks the planner, plans, extracts the SQL with the existing expression (`:1071-1078`), and runs it with
   the existing `runSQLQuery`:
   ```ts
   const planner =
     this._plannerMode === 'legend-lite' && !hasCastlessPivot(this.serializeValueSpecification(query))
       ? 'legend-lite' : 'engine';
   ```
   Its answer also says which planner planned, so the debugger can show it.
4. `setPlannerMode(mode)`: called by the store at start-up and by the settings' actions.

**The settings** (`LegendDataCubeBaseStore.ts`, `LegendDataCubeSetting.ts`). Two `BOOLEAN` settings in
`DataCubeSettingGroup.DEBUG`, default `false`:

| Key | Title | Effect |
|---|---|---|
| `debugger.planner.legendLite.enabled` | Planner: use legend-lite for DuckDB-backed sources (experimental) | Mode `legend-lite` |
| `debugger.planner.legendLite.shadow` | Planner: compare legend-lite with the engine in the background | Mode `shadow` (M3); ignored when the first is on |

The persisted values are read at construction the way the two existing ones are (`:179-210`), and each
setting's `action` calls `engine.setPlannerMode(...)`, so a change takes effect on the next query with no
reload.

**Done when:** with the first setting on, a local CSV loads and the grid's SQL is the planner's; with it off,
no planner file is requested. That check is M4.

### M3. Shadow mode (legend-studio)

In `shadow`, `_executeOnDuckDB` returns the engine's result exactly as in `engine`. After it has returned,
and never awaited by the caller:

1. Ask the planner for the same input (through the shim; skipped when the routing rule says engine).
2. If it answers, run its SQL on the same DuckDB and compare with the engine's rows.
3. Record one of three events: match, difference, refusal.

Rules that keep it invisible:

- Every error inside the shadow path is caught and recorded. None reaches the user.
- One shadow comparison at a time. A query that arrives while one is running is not shadowed.
- The comparison (`LegendLitePlannerShadow.ts`) is a pure function of two results: same column names in the
  same order; same rows, in order when the query ends in a sort, as a multiset otherwise; numbers equal
  within a relative tolerance, reported separately from exact equality, because the two SQL texts may add in
  a different order.

**The record.** Three events in `LEGEND_DATACUBE_APP_EVENT`, sent through the engine's existing
`sendTelemetry` (`:2085`): the planner package's version, both planning times, the row counts, the kind of
difference, the refusal's message. Whether the record may also carry the query's Pure text and the two SQL
texts is decision 3 in section 6: they hold column names and filter values. Until that is decided they go to
the browser console only.

**Done when:** with shadow on, the grid is as fast as with it off, and each DuckDB-backed query produces one
record.

### M4. The first run in a browser

This is the first time the SQL is executed and the first comparison with a real engine. Neither was done for
the proposal. It needs a running engine at the URL in the deployment's `dev/config.json`
(`http://localhost:6300/api`).

1. `yarn dev:datacube`, load a CSV as a local file source, both settings off. Confirm no planner file is
   requested.
2. Turn the legend-lite setting on. Check: the two files load (sizes, `application/wasm`), the time of the
   first plan, the grid draws, the debugger shows the planner's SQL.
3. One query per feature, each compared with the same query under the engine: filter, group, sort, a
   pivot (the discovery query on the engine by the rule, the cast pivot on the planner), an extended column
   with arithmetic (G5), the `last` aggregate (G4: a shown refusal), a date column with `today()` (the
   session time zone risk), a large integer column.
4. Turn shadow on instead. Confirm the records, and that nothing is slower to the eye.
5. A production build of the deployment: the hashed asset names resolve and the worker starts.
6. Chrome, Firefox and Safari at the versions the team supports: the module needs WebAssembly GC.
7. The same queries against a cached source and, if one is available, a cached Iceberg table.

**Done when:** each line has a written result. Differences become rows in legend-lite's corpus (phase 0) or
gap fixes (M5).

### M5. Remove the temporary pieces (legend-lite)

In parallel with M1 to M4; none blocks them.

| Gap | Change | Removes |
|---|---|---|
| G1 | The connection reader accepts an absent `postProcessorWithParameter` (`ConnectionReader.java:138`) | Half the shim |
| G2 | `generatePlan` plans over a runtime's embedded relational connection (`PureV1Routes.java:539` on `b75d6c73a`). The refusal says upstream's answer is unprobed, so the engine is asked first, as legend-lite's rules require | The shim |
| G4 | The `last()` aggregate | A user-visible refusal |
| G3 | The cast-less pivot as one runnable statement for a DuckDB target | The routing rule |
| G5 | Ask the engine whether arithmetic on a nullable column compiles, and match it | A possible compile difference |

Each fix ships in a new version of the package; legend-studio moves its pin and deletes the piece.

---

## 4. Tests

In legend-studio, all with a fake port, none loading the module:

| Test | Covers |
|---|---|
| `unfoldPlannerAnswer` | `OK` with each part; a body containing newlines; `ERR`; a malformed answer |
| The client | Ids matched when answers arrive out of order; `onerror` rejects what is pending; the worker is created on first use |
| `liftEmbeddedConnections` | The model `_synthesizeMinimalModelContext` produces (`:1759`); a model already using pointers is unchanged; the input is not mutated |
| `hasCastlessPivot` | The discovery query; a pivot with a cast; no pivot; the full-path and short function names |
| `_executeOnDuckDB` | Each mode picks the planner it should; a refusal is not retried on the engine; with both settings off the assets file is never imported |
| The shadow comparison | Equal; different rows; different order with and without a final sort; numbers within tolerance |

The existing component tests mock `LegendDataCubeDuckDBEngine` whole because of its `import.meta.url` and
`.wasm` imports. The lazy import of the assets file means they need no new mock while the settings are off.

In legend-lite: spike 10 becomes a test of the corpus lane in phase 0, so a change that breaks the request
legend-studio sends fails there.

---

## 5. Repository mechanics

- **legend-studio's checkout** is on another branch with untracked work. Do this in a new git worktree off
  the upstream default branch.
- Every new file needs the copyright header (`yarn fix:copyright`), and the pull request needs a changeset
  for `@finos/legend-application-data-cube`.
- **Suggested pull requests:** (1) M1 and M2 together, off by default; (2) M3. M0 and each M5 fix are their
  own pull requests in legend-lite.
- The planner dependency by local path is for the prototype only. The pull request that lands upstream needs
  a published package (decision 1).

---

## 6. Decisions needed

1. **Where the package is published** (registry, scope, who releases), and whether legend-studio upstream
   may depend on it. Until then the work can proceed on a branch with the local-path dependency, but cannot
   merge upstream.
2. **The form of the setting:** two booleans (recommended) or one free-text setting.
3. **What the shadow record may carry:** counts and messages only, or the query and SQL texts too.
4. **Shim first or fixes first.** Recommended: the shim now, so legend-studio work does not wait on
   legend-lite, and G1 and G2 in parallel.
5. **Where the legend-studio work lands:** upstream at FINOS, or a fork first.

---

## 7. What this plan has not verified

*Updated 2026-11-20 for what has since been run.*

- **The app was run in its dev build only.** A production build, its deployment's server and its content
  security policy are untested.
- **One browser.** Everything ran in Chrome 156. Firefox and Safari are M4's.
- **Few query shapes against the engine.** The opening page, a sort, a horizontal pivot and a group by over the
  pivot were compared with the engine's result on one 60-row file, all equal. Only the opening page was repeated
  after the client became an engine server client.
- **Spike 10 ran in Node 25**, with lambdas parsed by legend-lite, not built by DataCube.
- **`//gates:local` was not run on M0's branch.** Its own test, the engine module's route test and the dependency
  and tooling guards were.
