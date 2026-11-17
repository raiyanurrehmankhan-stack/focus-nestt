// Server-owned clock (doc 7.5/7.6): every running focus session and break has
// a job scheduled for its end time. Jobs are rebuilt from MongoDB on restart,
// and a sweeper catches anything missed (e.g. a job lost during a deploy).
import schedule from 'node-schedule';

const jobs = new Map(); // key -> Job | Timeout

export function scheduleAt(key, date, fn) {
  cancel(key);
  const when = new Date(date);
  const run = () => { jobs.delete(key); Promise.resolve(fn()).catch((e) => console.error('[scheduler]', key, e)); };
  if (when.getTime() <= Date.now() + 50) {
    const t = setTimeout(run, 0);
    jobs.set(key, t);
    return;
  }
  const job = schedule.scheduleJob(when, run);
  if (job) jobs.set(key, job);
}

export function cancel(key) {
  const j = jobs.get(key);
  if (!j) return;
  if (typeof j.cancel === 'function') j.cancel();
  else clearTimeout(j);
  jobs.delete(key);
}

export const scheduledCount = () => jobs.size;

let sweeper = null;
export function startSweeper(fn, everyMs = 30_000) {
  stopSweeper();
  sweeper = setInterval(() => Promise.resolve(fn()).catch((e) => console.error('[scheduler] sweep', e)), everyMs);
  sweeper.unref?.();
}
export function stopSweeper() {
  if (sweeper) clearInterval(sweeper);
  sweeper = null;
  for (const key of [...jobs.keys()]) cancel(key);
}
