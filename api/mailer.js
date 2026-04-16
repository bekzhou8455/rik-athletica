/**
 * Shared Gmail SMTP mailer using Nodemailer.
 * Reads GMAIL_USER and GMAIL_APP_PASSWORD from environment.
 * All transactional emails in the RIK Athletica API use this module.
 */

import nodemailer from 'nodemailer';

let _transporter = null;

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return _transporter;
}

/**
 * Send an email via Gmail SMTP.
 * @param {{ to: string|string[], subject: string, html: string }} opts
 */
export async function sendMail({ to, subject, html }) {
  const from = `RIK Athletica <${process.env.GMAIL_USER}>`;
  const info = await getTransporter().sendMail({
    from,
    replyTo: process.env.GMAIL_USER,
    to,
    subject,
    html,
  });
  return info;
}

/** Returns true if Gmail credentials are configured. */
export function mailerReady() {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}
