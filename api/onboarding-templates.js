/**
 * Transactional + onboarding email templates for Sprint customers.
 * Triggered by Stripe webhooks, intake completion, and manual events.
 */

const BRAND = {
  logo: 'https://cdn.jsdelivr.net/gh/bekzhou8455/rik-athletica@main/assets/media/rik-logo-cropped.png',
  green: '#2D5A3D',
  teal: '#1a7a6e',
  bg: '#F7F5F1',
  text: '#111410',
  muted: '#6B6860',
  subtle: '#9C9890',
  border: '#E4E1DA',
  site: 'https://www.rikathletica.com',
};

function wrap(content) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <div style="margin-bottom:36px;">
    <img src="${BRAND.logo}" alt="RIK Athletica" style="height:36px;width:auto;">
  </div>
  ${content}
  <div style="height:1px;background:${BRAND.border};margin:28px 0 20px;"></div>
  <p style="font-size:11px;color:${BRAND.subtle};line-height:1.6;margin:0;">
    RIK Athletic Nutrition Inc.
    &nbsp;&middot;&nbsp; <a href="${BRAND.site}/privacy" style="color:${BRAND.subtle};">Privacy</a>
    &nbsp;&middot;&nbsp; <a href="${BRAND.site}/terms" style="color:${BRAND.subtle};">Terms</a>
  </p>
