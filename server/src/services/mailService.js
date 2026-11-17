import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { buildBuddyEmail, createMailTransport } from './mailSetup.js';

// Email stays disabled unless SMTP_HOST, SMTP_USER, SMTP_PASS and a valid
// MAIL_FROM are all set (checked in config/validateEnv.js). There is no
// built-in sender address.
const transport = createMailTransport(nodemailer, env.smtp);

export const mailEnabled = Boolean(transport);

/**
 * Accountability buddy: tells a friend that a break was extended.
 * Privacy (doc 7.8): the buddy only learns THAT a limit was extended, never why.
 */
export async function notifyBuddy(user, minutes) {
  if (!transport || !user.buddyEmail) return false;
  try {
    await transport.sendMail(buildBuddyEmail(user, minutes, { from: env.smtp.from, appUrl: env.appUrl }));
    return true;
  } catch (err) {
    console.warn('[mail] buddy email failed:', err.code || 'send error');
    return false;
  }
}
