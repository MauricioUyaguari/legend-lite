# @legend-lite/engine-worker

legend-lite's engine module (`@legend-lite/planner-wasm`, `//wasm:engine_planner_package`) in a Web Worker: a
transport that sends legend-engine's `pure/v1` calls to the module and returns each route's own answer. A host's
plugin is built on it:
- legend-lite's Legend Studio plugin (`wasm/studio-extension`), which answers Studio's local-mode calls;
- its Legend DataCube plugin (`wasm/data-cube-extension`, neema2/legend-lite#120).

It was split out of #120, so that the two plugins share one worker and one transport.

## What is in it

| File | What it does |
|---|---|
| `src/LegendLiteEngineTransport.ts` | One request per call, sent to the worker and matched to its answer by id. A route's answer is returned whatever its status. Only a failure of the worker or of the module is thrown (`LegendLiteEngineError`) |
| `src/LegendLiteEngine.worker.ts` | The worker. It loads the module on the first request and keeps it. It must stay self-contained: it is served as a file of its own and started as a module worker, not bundled |
| `src/LegendLiteEngineAssets.ts` | The only file that names the module's files. It is reached by a dynamic `import()` on the first call, so an application that never calls legend-lite fetches nothing of it |
| `src/index.ts` | `createLegendLiteEngineTransport()`, the transport types, and `canRunLegendLiteEngine()`: whether the browser runs WebAssembly GC, which the module needs |

## Using it

```ts
import { createLegendLiteEngineTransport } from '@legend-lite/engine-worker';

const transport = createLegendLiteEngineTransport();
const answer = await transport.pureV1(
  '/api/pure/v1/grammar/grammarToJson/model',
  'returnSourceInformation=true',
  modelText,
);
// answer.status, answer.contentType, answer.body: what legend-engine's route would have sent
```

## Building it into an application

These are the same requirements as #120's DataCube plugin (see its README):
- **The `.wasm` file is an asset.** The application's bundler must emit `classes.wasm` and give its URL. legend-studio's webpack configuration does this for `.wasm`.
- **The worker is emitted as its own file,** not bundled.
- **`wasm-gc-module-runtime.js` is served as is.** It is loaded by the browser itself, not by the bundler.

The package depends on nothing of legend-studio. Its tests use `@finos/legend-shared/test` and Jest, as legend-studio's packages do. Run them inside a legend-studio checkout.
