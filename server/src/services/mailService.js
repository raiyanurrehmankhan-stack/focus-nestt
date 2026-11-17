import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const configured = Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);
const transport = configured
  ? nodemailer.createTransport({ host: env.smtp.host, port: env.smtp.port, secure: env.smtp.port === 465, auth: { user: env.smtp.user, pass: env.smtp.pass } })
  : null;

export const mailEnabled = configured;

/**
 * Accountability buddy: tells a friend that a break was extended.
 * Privacy (doc 7.8): the buddy only learns THAT a limit was extended, never why.
 */
export async function notifyBuddy(user, minutes) {
  if (!transport || !user.buddyEmail) return false;
  const name = user.name || 'Your friend';
  try {
    await transport.sendMail({
      from: env.smtp.from,
      to: user.buddyEmail,
      subject: `${name} extended a break on FocusNest`,
      text: `Hi! ${name} asked you to be their FocusNest accountability buddy.\n\nThey just extended a break by ${minutes} minutes. A friendly message might help them get back to focus.\n\n— FocusNest${env.appUrl ? `\n${env.appUrl}` : ''}`,
    });
    return true;
  } catch (err) {
    console.warn('[mail] buddy email failed:', err.message);
    return false;
  }
}
