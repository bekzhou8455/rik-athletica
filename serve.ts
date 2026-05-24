import { join } from "path";

const PORT = parseInt(process.env.PORT || "3456", 10);
const DIR = import.meta.dir;
const LEADS_FILE = join(DIR, "leads.csv");

// Set via: REWARDFUL_KEY=xxx bun serve.ts
const REWARDFUL_KEY = process.env.REWARDFUL_KEY || "";

// Named page routes → static files
// Per v3 brief: Bundle IS the homepage at /. No separate bundle page.
const ROUTES: Record<string, string> = {
  "/": "/index.html",
  "/sprint": "/sprint.html",
  "/audit": "/audit.html",
  "/why-you-bonked": "/why-you-bonked.html",
  "/race-review": "/race-review.html",
  "/checkin": "/checkin.html",
  "/thank-you": "/thank-you.html",
  "/privacy": "/privacy.html",
  "/terms": "/terms.html",
};

// 301 redirects — deprecated URLs route to canonical destinations
const REDIRECTS: Record<string, string> = {
  "/bundle": "/",
  "/bundle.html": "/",
  "/calculator": "/audit",
  "/calculator.html": "/audit",
  "/premium": "/sprint",
  "/premium.html": "/sprint",
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

// Email previewer index — lists transactional + nurture templates with links
function emailIndexPage(): string {
  // Section type allows optional `path` override for nested folders (nurture/*)
  type Section = {
    title: string;
    tier: string;        // used for /emails/<tier>/<file> URL when path is absent
    path?: string;       // when set, /emails/<path>/<file> instead
    blurb?: string;      // optional 1-line description under the section header
    items: Array<{ file: string; name: string; trigger: string; tag: string }>;
  };

  const transactionalSections: Section[] = [
    {
      title: "Premium ($1,599) — 5 emails",
      tier: "premium",
      items: [
        { file: "01-confirmation.html",       name: "P1 — Enrollment confirmation",   trigger: "Stripe webhook (auto)",            tag: "AUTO" },
        { file: "02-intake-prompt.html",      name: "P2 — Intake reminder (Day +1)",  trigger: "Cron daily-sweep",                 tag: "AUTO" },
        { file: "03-weekly-checkin.html",     name: "P3 — Weekly check-in",           trigger: "Cron Mondays during 4-wk window",  tag: "AUTO" },
        { file: "04-rik-direct-go-live.html", name: "P4 — RIK Direct goes live",      trigger: "Cron Day −7 from race date",       tag: "AUTO" },
        { file: "05-post-race-debrief.html",  name: "P5 — Post-race debrief",         trigger: "Cron Day +14 from race date",      tag: "AUTO" },
      ],
    },
    {
      title: "Sprint ($569 / $659 / $899) — 5 emails",
      tier: "sprint",
      items: [
        { file: "01-screening-pass.html",        name: "S1 — Screening pass",          trigger: "/api/screen returns pass",    tag: "AUTO" },
        { file: "02-screening-fail.html",        name: "S2 — Screening fail",          trigger: "/api/screen returns fail",    tag: "AUTO" },
        { file: "03-intake-prompt.html",         name: "S3 — Intake prompt",           trigger: "Stripe webhook + Day +1",     tag: "AUTO" },
        { file: "04-weekly-checkin.html",        name: "S4 — Weekly check-in",         trigger: "Cron Mondays during 4-wk window", tag: "AUTO" },
        { file: "05-shipment-notification.html", name: "S5 — Shipment notification",   trigger: "Bek manual trigger",          tag: "MANUAL" },
      ],
    },
    {
      title: "Bundle ($119) — 2 emails",
      tier: "bundle",
      items: [
        { file: "01-confirmation.html",          name: "B1 — Order confirmation",      trigger: "Stripe webhook (auto)",       tag: "AUTO" },
        { file: "02-shipment-notification.html", name: "B2 — Shipment notification",   trigger: "Bek manual trigger",          tag: "MANUAL" },
      ],
    },
  ];

  const nurtureSections: Section[] = [
    {
      title: "Post-Audit Nurture — 4 emails",
      tier: "nurture-post-audit",
      path: "nurture/post-audit",
      blurb: "Kit sequence after audit deliverable lands. Tag: post-audit-nurture. Exit on Sprint/Bundle purchase. Single sitewide promo: WELCOME15.",
      items: [
        { file: "01-day2-translate-audit-to-action.html", name: "PA1 — Translate audit → action", trigger: "Day +2 after audit deliverable",   tag: "KIT" },
        { file: "02-day5-customer-story.html",            name: "PA2 — Customer story (ON HOLD)", trigger: "Day +5 — disabled until real customer story",  tag: "HOLD" },
        { file: "03-day9-sprint-cta-with-discount.html",  name: "PA3 — Sprint CTA + WELCOME15",   trigger: "Day +9",                          tag: "KIT" },
        { file: "04-day14-soft-bundle-ask.html",          name: "PA4 — Soft Bundle ask (last touch)", trigger: "Day +14 (final touch)",         tag: "KIT" },
      ],
    },
    {
      title: "Cart Abandonment — 3 emails",
      tier: "nurture-cart-abandonment",
      path: "nurture/cart-abandonment",
      blurb: "Kit sequence after Stripe checkout.session.expired. Tag: cart-recovery-{tier}. Exit on payment.",
      items: [
        { file: "01-1hour-soft-touch.html",            name: "C1 — Soft touch (no discount)",   trigger: "+1 hour after checkout expired",  tag: "KIT" },
        { file: "02-day1-talk-it-through.html",        name: "C2 — Talk it through (WhatsApp)", trigger: "Day +1",                          tag: "KIT" },
        { file: "03-day3-welcome15-last-call.html",    name: "C3 — WELCOME15 last call",        trigger: "Day +3 (final touch)",            tag: "KIT" },
      ],
    },
    {
      title: "Bundle → Sprint Upsell — 3 emails",
      tier: "nurture-bundle-to-sprint",
      path: "nurture/bundle-to-sprint",
      blurb: "Kit sequence after Bundle purchase. Tag: bundle-to-sprint-upsell. Exit on Sprint purchase.",
      items: [
        { file: "01-day14-how-were-the-gels.html",   name: "BU1 — How were the gels?",        trigger: "Day +14 post-Bundle-purchase",  tag: "KIT" },
        { file: "02-day30-race-coming.html",         name: "BU2 — Race in next 8 weeks?",     trigger: "Day +30",                       tag: "KIT" },
        { file: "03-day60-final-touch.html",         name: "BU3 — Final touch",               trigger: "Day +60 (final touch)",         tag: "KIT" },
      ],
    },
  ];

  const renderSection = (s: Section) => {
    const basePath = s.path ?? s.tier;
    return `
      <h2 style="font-size:14px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#5A5853;margin:40px 0 8px;padding-bottom:8px;border-bottom:1px dashed rgba(14,14,14,.18)">${s.title}</h2>
      ${s.blurb ? `<p style="margin:0 0 16px;font-size:12px;line-height:1.6;color:#8A8780;letter-spacing:.02em">${s.blurb}</p>` : ""}
      <ul style="list-style:none;padding:0;margin:0">
        ${s.items.map(i => {
          const tagColor = i.tag === "MANUAL" ? "#7a4a2a"
                          : i.tag === "KIT"    ? "#2a5a4a"
                          : i.tag === "HOLD"   ? "#a02e2e"
                          : "#5A5853";
          const tagBorder = i.tag === "MANUAL" ? "#7a4a2a"
                          : i.tag === "KIT"    ? "#2a5a4a"
                          : i.tag === "HOLD"   ? "#a02e2e"
                          : "rgba(14,14,14,.18)";
          return `
          <li style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px dashed rgba(14,14,14,.10)">
            <div>
              <a href="/emails/${basePath}/${i.file}" target="_blank" style="font-size:15px;font-weight:500;color:#0E0E0E;text-decoration:none;border-bottom:1px solid rgba(14,14,14,.25);">${i.name}</a>
              <div style="font-size:12px;color:#5A5853;margin-top:4px;letter-spacing:.04em">Trigger: ${i.trigger}</div>
            </div>
            <span style="font-size:10px;font-weight:600;letter-spacing:.18em;color:${tagColor};border:1px solid ${tagBorder};padding:4px 10px;border-radius:999px;text-transform:uppercase">${i.tag}</span>
          </li>
        `;
        }).join("")}
      </ul>
    `;
  };

  const transactionalHtml = transactionalSections.map(renderSection).join("");
  const nurtureHtml       = nurtureSections.map(renderSection).join("");

  const sectionsHtml = `
    <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#0E0E0E;margin-top:32px">Phase 1 — Transactional (Resend, event-triggered)</p>
    ${transactionalHtml}
    <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#0E0E0E;margin-top:48px">Phase 3a — Nurture sequences (Kit-driven, lifecycle)</p>
    ${nurtureHtml}
  `;

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Email previewer — RIK Athletica</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap">
</head>
<body style="margin:0;padding:0;background:#EEEDEA;font-family:'Outfit',-apple-system,BlinkMacSystemFont,sans-serif;color:#0E0E0E">
<div style="max-width:760px;margin:0 auto;padding:60px 32px">
  <p style="margin:0 0 12px;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#5A5853">Internal · noindex</p>
  <h1 style="margin:0 0 12px;font-size:42px;font-weight:700;line-height:1;letter-spacing:-.02em">Email Previewer.</h1>
  <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#5A5853;max-width:60ch">12 transactional templates + 10 nurture-sequence templates rendered with sample tokens. Click a row to open the email in a new tab — what athletes will see in their inbox.</p>
  <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#8A8780;max-width:60ch"><strong style="color:#5A5853">AUTO</strong> = Resend, fires from Stripe webhook or daily cron. <strong style="color:#7a4a2a">MANUAL</strong> = Resend dashboard send (tracking number in hand). <strong style="color:#2a5a4a">KIT</strong> = Kit/ConvertKit lifecycle sequence, exit triggers wired through Stripe webhook. See <code style="background:rgba(14,14,14,.06);padding:2px 6px;border-radius:4px">emails/README.md</code> + <code style="background:rgba(14,14,14,.06);padding:2px 6px;border-radius:4px">emails/nurture/README.md</code> for dispatch.</p>
  ${sectionsHtml}
  <p style="margin:48px 0 0;font-size:11px;color:#8A8780">Sample tokens used in previews: see <code style="background:rgba(14,14,14,.06);padding:2px 6px;border-radius:4px">serve.ts</code> sample-data block. Real customers get tokens substituted at send time by Resend.</p>
</div></body></html>`;
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

    // Email previewer — browse all 12 transactional templates locally with sample tokens
    // /emails              → index page listing all templates
    // /emails/<tier>/<file>  → renders template with sample-data substitution
    if (pathname === "/emails" || pathname === "/emails/") {
      return new Response(emailIndexPage(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (pathname.startsWith("/emails/") && pathname.endsWith(".html")) {
      const rel = pathname.replace(/^\/emails\//, "");
      const filePath = join(DIR, "emails", rel);
      const f = Bun.file(filePath);
      if (await f.exists()) {
        let html = await f.text();

        // Tier-specific sample tokens — preview must reflect each tier's
        // actual numbers so the $1,599-everywhere bug doesn't recur.
        const isPremium = rel.startsWith("premium/");
        const isSprint  = rel.startsWith("sprint/") || rel.startsWith("nurture/post-audit/03") || rel.startsWith("nurture/post-audit/04");
        const isBundle  = rel.startsWith("bundle/") || rel.startsWith("nurture/bundle-to-sprint/");
        const isNurturePostAudit       = rel.startsWith("nurture/post-audit/");
        const isNurtureCart            = rel.startsWith("nurture/cart-abandonment/");
        const isNurtureBundleToSprint  = rel.startsWith("nurture/bundle-to-sprint/");

        // Allow ?qty=N override for Bundle previews so multi-unit can be tested
        const qty = parseInt(url.searchParams.get("qty") || "2", 10) || 2;
        const bundleTotal = (qty * 119).toFixed(2);

        const tierTotal = isPremium ? "1,599.00"
                        : isSprint  ? "659.00"
                        : isBundle  ? bundleTotal
                        : "0.00";
        const tierName  = isPremium ? "Founding Cohort Premium"
                        : isSprint  ? "Sprint Full Ironman"
                        : isBundle  ? "RIK Bundle"
                        : "Order";
        const tierPrice = isPremium ? "1,599"
                        : isSprint  ? "659"
                        : isBundle  ? "119"
                        : "0";

        // Nurture-specific sample tokens
        const cartTier         = url.searchParams.get("cart_tier") || "Sprint Full Ironman";
        const cartPrice        = url.searchParams.get("cart_price") || "659";
        const cartPriceDiscount = (parseFloat(cartPrice.replace(",","")) * 0.85).toFixed(2);

        const samples: Record<string, string> = {
          "{{first_name}}":           "Alex",
          "{{full_name}}":            "Alex Hawkins",
          "{{email}}":                "alex@example.com",
          // Tier-correct totals so previews never lie about price
          "{{order_total}}":          tierTotal,
          "{{tier_name}}":            tierName,
          "{{tier_price}}":           tierPrice,
          "{{quantity}}":             isBundle ? String(qty) : "1",
          "{{quantity_suffix}}":      isBundle && qty > 1 ? "s" : "",
          "{{unit_price}}":           "119.00",
          "{{stripe_session_id}}":    "cs_live_a1b2c3d4e5f6",
          "{{intake_link}}":          isPremium
                                        ? "https://form.typeform.com/to/XT5Qo0HD?tier=premium"
                                        : "https://form.typeform.com/to/XT5Qo0HD?tier=sprint",
          "{{contract_link}}":        "https://app.hellosign.com/sign-request/sample",
          "{{stripe_link}}":          "https://buy.stripe.com/7sY28tfsW2887T07sA7Re03",
          "{{wa_link}}":              "https://wa.me/16263609822?text=Hi%20RIK%20%E2%80%94%20",
          "{{wa_link_personalized}}": "https://wa.me/16263609822?text=Hi%20RIK%20%E2%80%94%20Alex%2C%20Day%20%E2%88%927",
          "{{whatsapp_number}}":      "+1 (626) 360-9822",
          "{{checkin_link}}":         "https://www.rikathletica.com/checkin?session=cs_live_a1b2c3d4e5f6",
          "{{race_distance}}":        "Full Ironman",
          "{{race_date}}":            "Sun, June 14, 2026",
          "{{days_to_race}}":         "21",
          "{{days_until_race}}":      "7",
          "{{days_until_close}}":     "9",
          "{{week_n}}":               "2",
          "{{tracking_number}}":      "1Z999AA10123456784",
          "{{tracking_url}}":         "https://www.ups.com/track?tracknum=1Z999AA10123456784",
          "{{est_delivery}}":         "Tue, May 14, 2026",
          "{{carrier_name}}":         "UPS Ground",
          "{{shipment_label}}":       "Shipment 1 (Training Box)",
          "{{shipment_contents}}":    "1 × RIK Bundle (10 Euphoria + 20 Refuel) + Layer 1 products for Weeks 1–2 of Your protocol.",
          "{{packing_list}}":         "<ul style=\"margin:0;padding-left:18px;color:#5A5853\"><li>2 × RIK Bundle (10 Euphoria + 20 Refuel each) — sample preview</li><li>4 × Maurten Gel 100 — Layer 1 carb support</li><li>2 × Precision Hydration PH1500 tubes — sodium loading</li></ul>",
          "{{shipping_address}}":     "742 Evergreen Terrace, Springfield, IL 62701",
          "{{fail_reason}}":          "Your race is 21 days from sign-up — too close to allow gut adaptation",
          "{{unsubscribe}}":          "#preview-unsubscribe-disabled",

          // ── Nurture-sequence tokens (Phase 3a — Kit-driven) ─────────────────
          // Post-Audit nurture
          "{{audit_summary_oneliner}}":         "Your protocol is leaking ~22 minutes on bike-to-run hydration",
          "{{audit_url}}":                      "https://www.rikathletica.com/a/sample-slug",
          // Cart-abandonment nurture
          "{{tier_in_cart}}":                   cartTier,
          "{{tier_in_cart_price}}":             cartPrice,
          "{{tier_in_cart_price_discounted}}":  cartPriceDiscount,
          "{{stripe_resume_url}}":              "https://buy.stripe.com/7sY28tfsW2887T07sA7Re03",
          "{{stripe_resume_url_with_promo}}":   "https://buy.stripe.com/7sY28tfsW2887T07sA7Re03?prefilled_promo_code=WELCOME15",
          // Bundle→Sprint nurture
          "{{purchase_date_short}}":            "April 26, 2026",
          // Kit-required CAN-SPAM tokens (every nurture email needs these)
          "{{kit_profile_url}}":                "#preview-kit-profile-disabled",
          "{{unsubscribe_url}}":                "#preview-unsubscribe-disabled",
          "{{registered_address}}":             "Rik Athletic Nutrition Inc. · 477 Madison Ave, Fl 7, New York, NY 10022",
        };
        for (const [token, value] of Object.entries(samples)) {
          html = html.split(token).join(value);
        }
        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      return new Response("Email template not found", { status: 404 });
    }

    // 301 redirects for deprecated URLs
    if (REDIRECTS[pathname]) {
      return Response.redirect(REDIRECTS[pathname], 301);
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
