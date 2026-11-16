// POST /api/lookup-session — exchanges a YATA login (pha_id + password) for a short-lived lookup session.
import { handleLookupSession, send } from './_lib/lookupCore.js';

export default async function handler(req, res) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  send(res, await handleLookupSession({
    method: req.method,
    origin: req.headers.origin,
    host: req.headers.host,
    body,
    env: process.env,
    fetchImpl: fetch,
  }));
}
