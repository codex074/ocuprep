// GET /api/patient?hn= — a signed-in YATA user asks for a patient's name; the answer comes from EMR Viewer.
import { handlePatient, send } from './_lib/lookupCore.js';

export default async function handler(req, res) {
  const hn = new URL(req.url, 'http://localhost').searchParams.get('hn');
  send(res, await handlePatient({
    method: req.method,
    origin: req.headers.origin,
    host: req.headers.host,
    authorization: req.headers.authorization,
    hn,
    env: process.env,
    fetchImpl: fetch,
  }));
}
