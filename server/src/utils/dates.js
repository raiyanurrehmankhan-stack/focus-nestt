import { addDays, toDateKey } from '../../../shared/rules.js';

/** Validate a client-supplied local date, falling back to the server date. */
export const clientDate = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toDateKey());
export const windowFrom = (today, days) => addDays(today, -(days - 1));
