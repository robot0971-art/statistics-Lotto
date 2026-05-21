const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DEFAULT_PORT = Number(process.env.PORT || 4173);
const SHOULD_OPEN = process.argv.includes('--open');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function resolveRequestPath(url) {
  const parsedUrl = new URL(url, `http://localhost:${DEFAULT_PORT}`);
  const decodedPath = decodeURIComponent(parsedUrl.pathname);
  const safePath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
  const requestedPath = path.join(ROOT, safePath);

  if (!requestedPath.startsWith(ROOT)) {
    return null;
  }

  return requestedPath;
}

function send(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function openBrowser(url) {
  const command = process.platform === 'win32'
    ? `powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process '${url}'"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;

  exec(command, error => {
    if (error) {
      console.log(`Could not open browser automatically. Visit ${url}`);
    }
  });
}

const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    send(res, 405, 'Method Not Allowed');
    return;
  }

  let filePath = resolveRequestPath(req.url);
  if (!filePath) {
    send(res, 403, 'Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      send(res, error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? 'Not Found' : 'Server Error');
      return;
    }

    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    res.end(content);
  });
});

server.listen(DEFAULT_PORT, () => {
  const url = `http://localhost:${DEFAULT_PORT}/`;
  console.log(`Lotto Master is running at ${url}`);
  console.log('Keep this terminal open while using the app.');

  if (SHOULD_OPEN) {
    openBrowser(url);
  }
});
