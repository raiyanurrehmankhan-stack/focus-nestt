import { ACTIVITIES, CAMPUS_EVENTS } from '../../../shared/constants.js';
import { Activity, CampusEvent } from '../models/index.js';

/** Upserts the activity catalogue and community events (safe to run on every start). */
export async function seedReferenceData() {
  await Activity.bulkWrite(ACTIVITIES.map((a) => ({
    updateOne: { filter: { key: a.id }, update: { $set: { key: a.id, title: a.title, description: a.description, minutes: a.minutes, category: a.category, emoji: a.emoji } }, upsert: true },
  })));
  await CampusEvent.bulkWrite(CAMPUS_EVENTS.map((e) => ({
    updateOne: { filter: { key: e.id }, update: { $set: { key: e.id, title: e.title, date: e.when, place: e.place, type: e.type, emoji: e.emoji } }, upsert: true },
  })));
  return { activities: ACTIVITIES.length, events: CAMPUS_EVENTS.length };
}
