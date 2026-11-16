'use strict';

// Patient name lookup through EMR Viewer (HIS-connect): GET {baseUrl}/api/yata/patient?hn=
// with `Authorization: Bearer <token>` and `X-Yata-User: <who is asking>` (EMR audits and rate-limits by it).
// Replaces the direct HOSxP API at 172.17.1.70:3000, which was shut down.
// No Electron imports here, so scripts/tests/emrLookup.test.cjs can run it under plain Node.

const DEFAULT_EMR_LOOKUP_URL = 'https://emr.codex074.com';
const LOOKUP_TIMEOUT_MS = 8000;
const FAILURE_MESSAGE = 'เชื่อมต่อ HOSxP ไม่สำเร็จ (token อาจไม่ถูกต้อง หรือเครือข่ายขัดข้อง) กรุณาติดต่อผู้ดูแลระบบ';

// X-Yata-User must be printable ASCII (it is an HTTP header) and at most 64 characters.
function yataUserHeader(user, fallback) {
  const clean = (value) => String(value ?? '').replace(/[^\x21-\x7e]/g, '').slice(0, 64);
  return clean(user) || clean(fallback) || 'yata-desktop';
}

// Resolves to the shape the `lookup-hn` IPC has always returned:
//   found            { ok: true, patient }
//   no such patient  { ok: false, message }                 (EMR answered 404 with { ok: false })
//   could not ask    { ok: false, failure: true, message }  (anything else: 401, 429, 502, network, timeout)
async function lookupPatientViaEmr({ fetchImpl, baseUrl, token, hn, user, timeoutMs = LOOKUP_TIMEOUT_MS }) {
  if (!token) {
    return { ok: false, failure: true, message: 'แอปชุดนี้ไม่ได้ฝัง Token สำหรับค้นชื่อผู้ป่วย' };
  }
  const url = new URL('/api/yata/patient', baseUrl || DEFAULT_EMR_LOOKUP_URL);
  url.searchParams.set('hn', hn);

  let status;
  let body = {};
  try {
    const res = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'X-Yata-User': yataUserHeader(user) },
      signal: AbortSignal.timeout(timeoutMs),
    });
    status = res.status;
    try { body = await res.json(); } catch { body = {}; }
  } catch (e) {
    console.error('[HN] EMR lookup failed:', e?.message);
    return { ok: false, failure: true, message: FAILURE_MESSAGE };
  }

  if (status === 200 && body?.ok && body.patient?.fullName) {
    const p = body.patient;
    return {
      ok: true,
      patient: {
        source: 'emr/yata',
        hn: p.hn || '',
        vn: '',
        qn: '',
        pname: p.pname || '',
        fname: p.fname || '',
        lname: p.lname || '',
        fullName: p.fullName,
      },
    };
  }
  // A 404 without EMR's own JSON body means the route is missing or the URL is wrong: that is a failure.
  if (status === 404 && body?.ok === false) {
    return { ok: false, message: `ไม่พบข้อมูลผู้ป่วย (HN: ${hn})` };
  }
  console.error('[HN] EMR lookup non-200:', status);
  return {
    ok: false,
    failure: true,
    message: status === 429 ? 'ค้นบ่อยเกินไป กรุณารอสักครู่' : FAILURE_MESSAGE,
  };
}

module.exports = { DEFAULT_EMR_LOOKUP_URL, lookupPatientViaEmr, yataUserHeader };
