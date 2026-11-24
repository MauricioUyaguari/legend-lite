// Parse-error cases: legend-studio's grammar round-trip cases, each broken a few deterministic ways.
// usage: node mutants.mjs <cases dir> <out.json>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [dir, out] = process.argv.slice(2);
const at = (s, re) => [...s.matchAll(re)].map((m) => m.index);
const pick = (xs, f) => (xs.length ? xs[Math.floor(xs.length * f)] : undefined);
const cases = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.pure')).sort()) {
  const t = readFileSync(join(dir, f), 'utf8');
  const add = (kind, s) => s !== undefined && s !== t && cases.push({ name: `${f}#${kind}`, text: s });
  for (const [k, frac] of [['a', 0.3], ['b', 0.7]]) {
    const semi = pick(at(t, /;/g), frac);
    if (semi !== undefined) add(`delsemi${k}`, t.slice(0, semi) + t.slice(semi + 1));
    const close = pick(at(t, /[})\]]/g), frac);
    if (close !== undefined) add(`delclose${k}`, t.slice(0, close) + t.slice(close + 1));
    const word = pick(at(t, /[A-Za-z_]\w*\b/g), frac);
    if (word !== undefined) add(`garbage${k}`, t.slice(0, word) + '$ ' + t.slice(word));
    const colon = pick(at(t, /:(?!:)/g).filter((i) => t[i - 1] !== ':'), frac);
    if (colon !== undefined) add(`colon${k}`, t.slice(0, colon) + ' ' + t.slice(colon + 1));
  }
  const ws = pick(at(t, /\s/g), 0.6);
  if (ws !== undefined) add('truncate', t.slice(0, ws));
}
writeFileSync(out, JSON.stringify(cases));
console.log(cases.length, 'cases');
