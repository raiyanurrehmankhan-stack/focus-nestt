// Seeds activities and campus events. Run with: npm run seed
import '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { seedReferenceData } from './data.js';

await connectDB();
const r = await seedReferenceData();
console.log(`[seed] ${r.activities} activities and ${r.events} events are in the database`);
await disconnectDB();
