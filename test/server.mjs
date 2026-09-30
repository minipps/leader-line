// Static server for the test pages: `test/` at the root, `src/` at `/src`, the built files at
// `/package/<file>`, and the few packages the pages load from `node_modules` at `/<package name>`.
//
//   node test/server.mjs [port=8080]   then open http://localhost:8080/

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(TEST_DIR, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
// The built files, for `test/build`.
const PACKAGE_FILES = ['leader-line.min.js', 'leader-line.mjs'];
const MODULE_PACKAGES = ['jasmine-core', 'test-page-loader'];

const packageDir = (name) => path.join(ROOT_DIR, 'node_modules', name);
const ALIASES = [
  ...MODULE_PACKAGES.map((name) => [`/${name}/`, packageDir(name)]),
  ...PACKAGE_FILES.map((name) => [`/package/${name}`, path.join(ROOT_DIR, name)]),
  ['/src/', SRC_DIR],
  ['/', TEST_DIR],
];

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
};

/** The file a request path maps to, or null when it is outside the served directories. */
function resolve(requestPath) {
  for (const [prefix, dir] of ALIASES) {
    if (!requestPath.startsWith(prefix)) continue;
    if (!prefix.endsWith('/')) return requestPath === prefix ? dir : null;
    const file = path.join(dir, decodeURIComponent(requestPath.slice(prefix.length)) || 'index.html');
    return file === dir || file.startsWith(dir + path.sep) ? file : null;
  }
  return null;
}

export function startServer(port = 8080) {
  const server = createServer(async (request, response) => {
    const file = resolve(new URL(request.url, 'http://localhost').pathname);
    try {
      if (!file) throw Object.assign(new Error('Forbidden'), { code: 'ENOENT' });
      const body = await readFile(file.endsWith(path.sep) ? path.join(file, 'index.html') : file);
      response.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache, must-revalidate',
      });
      response.end(body);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 500);
      response.end('Not Found');
    }
  });
  return new Promise((resolveServer) => server.listen(port, '127.0.0.1', () => resolveServer(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startServer(Number(process.argv[2] ?? 8080));
  console.log(`START: http://localhost:${server.address().port}/\nROOT: ${TEST_DIR}\n(^C to stop)`);
}
