// PATCH /api/admin/draft  (save edits to AI draft text without delivering)
// GET   /api/admin/draft?id=<id>  (fetch a single audit row for the editor)

import { getAuditById, updateDrafts } from '../../lib/db.js';

function checkAdmin(req) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const provided = req.headers['x-admin-token'] ?? req.query?.t;
  return provided === token;
}

export default async function handler(req, res) {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'unauthorized' });

  if (req.method === 'GET') {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
      const row = await getAuditById(id);
      if (!row) return res.status(404).json({ error: 'not found' });
      return res.status(200).json(row);
    } catch (err) {
      return res.status(500).json({ error: 'db error', detail: String(err.message ?? err) });
    }
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    const { id, drafts } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id required' });
    if (!drafts || typeof drafts !== 'object') return res.status(400).json({ error: 'drafts required' });
    try {
      await updateDrafts(id, drafts);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: 'db error', detail: String(err.message ?? err) });
    }
  }

  return res.status(405).json({ error: 'method not allowed' });
}
