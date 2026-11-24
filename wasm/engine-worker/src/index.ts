/**
 * Copyright (c) 2026-present, Goldman Sachs
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * legend-lite's engine module in a Web Worker, for a host outside this repository: its transport (one request per
 * `pure/v1` call, matched to its answer), and a transport whose worker is created on the first call.
 *
 * The worker and the module's files are reached only through `LegendLiteEngineAssets.ts`, loaded by a dynamic
 * `import()` on the first call: an application that never calls legend-lite fetches nothing of it.
 */

import { LegendLiteEngineTransport } from './LegendLiteEngineTransport.js';

export {
  LEGEND_LITE_ENGINE_ERROR_KIND,
  LegendLiteEngineError,
  LegendLiteEngineTransport,
  unfoldLegendLiteEngineAnswer,
  type LegendLiteEngineAnswer,
  type LegendLiteEngineConnection,
  type LegendLiteEnginePort,
  type LegendLiteEngineRequest,
  type LegendLiteEngineResponse,
} from './LegendLiteEngineTransport.js';

/**
 * A transport to the engine module in its own worker. Nothing is fetched until the first call: the worker, the
 * module's runtime and the module itself are loaded then.
 */
export const createLegendLiteEngineTransport = (): LegendLiteEngineTransport =>
  new LegendLiteEngineTransport(async () =>
    (await import('./LegendLiteEngineAssets.js')).createLegendLiteEngineConnection(),
  );

/**
 * Whether this browser can run the engine module: it is WebAssembly with garbage collection (WasmGC), which a
 * browser without it refuses to compile. Checked by compiling the smallest module that declares a GC type.
 */
export const canRunLegendLiteEngine = (): boolean => {
  if (typeof WebAssembly !== 'object') {
    return false;
  }
  try {
    // (module (type (struct))): the type section declares one struct type, a WasmGC type
    return WebAssembly.validate(
      new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x03, 0x01, 0x5f, 0x00]),
    );
  } catch {
    return false;
  }
};
