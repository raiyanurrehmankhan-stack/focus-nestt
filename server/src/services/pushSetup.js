// Applies VAPID settings to a web-push compatible library. Dependency-free so
// it can be tested with a fake library. Never throws: if the library rejects
// the configuration, push is disabled with a message that contains no keys
// (web-push's own error messages can echo configuration values).
export function initPush(webpush, vapid, log = console) {
  if (!vapid?.enabled) {
    log.warn('[push] Web Push is disabled. To enable it set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (npm run vapid) and VAPID_SUBJECT.');
    return false;
  }
  try {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    return true;
  } catch {
    log.error('[push] The web-push library rejected the VAPID configuration, so push notifications are disabled. Regenerate the keys with `npm run vapid` and check VAPID_SUBJECT.');
    return false;
  }
}
