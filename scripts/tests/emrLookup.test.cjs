'use strict';

// Run: node --test scripts/tests/emrLookup.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { lookupPatientViaEmr, yataUserHeader } = require('../../electron/emrLookup.cjs');

const TOKEN = 'test-token';

// A stand-in for EMR Viewer's GET /api/yata/patient. `reply(req, url)` returns [status, body] or null to hang.
async function withStub(reply, run) {
  const seen = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://stub');
    seen.push({ path: url.pathname, hn: url.searchParams.get('hn'), auth: req.headers.authorization, user: req.headers['x-yata-user'] });
    const answer = reply(req, url);
    if (!answer) return; // never answers: the client must time out
    res.writeHead(answer[0], { 'Content-Type': 'application/json' });
    res.end(typeof answer[1] === 'string' ? answer[1] : JSON.stringify(answer[1]));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    return await run({ baseUrl, seen });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

const ask = (baseUrl, extra = {}) => lookupPatientViaEmr({
  fetchImpl: fetch, baseUrl, token: TOKEN, hn: '000123456', user: 'pha01', ...extra,
});

test('found: returns the patient and sends the token, the user and the HN', async () => {
  await withStub(() => [200, {
    ok: true, searchType: 'hn',
    patient: { hn: '000123456', an: '', ward: '', pname: 'นาย', fname: 'ทดสอบ', lname: 'ระบบ', fullName: 'นายทดสอบ ระบบ' },
  }], async ({ baseUrl, seen }) => {
    const result = await ask(baseUrl);
    assert.equal(result.ok, true);
    assert.equal(result.patient.fullName, 'นายทดสอบ ระบบ');
    assert.equal(result.patient.hn, '000123456');
    assert.equal(result.failure, undefined);
    assert.deepEqual(seen, [{ path: '/api/yata/patient', hn: '000123456', auth: `Bearer ${TOKEN}`, user: 'pha01' }]);
  });
});

test('404 is a real "not found", not a failure', async () => {
  await withStub(() => [404, { ok: false, message: 'ไม่พบข้อมูลผู้ป่วย' }], async ({ baseUrl }) => {
    const result = await ask(baseUrl);
    assert.equal(result.ok, false);
    assert.equal(result.failure, undefined);
    assert.match(result.message, /000123456/);
  });
});

test('a bare 404 (route missing, wrong URL) is a failure', async () => {
  await withStub(() => [404, 'Not Found'], async ({ baseUrl }) => {
    const result = await ask(baseUrl);
    assert.deepEqual([result.ok, result.failure], [false, true]);
  });
});

for (const status of [400, 401, 429, 500, 502]) {
  test(`${status} is a failure, never "not found"`, async () => {
    await withStub(() => [status, { ok: false, message: 'x' }], async ({ baseUrl }) => {
      const result = await ask(baseUrl);
      assert.equal(result.ok, false);
      assert.equal(result.failure, true);
    });
  });
}

test('200 with a body that is not JSON is a failure', async () => {
  await withStub(() => [200, '<html>login</html>'], async ({ baseUrl }) => {
    const result = await ask(baseUrl);
    assert.deepEqual([result.ok, result.failure], [false, true]);
  });
});

test('timeout is a failure', async () => {
  await withStub(() => null, async ({ baseUrl }) => {
    const result = await ask(baseUrl, { timeoutMs: 150 });
    assert.deepEqual([result.ok, result.failure], [false, true]);
  });
});

test('server unreachable is a failure', async () => {
  const result = await ask('http://127.0.0.1:1');
  assert.deepEqual([result.ok, result.failure], [false, true]);
});

test('no embedded token: failure without calling the server', async () => {
  let called = false;
  const result = await lookupPatientViaEmr({
    fetchImpl: async () => { called = true; }, baseUrl: 'http://127.0.0.1:1', token: '', hn: '000123456', user: 'pha01',
  });
  assert.equal(called, false);
  assert.deepEqual([result.ok, result.failure], [false, true]);
});

test('yataUserHeader keeps printable ASCII, caps at 64, falls back when empty', () => {
  assert.equal(yataUserHeader('pha01'), 'pha01');
  assert.equal(yataUserHeader('เภสัช pha 01'), 'pha01');
  assert.equal(yataUserHeader('', 'desktop:PC-01'), 'desktop:PC-01');
  assert.equal(yataUserHeader(undefined, 'ห้องยา'), 'yata-desktop');
  assert.equal(yataUserHeader('a'.repeat(100)).length, 64);
});
