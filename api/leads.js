// Vercel serverless function — POST /api/leads
// Captures calculator email gate submissions.
// Logs to Vercel function logs (visible in dashboard → Logs tab).
// Swap body for Airtable/Resend/etc. when ready for production storage.

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, source } = req.body || {};
  const cleaned = (email || '').trim().toLowerCase();

  if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const src = (source || 'calculator').replace(/[^a-z0-9_-]/gi, '');
  const ts  = new Date().toISOString();

  // Visible in Vercel dashboard → Logs tab for your project
  console.log(`[lead] ${cleaned} | source=${src} | ts=${ts}`);

  return res.status(200).json({ ok: true });
}
