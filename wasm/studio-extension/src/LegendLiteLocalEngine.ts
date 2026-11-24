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
 * legend-lite's local engine for Legend Studio's local mode: legend-engine's `pure/v1` routes answered by legend-lite's
 * engine module (a WebAssembly build of a Legend compiler) in a Web Worker, instead of the engine server.
 *
 * It implements `LegendStudioLocalEngine` (`@finos/legend-application-studio`) by its shape: this file imports
 * nothing of Studio, so it is tested without it (//wasm:studio_local_engine_test).
 */

/** The routes legend-lite answers for Studio: parse, compose, and compile. A deployment's configuration lists which
 *  of them go local (`engine.local.routes`); phase 1 starts with parse and compose. */
export const LEGEND_LITE_LOCAL_ENGINE_ROUTES = [
  'grammar/grammarToJson/model',
  'grammar/jsonToGrammar/model',
  'compilation/compile',
];

export const LEGEND_LITE_LOCAL_ENGINE_KEY = 'legend-lite';
export const LEGEND_LITE_LOCAL_ENGINE_LABEL = 'legend-lite';

/** What the engine needs of the transport (`@legend-lite/engine-worker`'s `LegendLiteEngineTransport`). */
export interface LegendLiteLocalEngineTransport {
  pureV1(
    path: string,
    query: string,
    body: string,
  ): Promise<{ status: number; body: string }>;
  dispose(): void;
}

type LocalEngineRequest = { query: Record<string, string>; body: string };
type LocalEngineResponse = { status: number; body: string };

/** The smallest model: what `isAvailable()` asks, once, to know the module loads and answers. */
const PROBE_MODEL = 'Class meta::legend::lite::Probe {}';

/**
 * Whether an answer is legend-lite refusing a call it does not support -- a construct it does not implement
 * (`UNSUPPORTED`), or one it rejects where legend-engine accepts it, by a ruling in its register (`RULED`) -- rather
 * than an error in the user's model. legend-lite marks it in the error's JSON, beside legend-engine's own fields:
 * `"refusal": {"kind": "UNSUPPORTED"}` or `{"kind": "RULED", "row": "S21"}` (T3 of legend-lite's Studio local mode).
 * Studio then reruns the call on the engine server, and the session leaves local mode.
 */
export const isLegendLiteRefusal = (response: LocalEngineResponse): boolean => {
  if (response.status < 400) {
    return false;
  }
  try {
    const body = JSON.parse(response.body) as { refusal?: unknown };
    return typeof body.refusal === 'object' && body.refusal !== null;
  } catch {
    // an answer that is not JSON is no marked refusal: Studio shows it as it is
    return false;
  }
};

export class LegendLiteLocalEngine {
  readonly key = LEGEND_LITE_LOCAL_ENGINE_KEY;
  readonly label = LEGEND_LITE_LOCAL_ENGINE_LABEL;
  readonly supportedRoutes = [...LEGEND_LITE_LOCAL_ENGINE_ROUTES];
  private readonly _transport: () => LegendLiteLocalEngineTransport;
  private _current?: LegendLiteLocalEngineTransport | undefined;

  /** @param transport makes the transport, on the first call: nothing is fetched until then */
  constructor(transport: () => LegendLiteLocalEngineTransport) {
    this._transport = transport;
  }

  /** Answers one call as legend-engine's route would: the route's own status and body. A failure of legend-lite
   *  itself (its worker, its module) is thrown, so Studio leaves local mode for the session. */
  async answer(
    route: string,
    request: LocalEngineRequest,
  ): Promise<LocalEngineResponse> {
    this._current ??= this._transport();
    const answer = await this._current.pureV1(
      `/api/pure/v1/${route}`,
      new URLSearchParams(request.query).toString(),
      request.body,
    );
    return { status: answer.status, body: answer.body };
  }

  /** Whether the module loads and answers, asked once by Studio before a session's first local call. */
  async isAvailable(): Promise<boolean> {
    try {
      const answer = await this.answer('grammar/grammarToJson/model', {
        query: {},
        body: PROBE_MODEL,
      });
      return answer.status === 200;
    } catch {
      return false;
    }
  }

  isRefusal(response: LocalEngineResponse): boolean {
    return isLegendLiteRefusal(response);
  }

  /** Stops the worker; the next call starts a new one. */
  dispose(): void {
    this._current?.dispose();
    this._current = undefined;
  }
}
