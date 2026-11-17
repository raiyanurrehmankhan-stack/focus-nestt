// Runtime configuration for the web app.
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const HAS_BACKEND = Boolean(API_URL);
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
