import nodemailer from 'nodemailer';

// Gmail SMTP config — set these in your local environment:
//   GMAIL_USER=rikathletica@gmail.com  (or your Google Workspace address)
//   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx  (Gmail App Password — not your login password)
//   NOTIFY_TO=bek.zhou@rik-sports.com  (optional override)
//
// To generate an App Password: Google Account → Security → 2-Step Verification → App passwords

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const TO_EMAIL = process.env.NOTIFY_TO || 'bek.zhou@rik-sports.com';

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

async function sendEmail(subject: string, html: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.log(`[notifier] GMAIL_USER/GMAIL_APP_PASSWORD not set — skipping email: ${subject}`);
    return;
  }
  try {
    const info = await t.sendMail({ from: GMAIL_USER, to: TO_EMAIL, subject, html });
    console.log(`[notifier] Email sent: ${subject} (messageId: ${info.messageId})`);
  } catch (error) {
    console.error(`[notifier] Failed to send email "${subject}":`, (error as Error).message);
  }
}

export async function notifyGenerationFailed(athleteId: string, error: string): Promise<void> {
  const subject = `⚠ Protocol generation failed — ${athleteId}`;
  const html = `
    <h2>Protocol Generation Failed</h2>
    <p><strong>Athlete:</strong> ${athleteId}</p>
    <p><strong>Error:</strong> ${error}</p>
    <p>The Claude API returned an error after 1 retry. The session state has been preserved.</p>
    <p>Log in to the protocol builder at <a href="http://localhost:3457">http://localhost:3457</a> to retry.</p>
    <hr>
    <p style="color: #888; font-size: 12px;">RIK Athletica Protocol Builder</p>
  `;
  await sendEmail(subject, html);
}

export async function notifyProtocolReady(athleteId: string, iterationNumber: number): Promise<void> {
  const subject = `✓ Protocol ready for review — ${athleteId}`;
  const iterationLabel = iterationNumber === 0
    ? 'Initial protocol'
    : `Iteration ${iterationNumber} adjustment`;
  const html = `
    <h2>Protocol Ready for Review</h2>
    <p><strong>Athlete:</strong> ${athleteId}</p>
    <p><strong>Iteration:</strong> ${iterationLabel}</p>
    <p>The Architect AI has generated a protocol and the Auditor AI has reviewed it. Your action is needed.</p>
    <p><a href="http://localhost:3457">Open Protocol Builder →</a></p>
    <hr>
    <p style="color: #888; font-size: 12px;">RIK Athletica Protocol Builder</p>
  `;
  await sendEmail(subject, html);
}

export async function notifyEscalated(athleteId: string): Promise<void> {
  const subject = `⚠ Protocol escalated — manual build required — ${athleteId}`;
  const html = `
    <h2>Protocol Escalated — Manual Review Required</h2>
    <p><strong>Athlete:</strong> ${athleteId}</p>
    <p>The revision loop has been exhausted (3 revisions attempted) without reaching a PASS verdict, or you manually escalated this protocol.</p>
    <p>This protocol requires your manual intervention. The session state is preserved.</p>
    <p><a href="http://localhost:3457">Open Protocol Builder →</a></p>
    <hr>
    <p style="color: #888; font-size: 12px;">RIK Athletica Protocol Builder</p>
  `;
  await sendEmail(subject, html);
}

export async function notifyApproved(athleteId: string, iterationNumber: number): Promise<void> {
  const subject = `✓ Protocol approved, ready to send — ${athleteId}`;
  const iterationLabel = iterationNumber === 0
    ? 'Initial protocol'
    : `Iteration ${iterationNumber} adjustment`;
  const html = `
    <h2>Protocol Approved</h2>
    <p><strong>Athlete:</strong> ${athleteId}</p>
    <p><strong>Iteration:</strong> ${iterationLabel}</p>
    <p>You have approved this protocol. The .ics file and print protocol are ready to send to the athlete.</p>
    <p><a href="http://localhost:3457">Open Protocol Builder →</a></p>
    <hr>
    <p style="color: #888; font-size: 12px;">RIK Athletica Protocol Builder</p>
  `;
  await sendEmail(subject, html);
}
