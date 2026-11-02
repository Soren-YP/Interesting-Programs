// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import {
  createAppServer,
  extractTitle,
  validateRemoteUrl,
} from '../server/app.js';

let server;

afterEach(async () => {
  if (!server?.listening) return;
  await new Promise((resolve) => server.close(resolve));
  server = null;
});

describe('local helper service', () => {
  it('validates protocols and extracts a safe title', () => {
    expect(validateRemoteUrl('https://example.com').hostname).toBe('example.com');
    expect(() => validateRemoteUrl('file:///etc/passwd')).toThrow(/HTTP/);
    expect(extractTitle('<title> A &amp; B </title>')).toBe('A & B');
  });

  it('rejects non-local origins before making a request', async () => {
    server = createAppServer({ serveFiles: false });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://attacker.example',
      },
      body: JSON.stringify({ url: 'https://example.com/' }),
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/本地来源/),
    });
  });

  it('rejects invalid protocols without network access', async () => {
    server = createAppServer({ serveFiles: false });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://127.0.0.1:5173',
      },
      body: JSON.stringify({ url: 'javascript:alert(1)' }),
    });
    expect(response.status).toBe(400);
  });
});
