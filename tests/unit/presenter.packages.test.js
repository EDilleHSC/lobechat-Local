/** @jest-environment node */
const request = require('supertest');
const path = require('path');
const fs = require('fs');

jest.setTimeout(30000); // allow up to 30s for zipping

let app;
let server;

beforeAll(() => {
  // require the presenter server module which should export both app and __testServer
  const mod = require('../../scripts/serve_presenter.js'); // adjust path if needed
  app = mod;
  server = mod.__testServer; // server handle returned when starting the server
});

afterAll(async () => {
  // close server if present and wait for callback
  if (server && typeof server.close === 'function') {
    await new Promise(resolve => server.close(resolve));
  }
});

test('GET /api/packages returns array', async () => {
  const res = await request(server).get('/api/packages');
  expect(res.statusCode).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('GET /presenter/packages.html served', async () => {
  const res = await request(server).get('/presenter/packages.html');
  expect(res.statusCode).toBe(200);
  expect(res.text).toContain('NAVI Packages');
});

test('GET /api/packages/:pkg/download returns zip', async () => {
  // create a temp package in the packages dir
  const packagesDir = path.join(__dirname, '..', '..', 'NAVI', 'packages');
  const pkgName = 'test_pkg_for_download';
  const pkgDir = path.join(packagesDir, pkgName);
  if (!fs.existsSync(packagesDir)) fs.mkdirSync(packagesDir, { recursive: true });
  if (!fs.existsSync(pkgDir)) fs.mkdirSync(pkgDir, { recursive: true });
  // add a small file
  fs.writeFileSync(path.join(pkgDir, 'foo.txt'), 'hello');

  const res = await request(server)
    .get(`/api/packages/${encodeURIComponent(pkgName)}/download`)
    .buffer(true)
    .parse((res, callback) => {
      const data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(data)));
    });

  expect(res.statusCode).toBe(200);
  expect(res.headers['content-type']).toMatch(/zip/);
  expect(res.body.length).toBeGreaterThan(0);

  // cleanup
  fs.rmSync(pkgDir, { recursive: true, force: true });
});

test('GET /api/packages/:pkg/files 404 for missing package', async () => {
  const res = await request(server).get('/api/packages/doesnotexist/files');
  expect(res.statusCode).toBe(404);
});

// Note: for full integration tests, a test-specific package dir should be created and cleaned up
