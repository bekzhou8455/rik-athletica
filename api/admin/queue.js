// GET /api/admin/queue?status=drafted|delivered|converted|all&t=<ADMIN_TOKEN>
// Returns a list of audit rows for the admin queue UI.

import { listAudits, getStats } from '../../lib/db.js';

function checkAdmin(req) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const provided = req.headers['x-admin-token'] ?? req.query?.t;
  return provided === token;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  if (!checkAdmin(req)) return res.status(401).json({ error: 'unauthorized' });

  const status = String(req.query?.status ?? 'drafted');
  const allowed = ['drafted', 'delivered', 'converted', 'all'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${allowed.join(', ')}` });
  }

  try {
    const [rows, stats] = await Promise.all([
      listAudits({ status, limit: 100, offset: 0 }),
      getStats(),
    ]);
    return res.status(200).json({ rows, stats });
  } catch (err) {
    console.error('[admin/queue] db error:', err);
    return res.status(500).json({ error: 'db error', detail: String(err.message ?? err) });
  }
}