</div>
</body>
</html>`;
}

function cta(text, url) {
  return `<div style="margin:28px 0;">
    <a href="${url}" style="display:inline-block;background:${BRAND.green};color:#fff;text-decoration:none;font-size:14px;font-weight:500;padding:13px 28px;border-radius:36px;">
      ${text}
    </a>
  </div>`;
}

// ─── Payment Confirmation (sent after Stripe payment succeeds) ───
export function paymentConfirmation({ name, email, tier, amount }) {
  return {
    subject: `Payment confirmed — your ${tier} starts now`,
    html: wrap(`
      <h1 style="font-size:24px;font-weight:600;color:${BRAND.text};letter-spacing:-0.03em;line-height:1.2;margin:0 0 16px;">
        Payment confirmed. We're building your protocol.
      </h1>
      <p style="font-size:15px;color:${BRAND.muted};line-height:1.65;margin:0 0 24px;">
        Hi ${name || 'there'}, your ${tier} Sprint ($${amount}) is confirmed. Here's what happens next:
      </p>

      <div style="margin:0 0 24px;">
        <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid ${BRAND.border};">
          <span style="font-size:20px;flex-shrink:0;">1</span>
          <div>
            <p style="font-size:14px;font-weight:600;color:${BRAND.text};margin:0 0 2px;">Complete your intake form</p>
            <p style="font-size:13px;color:${BRAND.muted};margin:0;">10 minutes. Your physiology, training, race details.</p>
          </div>
        </div>
        <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid ${BRAND.border};">
          <span style="font-size:20px;flex-shrink:0;">2</span>
          <div>
            <p style="font-size:14px;font-weight:600;color:${BRAND.text};margin:0 0 2px;">We build your protocol</p>
            <p style="font-size:13px;color:${BRAND.muted};margin:0;">Personalized to your data. Both layers. Every session.</p>
          </div>
        </div>
        <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid ${BRAND.border};">
          <span style="font-size:20px;flex-shrink:0;">3</span>
          <div>
            <p style="font-size:14px;font-weight:600;color:${BRAND.text};margin:0 0 2px;">Training Box ships within 5 days</p>
            <p style="font-size:13px;color:${BRAND.muted};margin:0;">All products for your 4-week block.</p>
          </div>
        </div>
        <div style="display:flex;gap:12px;padding:12px 0;">
          <span style="font-size:20px;flex-shrink:0;">4</span>
          <div>
            <p style="font-size:14px;font-weight:600;color:${BRAND.text};margin:0 0 2px;">Weekly revisions until race day</p>
            <p style="font-size:13px;color:${BRAND.muted};margin:0;">The revision loop. We don't stop until it works.</p>
          </div>
        </div>
      </div>

      <p style="font-size:14px;color:${BRAND.green};font-weight:500;margin:0 0 20px;">
        If you haven't completed the intake form yet, do it now so we can start building your protocol.
      </p>

      ${cta('Complete Your Intake Form →', 'https://form.typeform.com/to/XT5Qo0HD')}

      <p style="font-size:12px;color:${BRAND.subtle};margin:0;">
        Questions? Reply to this email or contact hello@rikathletica.com.
      </p>
    `),
  };
}

// ─── Onboarding Welcome (sent after intake form is completed) ───
export function onboardingWelcome({ name, raceDate, raceDistance }) {
  const dist = raceDistance === 'full' ? 'Full Ironman' : '70.3';
  return {
    subject: `Welcome to Sprint — your ${dist} protocol is being built`,
    html: wrap(`
      <h1 style="font-size:24px;font-weight:600;color:${BRAND.text};letter-spacing:-0.03em;line-height:1.2;margin:0 0 16px;">
        We're building your protocol now.
      </h1>
      <p style="font-size:15px;color:${BRAND.muted};line-height:1.65;margin:0 0 24px;">
        Hi ${name || 'there'}, we've received your intake form. Your ${dist} protocol is being built now.
      </p>

      <div style="background:#fff;border:1px solid ${BRAND.border};border-radius:12px;padding:24px;margin:0 0 24px;">
        <p style="font-size:13px;font-weight:600;color:${BRAND.text};margin:0 0 12px;">Your Sprint timeline:</p>
        <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;">
          <span style="color:${BRAND.green};font-weight:600;min-width:80px;">Now</span>
          <span style="color:${BRAND.muted};">Protocol being built from your intake data</span>
        </div>
        <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;">
          <span style="color:${BRAND.green};font-weight:600;min-width:80px;">~5 days</span>
          <span style="color:${BRAND.muted};">Training Box ships with all products + protocol</span>
        </div>
        <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;">
          <span style="color:${BRAND.green};font-weight:600;min-width:80px;">Weekly</span>
          <span style="color:${BRAND.muted};">Check-in form + protocol revision</span>
        </div>
        ${raceDate ? `<div style="display:flex;gap:12px;padding:8px 0;font-size:13px;">
          <span style="color:${BRAND.green};font-weight:600;min-width:80px;">Race day</span>
          <span style="color:${BRAND.muted};">${raceDate} — Race Pack (add-on) ships 10 days before if purchased</span>
        </div>` : ''}
      </div>

      <p style="font-size:15px;color:${BRAND.muted};line-height:1.65;margin:0 0 20px;">
        You'll receive your first protocol documents (Week Grid, Session Protocol, Performance Report) when your Training Box ships. Everything syncs to your calendar automatically.
      </p>

      <p style="font-size:12px;color:${BRAND.subtle};margin:0;">
        Questions anytime: reply to this email or hello@rikathletica.com.
      </p>
    `),
  };
}

// ─── Training Box Shipped (triggered manually or by 3PL webhook) ───
export function trainingBoxShipped({ name, trackingUrl }) {
  return {
    subject: 'Your Training Box is on its way',
    html: wrap(`
      <h1 style="font-size:24px;font-weight:600;color:${BRAND.text};letter-spacing:-0.03em;line-height:1.2;margin:0 0 16px;">
        Your Training Box just shipped.
      </h1>
      <p style="font-size:15px;color:${BRAND.muted};line-height:1.65;margin:0 0 24px;">
        Hi ${name || 'there'}, your Training Box is on its way. This is Shipment 1, covering Weeks 1-2 of your Sprint. Inside you'll find:
      </p>

      <div style="margin:0 0 24px;">
        <div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;color:${BRAND.muted};">
          <span style="color:${BRAND.green};">&#x2713;</span> Layer 1 products (carbs, hydration, electrolytes)
        </div>
        <div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;color:${BRAND.muted};">
          <span style="color:${BRAND.green};">&#x2713;</span> Layer 2: Euphoria + Refuel (your enhancement layer)
        </div>
        <div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;color:${BRAND.muted};">
          <span style="color:${BRAND.green};">&#x2713;</span> Protocol card with calendar sync QR code
        </div>
        <div style="display:flex;gap:8px;padding:8px 0;font-size:14px;color:${BRAND.muted};">
          <span style="color:${BRAND.green};">&#x2713;</span> Week 1 protocol documents (attached to your calendar)
        </div>
      </div>

      ${trackingUrl ? cta('Track Your Shipment →', trackingUrl) : ''}

      <p style="font-size:15px;color:${BRAND.text};font-weight:500;margin:0 0 12px;">
        What to do when it arrives:
      </p>
      <p style="font-size:14px;color:${BRAND.muted};line-height:1.65;margin:0 0 20px;">
        Scan the QR code on the protocol card to sync your fueling schedule to your iPhone calendar. Open your calendar and you'll see every session pre-loaded with product timing.
      </p>

      <p style="font-size:12px;color:${BRAND.subtle};margin:0;">
        Your first weekly check-in is in 7 days. We'll send you a quick form.
      </p>
    `),
  };
}

// ─── Week 1 Check-in (sent 7 days after Training Box ships) ───
export function weeklyCheckIn({ name, weekNumber, feedbackFormUrl }) {
  const formUrl = feedbackFormUrl || 'https://form.typeform.com/to/FEEDBACK_FORM_ID';
  return {
    subject: `Week ${weekNumber} check-in — how did your sessions feel?`,
    html: wrap(`
      <h1 style="font-size:24px;font-weight:600;color:${BRAND.text};letter-spacing:-0.03em;line-height:1.2;margin:0 0 16px;">
        Week ${weekNumber} check-in.
      </h1>
      <p style="font-size:15px;color:${BRAND.muted};line-height:1.65;margin:0 0 24px;">
        Hi ${name || 'there'}, how did Week ${weekNumber} go? Take 2 minutes to tell us how your sessions felt. We use this to revise your protocol for next week.
      </p>

      <div style="background:#fff;border:1px solid ${BRAND.border};border-radius:12px;padding:24px;margin:0 0 24px;">
        <p style="font-size:14px;font-weight:600;color:${BRAND.text};margin:0 0 8px;">What we'll adjust based on your feedback:</p>
        <p style="font-size:13px;color:${BRAND.muted};line-height:1.6;margin:0;">
          Carb targets (up or down based on GI response), product timing, sodium dosing, Euphoria/Refuel placement, and fluid targets. The protocol adapts to you.
        </p>
      </div>

      ${cta('Complete Week ' + weekNumber + ' Check-in (2 min) →', formUrl)}

      <p style="font-size:13px;color:${BRAND.muted};margin:0;">
        ${weekNumber < 4
          ? `Week ${weekNumber + 1} protocol will be updated within 24 hours of your check-in.`
          : 'This is your final check-in. Your race-day plan will be locked in within 24 hours.'}
      </p>

      <div style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:12px;padding:16px 20px;margin-top:24px;">
        <p style="font-size:13px;color:${BRAND.muted};margin:0;line-height:1.6;">
          <strong style="color:${BRAND.text};">Running low on Euphoria or Refuel?</strong>
          If you're using them outside your protocol sessions too (we don't blame you), grab another bundle before you run out.
        </p>
        <a href="${BRAND.site}/bundle" style="display:inline-block;margin-top:10px;font-size:13px;color:${BRAND.green};text-decoration:none;font-weight:500;">Restock — $119 →</a>
      </div>
    `),
  };
}

// ─── Internal: Payment Alert (sent to founder) ───
export function internalPaymentAlert({ name, email, tier, amount, raceDate }) {
  return {
    subject: `New Sprint payment: $${amount} — ${name || email} (${tier})`,
    html: `<div style="font-family:sans-serif;padding:20px;">
      <h2 style="margin:0 0 16px;color:#2D5A3D;">New Sprint Payment Received</h2>
      <table style="font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:6px 16px 6px 0;font-weight:600;">Athlete:</td><td>${name || 'N/A'}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;font-weight:600;">Email:</td><td>${email}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;font-weight:600;">Tier:</td><td>${tier}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;font-weight:600;">Amount:</td><td>$${amount}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;font-weight:600;">Race Date:</td><td>${raceDate || 'TBD (from intake)'}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;font-weight:600;">Time:</td><td>${new Date().toISOString()}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #ddd;margin:16px 0;">
      <p style="font-size:13px;color:#888;">
        <strong>Next steps:</strong> Wait for intake form submission. Then build protocol + pack Training Box.
      </p>
      <p style="font-size:12px;color:#aaa;">RIK Athletica Internal Notification</p>
    </div>`,
  };
}

// ─── Internal: Intake Incomplete Reminder (sent to founder if intake not done in 48hrs) ───
export function internalIntakeReminder({ name, email, tier, paymentDate }) {
  return {
    subject: `Intake incomplete: ${name || email} — paid ${paymentDate}, no intake yet`,
    html: `<div style="font-family:sans-serif;padding:20px;">
      <h2 style="margin:0 0 16px;color:#C4500F;">Intake Form Not Completed</h2>
      <p style="font-size:14px;">
        <strong>${name || email}</strong> paid for ${tier} Sprint on ${paymentDate} but hasn't completed the intake form yet (48+ hours).
      </p>
      <p style="font-size:14px;">
        <strong>Action:</strong> Send a personal follow-up email asking if they need help with the intake form.
      </p>
      <hr style="border:none;border-top:1px solid #ddd;margin:16px 0;">
      <p style="font-size:12px;color:#aaa;">RIK Athletica Internal Notification</p>
    </div>`,
  };
}
