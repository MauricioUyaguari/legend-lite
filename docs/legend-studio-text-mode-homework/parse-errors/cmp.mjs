// Parse errors, lite against the engine: status and sourceInformation.
// usage: node cmp.mjs <cases.json> <engine cache.json> <engine base> <lite base> [flag]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const [casesFile, cacheFile, engineBase, liteBase, flag = 'true'] = process.argv.slice(2);
const cases = JSON.parse(readFileSync(casesFile, 'utf8'));
const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
const call = async (base, text) => { const r = await fetch(`${base}/api/pure/v1/grammar/grammarToJson/model?returnSourceInformation=${flag}`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: text }); const b = await r.text(); let j; try { j = JSON.parse(b); } catch { j = { raw: b.slice(0, 300) }; } if (r.status !== 200) delete j.trace; return { status: r.status, body: r.status === 200 ? undefined : j }; };
const tally = {}; const bump = (k) => (tally[k] = (tally[k] ?? 0) + 1);
const rows = [];
for (const c of cases) {
  const key = `${flag}|${c.name}`;
  const e = cache[key] ?? (cache[key] = await call(engineBase, c.text));
  const l = await call(liteBase, c.text);
  const es = e.body?.sourceInformation, ls = l.body?.sourceInformation;
  let verdict;
  if (e.status === 200 && l.status === 200) verdict = 'both200';
  else if (e.status !== l.status) verdict = `status e${e.status} l${l.status}`;
  else if (!es && !ls) verdict = 'noPos-both';
  else if (!ls) verdict = 'lite-noPos';
  else if (!es) verdict = 'engine-noPos';
  else if (JSON.stringify(es) === JSON.stringify(ls)) verdict = 'same';
  else if (es.startLine === ls.startLine && es.startColumn === ls.startColumn) verdict = 'sameStart';
  else if (es.startLine === ls.startLine) verdict = 'sameLine';
  else verdict = 'differ';
  bump(verdict);
  rows.push({ name: c.name, verdict, engine: e.status === 200 ? 200 : [e.status, es, e.body?.message], lite: l.status === 200 ? 200 : [l.status, ls, l.body?.message] });
}
writeFileSync(cacheFile, JSON.stringify(cache));
writeFileSync(casesFile.replace(/\.json$/, `.result-${flag}.json`), JSON.stringify(rows, null, 1));
console.log(JSON.stringify(tally));
