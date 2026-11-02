import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const MAX_BODY_BYTES = 64 * 1024;
const MAX_HTML_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 5;
const CHECK_CONCURRENCY = 5;
const ALLOWED_ORIGINS = new Set([
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://127.0.0.1:4174',
  'http://localhost:4174',
]);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
};

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function isAllowedOrigin(request) {
  const origin = request.headers.origin;
  return !origin || ALLOWED_ORIGINS.has(origin);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('请求内容过大。');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  }
  catch {
    const error = new Error('请求 JSON 无法解析。');
    error.statusCode = 400;
    throw error;
  }
}

export function validateRemoteUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) {
    throw new Error('网址格式无效。');
  }
  let url;
  try {
    url = new URL(value);
  }
  catch {
    throw new Error('网址格式无效。');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('只允许 HTTP 或 HTTPS 网址。');
  }
  if (url.username || url.password || !url.hostname) {
    throw new Error('网址包含不受支持的内容。');
  }
  return url;
}

async function fetchWithRedirects(value, {
  method = 'GET',
  maxRedirects = MAX_REDIRECTS,
} = {}) {
  let url = validateRemoteUrl(value);
  let redirects = 0;

  while (true) {
    const response = await fetch(url, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: method === 'HEAD'
          ? '*/*'
          : 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.2',
        'User-Agent': 'StarBookmarks/1.0 (local bookmark manager)',
        ...(method === 'GET' ? { Range: `bytes=0-${MAX_HTML_BYTES - 1}` } : {}),
      },
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, finalUrl: url.href, redirects };
    }

    const location = response.headers.get('location');
    if (!location) return { response, finalUrl: url.href, redirects };
    redirects += 1;
    if (redirects > maxRedirects) throw new Error('网页重定向次数过多。');
    url = validateRemoteUrl(new URL(location, url).href);
  }
}

async function readLimitedText(response) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_HTML_BYTES) {
      const remaining = value.slice(0, value.byteLength - (size - MAX_HTML_BYTES));
      if (remaining.byteLength) chunks.push(remaining);
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return new TextDecoder('utf-8').decode(buffer);
}

function decodeHtmlEntities(value) {
  const entities = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };
  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (match, entity) => {
      if (entity[0] === '#') {
        const isHex = entity[1].toLocaleLowerCase() === 'x';
        const number = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        return Number.isFinite(number) ? String.fromCodePoint(number) : match;
      }
      return entities[entity.toLocaleLowerCase()] ?? match;
    },
  );
}

export function extractTitle(html) {
  const match = html.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i);
  if (!match) return '';
  return decodeHtmlEntities(match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
    .slice(0, 200);
}

async function fetchMetadata(url) {
  const { response, finalUrl, redirects } = await fetchWithRedirects(url);
  const contentType = response.headers.get('content-type') ?? '';
  const html = contentType.includes('text/html') || contentType.includes('application/xhtml+xml')
    ? await readLimitedText(response)
    : '';
  return {
    url,
    finalUrl,
    redirected: redirects > 0,
    status: response.status,
    ok: response.status >= 200 && response.status < 400,
    title: extractTitle(html) || new URL(finalUrl).hostname.replace(/^www\./i, ''),
  };
}

async function checkOneLink(url) {
  const checkedAt = new Date().toISOString();
  try {
    let result = await fetchWithRedirects(url, { method: 'HEAD' });
    if ([403, 405, 501].includes(result.response.status)) {
      result = await fetchWithRedirects(url, { method: 'GET' });
      await result.response.body?.cancel();
    }
    const { response, finalUrl, redirects } = result;
    const ok = response.status >= 200 && response.status < 500;
    return {
      url,
      finalUrl,
      statusCode: response.status,
      state: ok ? (redirects > 0 ? 'redirected' : 'ok') : 'error',
      checkedAt,
      message: ok ? '' : `HTTP ${response.status}`,
    };
  }
  catch (error) {
    return {
      url,
      finalUrl: null,
      statusCode: null,
      state: 'error',
      checkedAt,
      message: error.name === 'TimeoutError' ? '请求超时' : error.message.slice(0, 200),
    };
  }
}

async function mapConcurrent(items, limit, task) {
  const results = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index], index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

async function handleApiRequest(request, response, pathname) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: '只允许 POST 请求。' });
    return;
  }
  if (!isAllowedOrigin(request)) {
    sendJson(response, 403, { error: '拒绝非本地来源的请求。' });
    return;
  }

  try {
    const body = await readJsonBody(request);
    if (pathname === '/api/metadata') {
      const url = validateRemoteUrl(body.url).href;
      sendJson(response, 200, await fetchMetadata(url));
      return;
    }
    if (pathname === '/api/check-links') {
      if (!Array.isArray(body.urls) || body.urls.length < 1 || body.urls.length > 50) {
        sendJson(response, 400, { error: '一次需要提交 1–50 个网址。' });
        return;
      }
      const urls = [...new Set(body.urls.map((value) => validateRemoteUrl(value).href))];
      const results = await mapConcurrent(urls, CHECK_CONCURRENCY, checkOneLink);
      sendJson(response, 200, { results });
      return;
    }
    sendJson(response, 404, { error: '接口不存在。' });
  }
  catch (error) {
    sendJson(response, error.statusCode ?? 400, {
      error: error.message || '请求处理失败。',
    });
  }
}

async function serveStatic(response, pathname, distDirectory) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded === '/' ? '/index.html' : decoded;
  let filePath = resolve(distDirectory, `.${relative}`);
  const root = `${resolve(distDirectory)}${sep}`;
  if (!filePath.startsWith(root) && filePath !== resolve(distDirectory, 'index.html')) {
    sendJson(response, 403, { error: '禁止访问该路径。' });
    return;
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  }
  catch {
    filePath = resolve(distDirectory, 'index.html');
    if (!existsSync(filePath)) {
      sendJson(response, 503, { error: '尚未构建前端，请先运行 npm run build。' });
      return;
    }
    fileStat = await stat(filePath);
  }
  if (!fileStat.isFile()) {
    sendJson(response, 404, { error: '文件不存在。' });
    return;
  }

  const extension = extname(filePath).toLocaleLowerCase();
  const immutable = filePath.includes(`${sep}assets${sep}`);
  response.writeHead(200, {
    'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
    'Content-Length': fileStat.size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Opener-Policy': 'same-origin',
  });
  createReadStream(filePath).pipe(response);
}

export function createAppServer({
  distDirectory = resolve(process.cwd(), 'dist'),
  serveFiles = true,
} = {}) {
  return createServer(async (request, response) => {
    const base = `http://${request.headers.host ?? '127.0.0.1'}`;
    let pathname;
    try {
      pathname = new URL(request.url ?? '/', base).pathname;
    }
    catch {
      sendJson(response, 400, { error: '请求地址无效。' });
      return;
    }

    if (pathname.startsWith('/api/')) {
      await handleApiRequest(request, response, pathname);
      return;
    }
    if (!serveFiles) {
      sendJson(response, 404, { error: '开发 API 服务不提供静态文件。' });
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method ?? '')) {
      sendJson(response, 405, { error: '请求方法不受支持。' });
      return;
    }
    await serveStatic(response, pathname, distDirectory);
  });
}
