import { join } from "path";

const PORT = 3456;
const DIR = import.meta.dir;
const LEADS_FILE = join(DIR, "leads.csv");

// Set via: REWARDFUL_KEY=xxx bun serve.ts
const REWARDFUL_KEY = process.env.REWARDFUL_KEY || "";

// Named page routes → static files
const ROUTES: Record<string, string> = {
  "/": "/wireframe.html",
  "/sprint": "/sprint.html",
  "/calculator": "/calculator.html",
  "/thank-you": "/thank-you.html",
  "/privacy": "/privacy.html",
  "/terms": "/terms.html",
};

// Serves a tiny redirect page that sets the Rewardful attribution cookie
// before forwarding to /sprint. The 'ready' callback fires once Rewardful
// has processed the slug. Fallback timeout prevents a stuck blank page.
//
//   /ref/[slug]
//        │
//        ▼  Rewardful JS loads → sets 30-day cookie
//        ▼  rewardful('ready') fires → redirect to /sprint
//        ▼  (timeout 1500ms fallback in case Rewardful CDN is slow)
//        │
//   /sprint  ← Rewardful cookie rides all subsequent page loads
//
function rewardfulRedirectPage(): string {
  const snippet = REWARDFUL_KEY
    ? `<script async src="https://r.wdfl.co/rw.js" data-rewardful="${REWARDFUL_KEY}"></script>
  <script>(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');</script>`
    : "";
  const redirect = REWARDFUL_KEY
    ? `rewardful('ready', doRedirect);`
    : `doRedirect();`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex">
  <title>RIK Athletica</title>
  ${snippet}
  <script>
    var redirected = false;
    function doRedirect() { if (!redirected) { redirected = true; window.location.replace('/sprint'); } }
    ${redirect}
    setTimeout(doRedirect, 1500);
  </script>
</head>
<body></body>
</html>`;
}

// Ensure leads CSV has a header row on first run
async function ensureLeadsFile() {
  const file = Bun.file(LEADS_FILE);
  if (!(await file.exists())) {
    await Bun.write(LEADS_FILE, "email,source,ts\n");
  }
}
ensureLeadsFile();

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Lead capture — POST /api/leads
    // Body: { email: string, source?: string }
    if (pathname === "/api/leads" && req.method === "POST") {
      try {
        const body = await req.json() as { email?: string; source?: string };
        const email = (body.email || "").trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return new Response(JSON.stringify({ error: "Invalid email" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const source = (body.source || "calculator").replace(/[,\n\r]/g, "");
        const ts = new Date().toISOString();
        // Append to CSV; check for duplicates is intentionally omitted for simplicity
        await Bun.write(LEADS_FILE, await Bun.file(LEADS_FILE).text() + `${email},${source},${ts}\n`);
        console.log(`[leads] ${email} via ${source}`);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ error: "Bad request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Affiliate referral route — dynamic slug, always redirects to /sprint
    // Invalid slugs are handled gracefully: Rewardful sets no cookie, /sprint loads normally.
    if (pathname.startsWith("/ref/")) {
      return new Response(rewardfulRedirectPage(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Resolve named routes; fall through to raw path for /assets/* etc.
    const filePath = ROUTES[pathname] ?? pathname;
    const file = Bun.file(join(DIR, filePath));

    if (!(await file.exists())) {
      const notFound = Bun.file(join(DIR, "/404.html"));
      if (await notFound.exists()) {
        return new Response(notFound, {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      return new Response("Not found", { status: 404 });
    }

    const size = file.size;
    const rangeHeader = req.headers.get("range");

    // Range request support (needed for video streaming in Safari/Chrome)
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : size - 1;
        const chunkSize = end - start + 1;
        return new Response(file.slice(start, end + 1), {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunkSize),
            "Content-Type": file.type || "application/octet-stream",
          },
        });
      }
    }

    return new Response(file, {
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(size),
      },
    });
  },
});

console.log(`Serving on http://localhost:${PORT}`);
console.log(`Rewardful: ${REWARDFUL_KEY ? "configured ✓" : "not set (affiliate tracking disabled)"}`);
