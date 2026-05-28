// GET /api/cron/daily-sweep  (called by Vercel Cron at 09:00 UTC daily)
// 1. Mark 14-day no-converts (cohort sweep) → tag in Kit
// 2. Send queue reminder email if pending ≥ 3 and oldest ≥ 4h
// 3. Send daily summary email to Bek
// 4. (May 2026) Send Sprint S1 cart-abandonment recovery emails
// 5. (May 2026) Send Sprint S2 screening-fail explainer emails
// 6. (May 2026) Purge sprint_screenings older than 18 months (retention policy)

import {
  listOldPending,
  markNoConvertCohort,
  getStats,
  findPendingS1Pass,
  findPendingS2Fail,
  markScreeningS1Sent,
  markScreeningS2Sent,
  purgeOldScreenings,
} from '../../lib/db.js';
// ESP migration 2026-05-28: Kit → Klaviyo.
// import { tagAuditNoConvert } from '../../lib/kit.js';
import { trackAuditNoConvert } from '../../lib/klaviyo.js';
import {
  alertQueueReminder,
  alertDailySummary,
  alertError,
} from '../../lib/email-alerts.js';
import { sendMail, mailerReady } from '../mailer.js';
import { renderTemplate } from '../../lib/email-renderer.js';

// ─── Sprint tier registry (mirrors sprint.html STRIPE_LINKS) ───
const SPRINT_TIERS = {
  low:  { name: 'Sprint 70.3',          price: 569, priceDiscounted: '483.65', stripeLink: 'https://buy.stripe.com/7sY9AVdkOdQQ3CKbIQ7Re02' },
  mid:  { name: 'Sprint Full Ironman',  price: 659, priceDiscounted: '560.15', stripeLink: 'https://buy.stripe.com/7sY28tfsW2887T07sA7Re03' },
  high: { name: 'Sprint Pro',           price: 899, priceDiscounted: '764.15', stripeLink: 'https://buy.stripe.com/3cI4gB1C65kk1uCdQY7Re04' },
};

const WA_BUSINESS = 'https://wa.me/16263609822?text=Hi%20RIK%20%E2%80%94%20';

function fmtRaceDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}

function checkCron(req) {
  // Vercel Cron sets the Authorization header to: `Bearer <CRON_SECRET>`.
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // allow if not configured (dev)
  const auth = req.headers['authorization'] ?? '';
  return auth === `Bearer ${expected}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!checkCron(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const summary = {
    no_converts_marked: 0,
    queue_reminder_sent: false,
    daily_summary_sent: false,
    sprint_s1_sent: 0,
    sprint_s2_sent: 0,
    sprint_screenings_purged: 0,
  };

  // 1. Mark 14-day no-converts + tag in Kit
  try {
    const noConvertRows = await markNoConvertCohort();
    summary.no_converts_marked = noConvertRows.length;
    for (const row of noConvertRows) {
      await trackAuditNoConvert(row.email, row.first_name || '').catch(err =>
        alertError({ where: 'cron/daily-sweep (klaviyo.trackAuditNoConvert)', error: err, auditId: row.id }));
    }
  } catch (err) {
    console.error('[daily-sweep] noConvert sweep failed:', err);
    await alertError({ where: 'cron/daily-sweep (markNoConvertCohort)', error: err }).catch(() => {});
  }

  // 2. Queue reminder
  try {
    const pending = await listOldPending({ olderThanHours: 4 });
    if (pending.length >= 3) {
      await alertQueueReminder({ pendingRows: pending });
      summary.queue_reminder_sent = true;
    }
  } catch (err) {
    console.error('[daily-sweep] queue reminder failed:', err);
  }

  // 3. Daily summary
  try {
    const stats = await getStats();
    await alertDailySummary({ stats });
    summary.daily_summary_sent = true;
  } catch (err) {
    console.error('[daily-sweep] daily summary failed:', err);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //   Sprint nurture emails (May 2026 — wired off sprint_screenings table)
  // ═══════════════════════════════════════════════════════════════════════

  // 4. S1 — cart-abandonment recovery for screening passes that didn't pay
  if (mailerReady()) {
    try {
      const s1Rows = await findPendingS1Pass();
      for (const row of s1Rows) {
        try {
          const tier = SPRINT_TIERS[row.hours] || SPRINT_TIERS.mid;
          const html = renderTemplate('emails/sprint/01-screening-pass.html', {
            first_name:             row.name.split(' ')[0],
            race_distance:          row.distance === 'full' ? 'Full Ironman' : 'Ironman 70.3',
            race_date:              fmtRaceDate(row.race_date),
            tier_name:              tier.name,
            tier_price:             String(tier.price),
            tier_price_discounted:  tier.priceDiscounted,
            stripe_link:            tier.stripeLink,
            stripe_link_with_promo: `${tier.stripeLink}?prefilled_promo_code=WELCOME15&prefilled_email=${encodeURIComponent(row.email)}`,
            promo_code:             'WELCOME15',
            wa_link:                WA_BUSINESS,
            unsubscribe:            'mailto:Bek.Zhou@rikathletica.com?subject=Unsubscribe',
          });
          await sendMail({
            to:      row.email,
            subject: "You're in window — finish checkout and start.",
            html,
          });
          await markScreeningS1Sent(row.id);
          summary.sprint_s1_sent += 1;
          console.log(`[daily-sweep] S1 sent to ${row.email} (id=${row.id})`);
        } catch (err) {
          console.error(`[daily-sweep] S1 failed for id=${row.id}:`, err.message);
          await alertError({ where: `cron/daily-sweep (S1 send id=${row.id})`, error: err }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[daily-sweep] S1 sweep failed:', err);
      await alertError({ where: 'cron/daily-sweep (findPendingS1Pass)', error: err }).catch(() => {});
    }
  }

  // 5. S2 — screening-fail explainer
  if (mailerReady()) {
    try {
      const s2Rows = await findPendingS2Fail();
      for (const row of s2Rows) {
        try {
          const days = Math.ceil((new Date(row.race_date) - new Date()) / 86400000);
          const html = renderTemplate('emails/sprint/02-screening-fail.html', {
            first_name:    row.name.split(' ')[0],
            race_date:     fmtRaceDate(row.race_date),
            days_to_race:  String(days),
            fail_reason:   row.fail_reason || 'Outside the 28–56 day race window',
            wa_link:       WA_BUSINESS,
            unsubscribe:   'mailto:Bek.Zhou@rikathletica.com?subject=Unsubscribe',
          });
          await sendMail({
            to:      row.email,
            subject: 'Your race date is outside our 28–56 day window.',
            html,
          });
          await markScreeningS2Sent(row.id);
          summary.sprint_s2_sent += 1;
          console.log(`[daily-sweep] S2 sent to ${row.email} (id=${row.id})`);
        } catch (err) {
          console.error(`[daily-sweep] S2 failed for id=${row.id}:`, err.message);
          await alertError({ where: `cron/daily-sweep (S2 send id=${row.id})`, error: err }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[daily-sweep] S2 sweep failed:', err);
      await alertError({ where: 'cron/daily-sweep (findPendingS2Fail)', error: err }).catch(() => {});
    }
  }

  // 6. Retention purge — delete sprint_screenings older than 18 months
  try {
    summary.sprint_screenings_purged = await purgeOldScreenings();
  } catch (err) {
    console.error('[daily-sweep] retention purge failed:', err);
    await alertError({ where: 'cron/daily-sweep (purgeOldScreenings)', error: err }).catch(() => {});
  }

  return res.status(200).json({ ok: true, summary });
}
