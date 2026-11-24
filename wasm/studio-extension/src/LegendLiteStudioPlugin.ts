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

import {
  LegendStudioApplicationPlugin,
  type LegendStudioLocalEngine,
} from '@finos/legend-application-studio';
import { createLegendLiteEngineTransport } from '@legend-lite/engine-worker';
import {
  LegendLiteLocalEngine,
  type LegendLiteLocalEngineTransport,
} from './LegendLiteLocalEngine.js';

export const LEGEND_LITE_STUDIO_PLUGIN_NAME = '@legend-lite/studio-extension';
export const LEGEND_LITE_STUDIO_PLUGIN_VERSION = '0.1.0';

/**
 * Contributes legend-lite as Legend Studio's local engine (Studio's local mode, `getExtraLocalEngines()`): legend-lite's
 * engine module answers parse, compose and compile in the browser, in a worker, where the deployment's configuration
 * turns local mode on (`engine.local`) and lists the routes. Registering it fetches nothing: the worker and the module
 * (about 9 MB) are loaded by a session's first local call.
 */
export class LegendLiteStudioPlugin extends LegendStudioApplicationPlugin {
  private readonly _engine: LegendLiteLocalEngine;

  /** @param transport makes the transport to the module; by default, `@legend-lite/engine-worker`'s worker. A test
   *  can give its own. */
  constructor(
    transport: () => LegendLiteLocalEngineTransport = createLegendLiteEngineTransport,
  ) {
    super(LEGEND_LITE_STUDIO_PLUGIN_NAME, LEGEND_LITE_STUDIO_PLUGIN_VERSION);
    this._engine = new LegendLiteLocalEngine(transport);
  }

  override getExtraLocalEngines(): LegendStudioLocalEngine[] {
    return [this._engine];
  }
}
