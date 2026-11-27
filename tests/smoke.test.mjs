import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;

let tmpDir;
let serverProc;

async function waitForHealth() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return await res.json();
    } catch {
      // Wait for startup
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Server did not become healthy in time');
}

test.before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tolk-test-'));
  const dataDir = path.join(tmpDir, 'data');
  const uploadsDir = path.join(tmpDir, 'uploads');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });

  serverProc = spawn('node', ['dist-server/server.mjs'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      DATA_DIR: dataDir,
      UPLOADS_DIR: uploadsDir,
      SESSION_SECRET: 'test-session-secret-key-at-least-32-chars',
      MYSQL_URL: '',
      MYSQL_HOST: '',
    },
    stdio: 'pipe',
  });

  await waitForHealth();
});

test.after(() => {
  if (serverProc && !serverProc.killed) {
    serverProc.kill();
  }
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('health & readiness endpoints return ok/ready', async () => {
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  assert.equal(health.ok, true);
  assert.equal(health.service, 'lunola-talk');

  const readyRes = await fetch(`${BASE}/api/ready`);
  assert.equal(readyRes.status, 200);
  const ready = await readyRes.json();
  assert.equal(ready.ready, true);
});

test('auth register, login, QR POST status, magic-byte upload, and logout', async () => {
  const username = `tester_${Date.now().toString(36)}`;
  const regRes = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      displayName: 'Test User',
      password: 'Password123!',
    }),
  });
  assert.equal(regRes.status, 201);
  const regData = await regRes.json();
  assert.ok(regData.token);

  // QR create + POST status (no secret in URL query)
  const qrRes = await fetch(`${BASE}/api/auth/qr/create`, { method: 'POST' });
  assert.equal(qrRes.status, 200);
  const qr = await qrRes.json();
  assert.ok(qr.challengeId && qr.secret);

  const statusRes = await fetch(`${BASE}/api/auth/qr/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId: qr.challengeId, secret: qr.secret }),
  });
  assert.equal(statusRes.status, 200);
  const statusData = await statusRes.json();
  assert.equal(statusData.status, 'pending');

  // Spoofed PNG (actually plain text) must be rejected by magic-byte check
  const fakePng = `data:image/png;base64,${Buffer.from('not a real png').toString('base64')}`;
  const badUpload = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${regData.token}`,
    },
    body: JSON.stringify({ dataUrl: fakePng, name: 'fake.png' }),
  });
  assert.equal(badUpload.status, 400);

  // Valid 1x1 PNG must succeed
  const validPngB64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const goodUpload = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${regData.token}`,
    },
    body: JSON.stringify({
      dataUrl: `data:image/png;base64,${validPngB64}`,
      name: 'pixel.png',
    }),
  });
  assert.equal(goodUpload.status, 201);

  const logoutRes = await fetch(`${BASE}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${regData.token}` },
  });
  assert.equal(logoutRes.status, 200);
});
