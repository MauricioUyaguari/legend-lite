// Studio's suite against lite: protocol/pure/* (#100, not in lite) to the engine, the rest to lite; counts by route.
import http from 'node:http';
const [port, lite, engine] = process.argv.slice(2);
const counts = {};
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const target = req.url.includes('/protocol/pure/') ? engine : lite;
  const r = await fetch(target + req.url, { method: req.method, headers: { 'content-type': req.headers['content-type'] ?? 'application/json' }, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
  const key = `${target === lite ? 'lite' : 'engine'} ${req.url.split('?')[0]} ${r.status}`; counts[key] = (counts[key] ?? 0) + 1;
  res.writeHead(r.status, { 'content-type': r.headers.get('content-type') ?? 'application/json', 'access-control-allow-origin': '*' });
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(Number(port), '127.0.0.1');
process.on('SIGTERM', () => { console.log(JSON.stringify(counts, null, 1)); process.exit(0); });
