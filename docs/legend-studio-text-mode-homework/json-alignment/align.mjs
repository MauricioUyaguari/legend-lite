// Studio's round-trip cases, lite against legend-engine: (A) parse JSON with positions, (B) the engine's JSON composed by
// lite (PRETTY, STANDARD), (C) lite's parse JSON compiled by the engine, (D) the engine's JSON compiled by lite.
// usage: node align.mjs <cases dir> <engine base> <lite base>
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const [dir, E, L] = process.argv.slice(2);
const post = async (base, path, body, type = 'text/plain') => { const r = await fetch(`${base}/api/pure/v1/${path}`, { method: 'POST', headers: { 'content-type': type }, body }); return { status: r.status, body: await r.text() }; };
const diffs = (a, b, p = '$', out = []) => {
  if (out.length > 4) return out;
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || (a === null) !== (b === null)) { out.push(p); return out; }
  if (a && typeof a === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { if (!(k in a)) out.push(`${p}.${k} (lite only)`); else if (!(k in b)) out.push(`${p}.${k} (engine only)`); else diffs(a[k], b[k], `${p}.${k}`, out); } return out; }
  if (a !== b) out.push(`${p}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  return out;
};
const t = { A: [0, 0], B: [0, 0], C: [0, 0], D: [0, 0] };
for (const f of readdirSync(dir).filter((f) => f.endsWith('.pure')).sort()) {
  const text = readFileSync(join(dir, f), 'utf8');
  const e = await post(E, 'grammar/grammarToJson/model?returnSourceInformation=true', text);
  if (e.status !== 200) continue;
  const l = await post(L, 'grammar/grammarToJson/model?returnSourceInformation=true', text);
  t.A[1]++;
  const d = l.status === 200 ? diffs(JSON.parse(e.body), JSON.parse(l.body)) : [`lite ${l.status}: ${l.body.slice(0, 150)}`];
  if (!d.length) t.A[0]++; else console.log(`A ${f}: ${d.join(' | ')}`);
  for (const style of ['PRETTY', 'STANDARD']) {
    const ec = await post(E, `grammar/jsonToGrammar/model?renderStyle=${style}`, e.body, 'application/json');
    const lc = await post(L, `grammar/jsonToGrammar/model?renderStyle=${style}`, e.body, 'application/json');
    t.B[1]++;
    if (ec.status === lc.status && ec.body === lc.body) t.B[0]++;
    else { const el = ec.body.split('\n'), ll = lc.body.split('\n'); const i = el.findIndex((x, k) => x !== ll[k]); console.log(`B ${f} ${style}: lite ${lc.status}; line ${i + 1}: engine ${JSON.stringify(el[i])} lite ${JSON.stringify(ll[i]?.slice(0, 150))}`); }
  }
  if (l.status === 200) {
    const c = await post(E, 'compilation/compile', l.body, 'application/json');
    const ce = await post(E, 'compilation/compile', e.body, 'application/json');
    t.C[1]++;
    if (c.status === ce.status) t.C[0]++; else console.log(`C ${f}: engine on lite's JSON ${c.status} (on its own ${ce.status}): ${c.body.slice(0, 200)}`);
    const dl = await post(L, 'compilation/compile', e.body, 'application/json');
    const dll = await post(L, 'compilation/compile', l.body, 'application/json');
    t.D[1]++;
    if (dl.status === dll.status) t.D[0]++; else console.log(`D ${f}: lite on the engine's JSON ${dl.status} (on its own ${dll.status}): ${dl.body.slice(0, 200)}`);
  }
}
console.log(JSON.stringify(t));
