import { request } from 'node:http';

const method = process.argv[2] ?? 'get_capabilities';

const payload = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method
});

const req = request(
  'http://localhost:3000/_next/mcp',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'Content-Length': Buffer.byteLength(payload)
    }
  },
  (res) => {
    let data = '';
    const contentType = res.headers['content-type'] ?? '';
    const isEventStream = contentType.includes('text/event-stream');

    res.on('data', (chunk) => {
      data += chunk;
      if (isEventStream) {
        process.stdout.write(chunk);
      }
    });

    res.on('end', () => {
      console.log('\nStatus:', res.statusCode);
      if (isEventStream) {
        console.log('\nRaw SSE payload above.');
      }
      try {
        const parsed = JSON.parse(data.trim());
        console.dir(parsed, { depth: null, colors: true });
      } catch {
        if (!isEventStream) {
          console.log('Body:', data);
        }
      }
    });
  }
);

req.on('error', (err) => {
  console.error('Request failed:', err);
});

req.write(payload);
req.end();
