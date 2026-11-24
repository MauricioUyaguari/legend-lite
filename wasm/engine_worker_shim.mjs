/**
 * A Node worker thread dressed as a browser's module worker, for engine_worker.mjs: the worker file
 * (engine-worker/src/LegendLiteEngine.worker.ts) reads its requests from globalThis.onmessage and answers with
 * globalThis.postMessage, as a page's worker does. A message that arrives before the worker file has loaded waits for
 * it, as a page's module worker holds its messages until its script has run.
 */
import { parentPort, workerData } from 'node:worker_threads';

const waiting = [];
let loaded = false;
globalThis.postMessage = (message) => parentPort.postMessage(message);
parentPort.on('message', (data) => (loaded ? globalThis.onmessage?.({ data }) : waiting.push(data)));
await import(workerData.workerUrl);
loaded = true;
waiting.splice(0).forEach((data) => globalThis.onmessage?.({ data }));
