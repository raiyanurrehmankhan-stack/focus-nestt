import { readJSON, writeJSON } from './storage.js';

/** Stable per-browser id so the server can tell laptop and phone apart. */
export function getDeviceId() {
  let id = readJSON('fn:device-id');
  if (!id) {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    writeJSON('fn:device-id', id);
  }
  return id;
}

export function getDeviceType() {
  const ua = navigator.userAgent || '';
  if (/iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'tablet';
  if (/Android|iPhone|iPod|Mobile/i.test(ua)) return 'phone';
  return 'laptop';
}

export function getDeviceLabel() {
  const ua = navigator.userAgent || '';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Mac/i.test(ua) ? 'Mac' : /Windows/i.test(ua) ? 'Windows' : /Linux/i.test(ua) ? 'Linux' : 'Device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${browser} on ${os}`;
}

export const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
