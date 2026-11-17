// Email helpers, dependency-free so they can be tested with a fake nodemailer.

/** Returns a transport only when SMTP is fully configured; otherwise null (email disabled). */
export function createMailTransport(nodemailer, smtp, log = console) {
  if (!smtp?.enabled) return null;
  try {
    return nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.port === 465, auth: { user: smtp.user, pass: smtp.pass } });
  } catch {
    log.error('[mail] Could not create the SMTP transport, so email is disabled. Check the SMTP settings.');
    return null;
  }
}

/**
 * The accountability-buddy message. Privacy (doc 7.8): the buddy only learns
 * THAT a break was extended, never the reason.
 */
export function buildBuddyEmail({ name, buddyEmail }, minutes, { from, appUrl = '' }) {
  const who = name || 'Your friend';
  return {
    from,
    to: buddyEmail,
    subject: `${who} extended a break on FocusNest`,
    text: `Hi! ${who} asked you to be their FocusNest accountability buddy.\n\nThey just extended a break by ${minutes} minutes. A friendly message might help them get back to focus.\n\n— FocusNest${appUrl ? `\n${appUrl}` : ''}`,
  };
}
