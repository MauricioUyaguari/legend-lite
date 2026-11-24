# @legend-lite/studio-extension

A Legend Studio plugin that contributes legend-lite as Studio's **local engine**. legend-lite's engine module is a
WebAssembly build of a Legend compiler. With this plugin it answers three engine calls in the browser, in a Web Worker,
instead of the engine server:

| Call | Route |
|---|---|
| Parse | `grammar/grammarToJson/model` |
| Compose | `grammar/jsonToGrammar/model` |
| Compile | `compilation/compile` |

The deployment's configuration decides which of the three actually go local.

It plugs into Studio's local mode. That is legend-studio's hook (`LegendStudioApplicationPlugin.getExtraLocalEngines()`)
and its configuration (`engine.local`); see legend-studio's guide, `docs/technical/studio-local-engine-plugin.md`. The
plan is legend-lite's `docs/LEGEND_STUDIO_TEXT_MODE_PLAN_2026_11_23.md`.

## What it does

- **`answer(route, { query, body })`** sends the call to the engine module and returns the route's own status and body.
  An error in the user's model comes back as legend-engine's error JSON, so Studio shows it as it shows the server's.
- **`isAvailable()`** loads the module and parses the smallest model, once per editing session. Studio checks
  WebAssembly GC support first. If this returns `false`, the session uses the engine server.
- **`isRefusal(response)`** reads legend-lite's marker in an error answer, beside legend-engine's fields:
  `"refusal": {"kind": "UNSUPPORTED"}` or `{"kind": "RULED", "row": "S21"}`. Studio then reruns the call on the engine
  server, and the session leaves local mode.
- **Nothing is fetched at registration.** The worker and the module (about 9 MB) are loaded by a session's first local
  call. The worker and the transport are `@legend-lite/engine-worker`'s.

## Registering it in a deployment

legend-lite's packages are not on a public registry. A deployment builds and publishes them itself:
`@legend-lite/planner-wasm` (`bazel build //wasm:engine_planner_package`), `@legend-lite/engine-worker` and this
package. Then:

1. Add the plugin to the deployment's Studio:

   ```ts
   import { LegendLiteStudioPlugin } from '@legend-lite/studio-extension';

   static getPluginCollection(): AbstractPlugin[] {
     return [
       // ...
       new LegendLiteStudioPlugin(),
     ];
   }
   ```

2. Turn local mode on in Studio's `config.json`. Phase 1 starts with parse and compose; compile is added later by
   listing its route. Add `"engine": "legend-lite"` only if another plugin also provides a local engine:

   ```json
   "engine": {
     "url": "...",
     "local": {
       "mode": "on",
       "routes": ["grammar/grammarToJson/model", "grammar/jsonToGrammar/model"]
     }
   }
   ```

3. Bundle it as `@legend-lite/engine-worker`'s README says:
   - `classes.wasm` is an emitted asset;
   - the worker is a file of its own;
   - `wasm-gc-module-runtime.js` is served as is.

## Tests

- **`bazel test //wasm:studio_local_engine_test`,** in legend-lite. It asks the plugin's engine as Studio's router asks a
  local engine, over the package's worker and the engine module. It checks that:
  - a model goes round Studio's text mode (parse, compose, parse again) and compiles, each answer equal to the module's own;
  - an error in the model is an answer, not a refusal;
  - a module that fails to load is not available.
- **The plugin class** (`LegendLiteStudioPlugin`, the only file that imports Studio) is type-checked against
  legend-studio's local-mode branch.
